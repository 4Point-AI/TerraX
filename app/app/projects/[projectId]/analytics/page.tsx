"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart3, FileText, MessageSquare, Map, Database, Layers, Clock, HardDrive, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";

interface ProjectStats {
  fileCount: number;
  totalSize: number;
  parsedCount: number;
  drillholeFiles: number;
  chatCount: number;
  messageCount: number;
  reportCount: number;
  aoiCount: number;
  fileTypes: Record<string, number>;
  recentActivity: { type: string; title: string; date: string }[];
  dataColumns: string[];
  totalRows: number;
}

export default function AnalyticsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [filesRes, chatsRes, messagesRes, reportsRes, aoisRes] = await Promise.all([
        supabase.from("files").select("*").eq("project_id", projectId),
        supabase.from("chats").select("id, title, updated_at").eq("project_id", projectId),
        supabase.from("chat_messages").select("id, chat_id, role, created_at").in(
          "chat_id",
          (await supabase.from("chats").select("id").eq("project_id", projectId)).data?.map((c) => c.id) || []
        ),
        supabase.from("reports").select("id, title, created_at").eq("project_id", projectId),
        supabase.from("aoi").select("id, name, created_at").eq("project_id", projectId),
      ]);

      const files = filesRes.data || [];
      const chats = chatsRes.data || [];
      const messages = messagesRes.data || [];
      const reports = reportsRes.data || [];
      const aois = aoisRes.data || [];

      const fileTypes: Record<string, number> = {};
      let totalSize = 0;
      let parsedCount = 0;
      let drillholeFiles = 0;
      let totalRows = 0;
      const allColumns = new Set<string>();

      for (const f of files) {
        totalSize += f.size_bytes || 0;
        fileTypes[f.file_kind] = (fileTypes[f.file_kind] || 0) + 1;
        if (f.file_kind === "drill_csv") drillholeFiles++;
        if (f.parsed_summary) {
          parsedCount++;
          if (f.parsed_summary.isDrillhole && f.file_kind !== "drill_csv") drillholeFiles++;
          if (f.parsed_summary.totalRows) totalRows += f.parsed_summary.totalRows;
          if (f.parsed_summary.columns) {
            f.parsed_summary.columns.forEach((c: string) => allColumns.add(c));
          }
        }
      }

      // Build recent activity
      const activity: { type: string; title: string; date: string }[] = [];
      for (const f of files.slice(0, 3)) {
        activity.push({ type: "file", title: f.filename, date: f.created_at });
      }
      for (const c of chats.slice(0, 3)) {
        activity.push({ type: "chat", title: c.title, date: c.updated_at });
      }
      for (const r of reports.slice(0, 3)) {
        activity.push({ type: "report", title: r.title, date: r.created_at });
      }
      activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setStats({
        fileCount: files.length,
        totalSize,
        parsedCount,
        drillholeFiles,
        chatCount: chats.length,
        messageCount: messages.length,
        reportCount: reports.length,
        aoiCount: aois.length,
        fileTypes,
        recentActivity: activity.slice(0, 8),
        dataColumns: Array.from(allColumns),
        totalRows,
      });
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSummary = async () => {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project-summary", projectId }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-summary.txt";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) => (
    <div className="rounded-2xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-border transition-all duration-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-muted/30 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card/30 p-5 animate-pulse">
              <div className="h-9 w-9 rounded-xl bg-muted/30 mb-3" />
              <div className="h-6 w-16 bg-muted/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Project data overview and metrics</p>
        </div>
        <Button onClick={handleExportSummary} variant="outline" className="rounded-xl h-9 text-xs gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export Summary
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Files" value={stats.fileCount} sub={`${formatBytes(stats.totalSize)} total`} />
        <StatCard icon={MessageSquare} label="Messages" value={stats.messageCount} sub={`${stats.chatCount} conversation${stats.chatCount !== 1 ? "s" : ""}`} />
        <StatCard icon={BarChart3} label="Reports" value={stats.reportCount} />
        <StatCard icon={Layers} label="AOIs" value={stats.aoiCount} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Data Coverage */}
        <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Data Coverage
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-muted/10 p-3">
                <p className="text-muted-foreground mb-1">Drillhole Files (type)</p>
                <p className="text-lg font-bold">{stats.drillholeFiles}</p>
              </div>
              <div className="rounded-xl bg-muted/10 p-3">
                <p className="text-muted-foreground mb-1">Structured Summaries</p>
                <p className="text-lg font-bold">{stats.parsedCount}</p>
              </div>
            </div>
            {stats.parsedCount === 0 && (
              <p className="text-[11px] text-muted-foreground/70">
                Structured parsing stats are not available yet. Uploads and file-type analytics still work.
              </p>
            )}
            {stats.parsedCount > 0 && stats.dataColumns.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">Detected Columns ({stats.dataColumns.length})</p>
                <div className="flex flex-wrap gap-1">
                  {stats.dataColumns.slice(0, 20).map((col) => (
                    <span key={col} className="text-[10px] px-2 py-0.5 rounded-full border border-border/50 bg-muted/20 text-muted-foreground">
                      {col}
                    </span>
                  ))}
                  {stats.dataColumns.length > 20 && (
                    <span className="text-[10px] px-2 py-0.5 text-muted-foreground">+{stats.dataColumns.length - 20} more</span>
                  )}
                </div>
              </div>
            )}
            {stats.parsedCount > 0 && (
              <div className="rounded-xl bg-muted/10 p-3 text-xs">
                <p className="text-muted-foreground mb-1">Total Parsed Rows</p>
                <p className="text-lg font-bold">{stats.totalRows.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* File Types & Recent Activity */}
        <div className="space-y-4">
          {/* File Types */}
          <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              File Types
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.fileTypes).map(([kind, count]) => {
                const pct = stats.fileCount > 0 ? Math.round((count / stats.fileCount) * 100) : 0;
                const labels: Record<string, string> = { drill_csv: "Drillhole CSV", pdf: "PDF", geophysics: "Geophysics", block_model: "Block Model", other: "Other" };
                return (
                  <div key={kind} className="flex items-center gap-3 text-xs">
                    <span className="w-24 text-muted-foreground truncate">{labels[kind] || kind}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-medium">{count}</span>
                  </div>
                );
              })}
              {Object.keys(stats.fileTypes).length === 0 && (
                <p className="text-xs text-muted-foreground/50">No files uploaded yet</p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-border/50 bg-card/30 p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Activity
            </h3>
            <div className="space-y-1.5">
              {stats.recentActivity.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2.5 py-1.5 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    item.type === "file" ? "bg-emerald-400" :
                    item.type === "chat" ? "bg-blue-400" : "bg-amber-400"
                  }`} />
                  <span className="flex-1 truncate">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground/50 shrink-0">
                    {new Date(item.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {stats.recentActivity.length === 0 && (
                <p className="text-xs text-muted-foreground/50">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
