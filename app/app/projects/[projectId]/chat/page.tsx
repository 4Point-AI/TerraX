"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, MessageSquare, Trash2, Sparkles, ArrowUp, AlertTriangle, Box, Table2, Database, FileText, PanelRightClose, PanelRightOpen, ChevronDown, FileSpreadsheet, File, Hash, Rows3, Eye } from "lucide-react";
import { Chat, ChatMessage, FileRecord } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDate } from "@/lib/utils";

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const chatIdParam = searchParams.get("chatId");
  const messageParam = searchParams.get("message");

  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [fileDropdownOpen, setFileDropdownOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<"raw" | "details">("raw");
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const rawContentCache = useRef<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);
  const supabase = useMemo(() => createClient(), []);

  const previewFile = useMemo(() => files.find((f) => f.id === previewFileId) || null, [files, previewFileId]);
  const previewIsCsv = useMemo(
    () => !!previewFile?.filename?.toLowerCase().endsWith(".csv"),
    [previewFile]
  );
  const rawCsvHeaders = useMemo(() => {
    if (!previewIsCsv || !rawContent) return [] as string[];
    const headerLine = rawContent.split("\n")[0] || "";
    return headerLine
      .split(",")
      .map((h) => h.replace(/^"|"$/g, "").trim())
      .filter(Boolean);
  }, [previewIsCsv, rawContent]);
  const rawCsvApproxRows = useMemo(() => {
    if (!previewIsCsv || !rawContent) return 0;
    return Math.max(0, rawContent.split("\n").filter(Boolean).length - 1);
  }, [previewIsCsv, rawContent]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadChats();
    loadFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open file preview when AI is working and files exist
  useEffect(() => {
    if (loading && files.length > 0 && !previewOpen) {
      setPreviewOpen(true);
      if (!previewFileId && files.length > 0) {
        setPreviewFileId(files[0].id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Keep file metadata fresh while preview is open (so parse updates appear without manual reload)
  useEffect(() => {
    if (!previewOpen) return;
    loadFiles();
    const t = setInterval(() => {
      loadFiles();
    }, 4000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, projectId]);

  // Fetch raw file content when preview file changes
  useEffect(() => {
    if (!previewFileId || !previewOpen) return;
    const file = files.find((f) => f.id === previewFileId);
    if (!file) return;

    // Only fetch text-readable files under 2MB
    const lowerFilename = file.filename.toLowerCase();
    const isTextFile = ["drill_csv", "pdf", "other"].includes(file.file_kind) &&
      (lowerFilename.endsWith(".csv") || lowerFilename.endsWith(".txt") || lowerFilename.endsWith(".json") || lowerFilename.endsWith(".xyz") || lowerFilename.endsWith(".las"));
    if (!isTextFile || file.size_bytes > 2 * 1024 * 1024) {
      setRawContent(null);
      return;
    }

    // Use cache if available
    if (rawContentCache.current[previewFileId]) {
      setRawContent(rawContentCache.current[previewFileId]);
      return;
    }

    const fetchRaw = async () => {
      setRawLoading(true);
      try {
        const { data, error: dlErr } = await supabase.storage
          .from("project-files")
          .download(file.storage_path);
        if (dlErr || !data) { setRawContent(null); return; }
        const text = await data.text();
        rawContentCache.current[previewFileId] = text;
        setRawContent(text);
      } catch {
        setRawContent(null);
      } finally {
        setRawLoading(false);
      }
    };
    fetchRaw();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewFileId, previewOpen]);

  useEffect(() => {
    if (chatId) {
      loadMessages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (messageParam && chatId && input === "") {
      setInput(messageParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageParam, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChats = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("chats")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;
      setChats(data || []);

      if (chatIdParam) {
        setChatId(chatIdParam);
      } else if (data && data.length > 0) {
        setChatId(data[0].id);
      } else {
        await createNewChat();
      }
    } catch (err) {
      console.error("Error loading chats:", err);
    }
  };

  const createNewChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("chats")
        .insert({ project_id: projectId, created_by: user.id, title: "New Chat" })
        .select()
        .single();

      if (error) throw error;
      setChats((prev) => [data, ...prev]);
      setChatId(data.id);
      setMessages([]);
    } catch (err) {
      console.error("Error creating chat:", err);
    }
  };

  const deleteChat = async (id: string) => {
    try {
      await supabase.from("chats").delete().eq("id", id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (chatId === id) {
        const remaining = chats.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setChatId(remaining[0].id);
        } else {
          await createNewChat();
        }
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
    }
  };

  const loadFiles = async () => {
    try {
      const { data } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (data) {
        setFiles(data);
        if (data.length > 0 && !previewFileId) setPreviewFileId(data[0].id);
      }
    } catch (err) {
      console.error("Error loading files:", err);
    }
  };

  const loadMessages = async () => {
    if (!chatId) return;
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !chatId) return;
    setError(null);

    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      chat_id: chatId,
      role: "user",
      content: userMessage,
      artifacts: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Save user message to DB with error handling
      const { error: userInsertError } = await supabase.from("chat_messages").insert({ chat_id: chatId, role: "user", content: userMessage });
      if (userInsertError) {
        console.error("Failed to save user message:", userInsertError);
        throw new Error("Failed to save message: " + userInsertError.message);
      }

      // Update chat timestamp
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);

      const { data: files } = await supabase.from("files").select("id").eq("project_id", projectId);

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId, chatId,
          messages: [...messages, tempUserMsg],
          selectedFileIds: files?.map((f) => f.id) || [],
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to get response");
      }
      const { response: aiResponse, artifacts } = await response.json();

      // Add assistant message optimistically for immediate UI feedback
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        chat_id: chatId,
        role: "assistant",
        content: aiResponse,
        artifacts,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Reload from DB in background to confirm persistence and get real IDs
      setTimeout(() => loadMessages(), 500);

      if (messages.length === 0) {
        const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : "");
        await supabase.from("chats").update({ title }).eq("id", chatId);
        setChats((prev) => prev.map((c) => c.id === chatId ? { ...c, title } : c));
      }
    } catch (err: any) {
      console.error("Chat submit error:", err);
      setError(err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    { icon: <Database className="h-4 w-4 text-primary" />, text: "Analyze drillhole data and summarize key findings" },
    { icon: <Sparkles className="h-4 w-4 text-primary" />, text: "Generate an exploration hypothesis from available data" },
    { icon: <AlertTriangle className="h-4 w-4 text-primary" />, text: "What data quality issues should I be aware of?" },
    { icon: <Box className="h-4 w-4 text-primary" />, text: "Create a 3D visualization of the drillhole data" },
  ];

  const fileKindIcon = (kind: string) => {
    switch (kind) {
      case "drill_csv": return <FileSpreadsheet className="h-3.5 w-3.5" />;
      case "pdf": return <FileText className="h-3.5 w-3.5" />;
      default: return <File className="h-3.5 w-3.5" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="flex h-full">
      {/* Chat Sidebar */}
      <div className="w-72 border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-3">
          <Button onClick={createNewChat} className="w-full gap-2 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all duration-200" variant="ghost">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2 space-y-0.5">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                chatId === chat.id
                  ? "bg-primary/10 text-foreground border border-primary/20"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent"
              }`}
              onClick={() => setChatId(chat.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium">{chat.title}</p>
                <p className="text-[10px] opacity-50">{formatDate(chat.updated_at || chat.created_at)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Main Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${previewOpen ? "" : ""}`}>
        {/* Top bar with file preview toggle */}
        {files.length > 0 && (
          <div className="flex items-center justify-end px-4 py-2 border-b border-border/30">
            <button
              onClick={() => {
                setPreviewOpen((p) => !p);
                if (!previewOpen) loadFiles();
                if (!previewFileId && files.length > 0) setPreviewFileId(files[0].id);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                previewOpen
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              File Preview
              {previewOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 border border-primary/20">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">What can I help you with?</h3>
              <p className="text-muted-foreground mb-8 text-center max-w-md">
                Ask about your geological data, generate hypotheses, or request analysis
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(s.text)}
                    className="flex items-start gap-3 p-4 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      {s.icon}
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-5 py-3"
                      : "rounded-2xl rounded-bl-md"
                  }`}>
                    {message.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                    )}

                {previewFile && !previewFile.parsed_summary?.columns && rawCsvHeaders.length > 0 && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20 border-b border-border/50">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Columns from Raw Preview ({rawCsvHeaders.length})</span>
                    </div>
                    <div className="p-2 flex flex-wrap gap-1.5">
                      {rawCsvHeaders.map((col, i) => (
                        <span key={i} className="px-2 py-1 rounded-md bg-muted/30 text-[11px] font-mono">{col}</span>
                      ))}
                    </div>
                  </div>
                )}
                    {/* Risk Flags */}
                    {message.artifacts?.riskFlags && message.artifacts.riskFlags.length > 0 && (
                      <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Risks & Uncertainties
                        </div>
                        {message.artifacts.riskFlags.map((flag: string, idx: number) => (
                          <p key={idx} className="text-[11px] text-amber-300/80 leading-relaxed">• {flag}</p>
                        ))}
                      </div>
                    )}

                    {/* Scene Spec - View in 3D */}
                    {message.artifacts?.sceneSpec && (
                      <button
                        onClick={() => router.push(`/app/projects/${projectId}/3d`)}
                        className="mt-4 w-full flex items-center gap-2.5 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all duration-200 text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                          <Box className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-primary">3D Scene Available</p>
                          <p className="text-[10px] text-primary/60">
                            {message.artifacts.sceneSpec.drillholes?.collar?.length || 0} drillholes detected — View in 3D
                          </p>
                        </div>
                      </button>
                    )}

                    {/* Extracted Tables */}
                    {message.artifacts?.table && message.artifacts.table.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {message.artifacts.table.map((t: any, idx: number) => (
                          <div key={idx} className="rounded-xl border border-border/50 overflow-hidden">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20 border-b border-border/50">
                              <Table2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground font-medium">Data Table ({t.rows?.length || 0} rows)</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="border-b border-border/30">
                                    {t.headers?.map((h: string, hi: number) => (
                                      <th key={hi} className="px-3 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {t.rows?.slice(0, 20).map((row: Record<string, string>, ri: number) => (
                                    <tr key={ri} className="border-b border-border/20 hover:bg-muted/10">
                                      {t.headers?.map((h: string, hi: number) => (
                                        <td key={hi} className="px-3 py-1.5 whitespace-nowrap">{row[h]}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Followup Suggestions */}
                    {message.artifacts?.followups && message.artifacts.followups.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {message.artifacts.followups.map((followup: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setInput(followup)}
                            className="px-3 py-1.5 text-xs rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all duration-200"
                          >
                            {followup}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="bg-card/50 border border-border/50 rounded-2xl rounded-bl-md px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4">
          <div className="max-w-3xl mx-auto">
            {error && (
              <div className="mb-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="relative">
              <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10 transition-all duration-300 overflow-hidden">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message Terra-X..."
                  className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[52px] max-h-[200px] py-3.5 px-4 text-sm"
                  rows={1}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <div className="flex items-center justify-between px-3 pb-2">
                  <p className="text-[10px] text-muted-foreground/50">Shift + Enter for new line</p>
                  <Button
                    type="submit"
                    disabled={loading || !input.trim() || !chatId}
                    size="icon"
                    className="h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-30 transition-all duration-200"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* File Preview Panel */}
      {previewOpen && files.length > 0 && (
        <div className="w-[420px] border-l border-border/50 bg-card/30 flex flex-col animate-in slide-in-from-right-5 duration-300">
          {/* Header */}
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">File Preview</span>
            </div>
            <button
              onClick={() => setPreviewOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          </div>

          {/* File Selector */}
          <div className="px-3 pt-3 relative">
            <button
              onClick={() => setFileDropdownOpen((p) => !p)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {previewFile && fileKindIcon(previewFile.file_kind)}
                <span className="text-sm truncate">{previewFile?.filename || "Select file"}</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${fileDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {fileDropdownOpen && (
              <div className="absolute top-full left-3 right-3 mt-1 z-10 bg-card border border-border/50 rounded-xl shadow-lg overflow-hidden">
                {files.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setPreviewFileId(f.id); setFileDropdownOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors ${
                      f.id === previewFileId ? "bg-primary/10 text-primary" : "text-foreground"
                    }`}
                  >
                    {fileKindIcon(f.file_kind)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{f.filename}</p>
                      <p className="text-[10px] text-muted-foreground">{f.file_kind} · {formatBytes(f.size_bytes)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tab Toggle */}
          <div className="px-3 pt-3 flex gap-1 bg-muted/10 mx-3 mt-3 rounded-xl p-1">
            <button
              onClick={() => setPreviewTab("raw")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
                previewTab === "raw" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Raw File
            </button>
            <button
              onClick={() => setPreviewTab("details")}
              className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition-all ${
                previewTab === "details" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Details
            </button>
          </div>

          {/* File Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide">
            {previewFile ? (
              <>
                {/* RAW TAB */}
                {previewTab === "raw" && (
                  <>
                    {rawLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      </div>
                    ) : rawContent ? (
                      previewFile.filename.toLowerCase().endsWith(".csv") ? (
                        /* CSV rendered as table */
                        <div className="rounded-xl border border-border/50 overflow-hidden">
                          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
                            <table className="w-full text-[10px]">
                              <thead className="sticky top-0 bg-card z-10">
                                <tr className="border-b border-border/50">
                                  {rawContent.split("\n")[0]?.split(",").map((h, i) => (
                                    <th key={i} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h.replace(/^"|"$/g, "").trim()}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {rawContent.split("\n").slice(1, 200).filter(Boolean).map((row, ri) => (
                                  <tr key={ri} className="border-b border-border/20 hover:bg-muted/10">
                                    {row.split(",").map((cell, ci) => (
                                      <td key={ci} className="px-2 py-1 whitespace-nowrap font-mono">{cell.replace(/^"|"$/g, "").trim()}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {rawContent.split("\n").length > 201 && (
                            <div className="px-3 py-2 bg-muted/10 border-t border-border/30 text-[10px] text-muted-foreground text-center">
                              Showing first 200 of {(rawContent.split("\n").length - 1).toLocaleString()} rows
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Other text files rendered as monospace */
                        <div className="rounded-xl border border-border/50 overflow-hidden">
                          <div className="overflow-auto max-h-[calc(100vh-280px)] p-3">
                            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{rawContent.slice(0, 50000)}</pre>
                            {rawContent.length > 50000 && (
                              <p className="text-[10px] text-primary/60 mt-2">... ({(rawContent.length - 50000).toLocaleString()} more characters)</p>
                            )}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-3">
                          <File className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">Raw preview not available</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">Large/binary files are shown in Details after parsing.</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">If you just parsed this file in Files tab, wait a few seconds or reopen preview.</p>
                      </div>
                    )}
                  </>
                )}

                {/* DETAILS TAB */}
                {previewTab === "details" && (
                  <>
                {/* File Metadata */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</p>
                    <p className="text-xs font-medium mt-0.5">{previewFile.file_kind}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Size</p>
                    <p className="text-xs font-medium mt-0.5">{formatBytes(previewFile.size_bytes)}</p>
                  </div>
                  {previewFile.parsed_summary?.totalRows && (
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rows</p>
                      <p className="text-xs font-medium mt-0.5">{previewFile.parsed_summary.totalRows.toLocaleString()}</p>
                    </div>
                  )}
                  {!previewFile.parsed_summary?.totalRows && rawCsvApproxRows > 0 && (
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Rows (preview)</p>
                      <p className="text-xs font-medium mt-0.5">{rawCsvApproxRows.toLocaleString()}</p>
                    </div>
                  )}
                  {previewFile.parsed_summary?.columns && (
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Columns</p>
                      <p className="text-xs font-medium mt-0.5">{previewFile.parsed_summary.columns.length}</p>
                    </div>
                  )}
                  {!previewFile.parsed_summary?.columns && rawCsvHeaders.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Columns (preview)</p>
                      <p className="text-xs font-medium mt-0.5">{rawCsvHeaders.length}</p>
                    </div>
                  )}
                  {previewFile.parsed_summary?.pages && (
                    <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pages</p>
                      <p className="text-xs font-medium mt-0.5">{previewFile.parsed_summary.pages}</p>
                    </div>
                  )}
                </div>

                {/* Drillhole / Coordinates badges */}
                {previewFile.parsed_summary && (
                  <div className="flex flex-wrap gap-1.5">
                    {previewFile.parsed_summary.isDrillhole && (
                      <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20">Drillhole Data</span>
                    )}
                    {previewFile.parsed_summary.hasCoordinates && (
                      <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20">Has Coordinates</span>
                    )}
                    {previewFile.parsed_summary.hasAssays && (
                      <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-medium border border-purple-500/20">Has Assays</span>
                    )}
                  </div>
                )}

                {/* Column List */}
                {previewFile.parsed_summary?.columns && previewFile.parsed_summary.columns.length > 0 && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20 border-b border-border/50">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Columns ({previewFile.parsed_summary.columns.length})</span>
                    </div>
                    <div className="p-2 flex flex-wrap gap-1.5">
                      {previewFile.parsed_summary.columns.map((col, i) => (
                        <span key={i} className="px-2 py-1 rounded-md bg-muted/30 text-[11px] font-mono">{col}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sample Data Table */}
                {previewFile.parsed_summary?.sampleRows && previewFile.parsed_summary.sampleRows.length > 0 && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20 border-b border-border/50">
                      <Rows3 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Sample Data (first {Math.min(previewFile.parsed_summary.sampleRows.length, 15)} rows)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="border-b border-border/30">
                            {previewFile.parsed_summary.columns?.map((h, hi) => (
                              <th key={hi} className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewFile.parsed_summary.sampleRows.slice(0, 15).map((row, ri) => (
                            <tr key={ri} className="border-b border-border/20 hover:bg-muted/10">
                              {previewFile.parsed_summary?.columns?.map((h, hi) => (
                                <td key={hi} className="px-2 py-1 whitespace-nowrap font-mono">{row[h] ?? ""}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* PDF Extracted Text */}
                {previewFile.parsed_summary?.extractedText && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20 border-b border-border/50">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Extracted Text</span>
                    </div>
                    <div className="p-3 max-h-[400px] overflow-y-auto">
                      <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                        {previewFile.parsed_summary.extractedText.slice(0, 5000)}
                        {previewFile.parsed_summary.extractedText.length > 5000 && (
                          <span className="text-primary/60">\n... ({(previewFile.parsed_summary.extractedText.length - 5000).toLocaleString()} more characters)</span>
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {previewFile.parsed_summary?.summary && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted/20 border-b border-border/50">
                      <Sparkles className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground font-medium">Parsed Summary</span>
                    </div>
                    <div className="p-3">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{previewFile.parsed_summary.summary}</p>
                    </div>
                  </div>
                )}

                {/* No parsed data */}
                {!previewFile.parsed_summary && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted/20 flex items-center justify-center mb-3">
                      <File className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">Structured details unavailable</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      This file can still be used in chat. Full structured stats appear after parsing.
                    </p>
                  </div>
                )}
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">Select a file to preview</p>
              </div>
            )}
          </div>

          {/* Loading indicator when AI is working */}
          {loading && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/20">
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                <span className="text-[11px] text-primary font-medium">AI is analyzing this data...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
