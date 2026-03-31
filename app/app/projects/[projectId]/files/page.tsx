"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Upload, FileText, Database, Map as MapIcon, Trash2, CloudUpload, Loader2, File, CheckCircle, Zap, ShieldCheck, AlertTriangle, Info, XCircle, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { formatBytes, formatDate } from "@/lib/utils";
import { FileRecord } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

export default function FilesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsingFiles, setParsingFiles] = useState<Set<string>>(new Set());
  const [validatingFiles, setValidatingFiles] = useState<Set<string>>(new Set());
  const [validationResults, setValidationResults] = useState<Record<string, { issues: any[]; score: number }>>({});
  const [expandedValidation, setExpandedValidation] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const parseFile = async (fileId: string) => {
    setParsingFiles((prev) => new Set(prev).add(fileId));
    setError(null);
    try {
      const res = await fetch("/api/files/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to parse file");
      }
      const { parsedSummary } = await res.json();
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, parsed_summary: parsedSummary } : f))
      );
      setValidationResults((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
      await loadFiles();
    } catch (err) {
      console.error("Parse error:", err);
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParsingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  const validateFile = async (fileId: string) => {
    setValidatingFiles((prev) => new Set(prev).add(fileId));
    setError(null);
    try {
      const res = await fetch("/api/files/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to validate file");
      }
      const data = await res.json();
      setValidationResults((prev) => ({ ...prev, [fileId]: data }));
      setExpandedValidation(fileId);
    } catch (err) {
      console.error("Validation error:", err);
      setError(err instanceof Error ? err.message : "Failed to validate file");
    } finally {
      setValidatingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  useEffect(() => {
    loadFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("project-files")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      let fileKind: FileRecord["file_kind"] = "other";
      if (fileExt === "csv") fileKind = "drill_csv";
      else if (fileExt === "pdf") fileKind = "pdf";
      else if (["tif", "tiff", "las", "xyz"].includes(fileExt || "")) fileKind = "geophysics";

      const { data: insertedFile, error: dbError } = await supabase.from("files").insert({
        project_id: projectId,
        uploader_id: user.id,
        storage_path: filePath,
        filename: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        file_kind: fileKind,
      }).select().single();
      if (dbError) throw dbError;
      await loadFiles();
      // Auto-parse file in background
      if (insertedFile) {
        parseFile(insertedFile.id);
      }
    } catch (error: any) {
      setError(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleDelete = async (fileId: string, storagePath: string) => {
    if (!confirm("Delete this file?")) return;
    try {
      await supabase.storage.from("project-files").remove([storagePath]);
      const { error } = await supabase.from("files").delete().eq("id", fileId);
      if (error) throw error;
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error: any) {
      setError(error.message || "Failed to delete file");
    }
  };

  const getFileIcon = (kind: string) => {
    const cls = "h-5 w-5";
    switch (kind) {
      case "drill_csv": return <Database className={`${cls} text-emerald-400`} />;
      case "pdf": return <FileText className={`${cls} text-red-400`} />;
      case "geophysics": return <MapIcon className={`${cls} text-blue-400`} />;
      case "block_model": return <File className={`${cls} text-purple-400`} />;
      default: return <FileText className={`${cls} text-muted-foreground`} />;
    }
  };

  const getKindBadge = (kind: string) => {
    const map: Record<string, { label: string; color: string }> = {
      drill_csv: { label: "Drillhole", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
      pdf: { label: "PDF", color: "bg-red-500/10 text-red-400 border-red-500/20" },
      geophysics: { label: "Geophysics", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
      block_model: { label: "Block Model", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
      other: { label: "Other", color: "bg-muted text-muted-foreground border-border" },
    };
    const b = map[kind] || map.other;
    return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>;
  };

  return (
    <div className="p-6 md:p-8 h-full overflow-auto space-y-6">
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive animate-in fade-in duration-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs opacity-70">dismiss</button>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 group ${
          dragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border/50 hover:border-primary/30 hover:bg-card/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm font-medium text-primary">Uploading file...</p>
          </div>
        ) : (
          <>
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-300 ${
              dragActive ? "bg-primary/20 scale-110" : "bg-muted/50 group-hover:bg-primary/10"
            }`}>
              <CloudUpload className={`h-7 w-7 transition-colors duration-300 ${dragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
            </div>
            <p className="text-sm font-medium mb-1">
              {dragActive ? "Drop your file here" : "Drop files here or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">CSV, PDF, TIF, LAS, XYZ — up to 500MB</p>
          </>
        )}
      </div>

      {/* File Count */}
      {!loading && files.length > 0 && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""}</h3>
        </div>
      )}

      {/* File Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card/30 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : files.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="group rounded-2xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-border transition-all duration-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                  {getFileIcon(file.file_kind)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {getKindBadge(file.file_kind)}
                    <span className="text-[10px] text-muted-foreground">{formatBytes(file.size_bytes)}</span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground/50">{formatDate(file.created_at)}</span>
                    {parsingFiles.has(file.id) ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />Parsing
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); parseFile(file.id); }}
                        className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/50 text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-all flex items-center gap-1"
                      >
                        {file.parsed_summary ? <RefreshCw className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
                        {file.parsed_summary ? "Re-parse" : "Parse"}
                      </button>
                    )}
                    {file.parsed_summary && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5" />Parsed
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {file.parsed_summary && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); validateFile(file.id); }}
                      disabled={validatingFiles.has(file.id)}
                      className={`p-2 rounded-xl transition-all duration-200 ${
                        validationResults[file.id]
                          ? validationResults[file.id].score >= 80
                            ? "text-emerald-400 hover:bg-emerald-500/10"
                            : validationResults[file.id].score >= 50
                            ? "text-amber-400 hover:bg-amber-500/10"
                            : "text-destructive hover:bg-destructive/10"
                          : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      }`}
                      title="Validate data quality"
                    >
                      {validatingFiles.has(file.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(file.id, file.storage_path)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Validation Results Panel */}
              {validationResults[file.id] && expandedValidation === file.id && (
                <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${
                        validationResults[file.id].score >= 80 ? "text-emerald-400" :
                        validationResults[file.id].score >= 50 ? "text-amber-400" : "text-destructive"
                      }`}>
                        Quality: {validationResults[file.id].score}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {validationResults[file.id].issues.length} issue{validationResults[file.id].issues.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => setExpandedValidation(null)}
                      className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                  </div>
                  {validationResults[file.id].issues.map((issue: any, idx: number) => (
                    <div key={idx} className={`flex items-start gap-2 p-2 rounded-lg text-[11px] ${
                      issue.severity === "error" ? "bg-destructive/5 border border-destructive/15" :
                      issue.severity === "warning" ? "bg-amber-500/5 border border-amber-500/15" :
                      "bg-muted/20 border border-border/30"
                    }`}>
                      <div className="shrink-0 mt-0.5">
                        {issue.severity === "error" ? <XCircle className="h-3 w-3 text-destructive" /> :
                         issue.severity === "warning" ? <AlertTriangle className="h-3 w-3 text-amber-400" /> :
                         <Info className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium">{issue.message}</p>
                        {issue.details && <p className="text-muted-foreground mt-0.5">{issue.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {validationResults[file.id] && expandedValidation !== file.id && (
                <button
                  type="button"
                  onClick={() => setExpandedValidation(file.id)}
                  className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <ChevronDown className="h-3 w-3" />
                  Show {validationResults[file.id].issues.length} validation result{validationResults[file.id].issues.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <Upload className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">No files uploaded yet</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Upload your first file to get started</p>
        </div>
      )}
    </div>
  );
}
