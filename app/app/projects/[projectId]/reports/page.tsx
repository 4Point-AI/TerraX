"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, Plus, Loader2, ChevronDown, FileCheck } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Report } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const reportTemplates = [
    {
      id: "general",
      name: "General Analysis",
      description: "Executive summary with key findings and recommendations",
      prompt: `Generate a structured technical report. Include:\n\n## Executive Summary\n## Key Findings\n## Data Quality Assessment\n## Geological Interpretation\n## Risks and Uncertainties\n## Recommended Next Steps`,
    },
    {
      id: "ni43101",
      name: "NI 43-101 Style",
      description: "Canadian mineral resource reporting standard format",
      prompt: `Generate a report following NI 43-101 structure. Include:\n\n## 1. Summary\n## 2. Introduction and Terms of Reference\n## 3. Property Description and Location\n## 4. Geological Setting and Mineralization\n## 5. Deposit Types\n## 6. Exploration\n## 7. Drilling\n## 8. Sample Preparation, Analyses and Security\n## 9. Data Verification\n## 10. Mineral Processing and Metallurgical Testing\n## 11. Mineral Resource Estimates\n## 12. Interpretation and Conclusions\n## 13. Recommendations\n\nBase all content on the conversation data. Where data is insufficient, note this clearly.`,
    },
    {
      id: "jorc",
      name: "JORC Style",
      description: "Australasian mineral reporting standard format",
      prompt: `Generate a report following JORC Code (2012) Table 1 structure. Include:\n\n## Section 1: Sampling Techniques and Data\n- Sampling techniques\n- Drilling techniques\n- Sample recovery\n- Sub-sampling techniques and sample preparation\n- Quality of assay data and laboratory tests\n\n## Section 2: Reporting of Exploration Results\n- Mineral tenement and land tenure status\n- Exploration done by other parties\n- Geology\n- Data aggregation methods\n- Relationship between mineralisation widths and intercept lengths\n\n## Section 3: Estimation and Reporting of Mineral Resources\n- Database integrity\n- Geological interpretation\n- Estimation and modelling techniques\n- Classification\n\nBase all content on the conversation data. Flag where information is insufficient for JORC compliance.`,
    },
    {
      id: "memo",
      name: "Technical Memo",
      description: "Concise internal technical memorandum",
      prompt: `Generate a concise technical memorandum. Include:\n\n## To / From / Date / Subject\n## Purpose\n## Background\n## Key Data Summary\n## Analysis & Findings\n## Conclusions\n## Action Items\n\nKeep it under 2 pages equivalent. Be direct and actionable.`,
    },
  ];
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadReports();
  }, [projectId]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("Delete this report?")) return;

    try {
      const { error } = await supabase.from("reports").delete().eq("id", reportId);

      if (error) throw error;

      await loadReports();
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete report");
    }
  };

  const handleExportHtml = async (report: Report) => {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "report-html", id: report.id }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        w.onload = () => {
          w.print();
        };
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      setError(err.message || "Export failed");
    }
  };

  const handleDownload = (report: Report) => {
    const blob = new Blob([report.content_markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateReport = async (templateId?: string) => {
    setGenerating(true);
    setError(null);
    setShowTemplates(false);
    const template = reportTemplates.find((t) => t.id === templateId) || reportTemplates[0];
    const templatePrompt = template.prompt;
    try {
      // Get most recent chat
      const { data: chats } = await supabase
        .from("chats")
        .select("id")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (!chats || chats.length === 0) {
        setError("No chat history found. Start a chat first.");
        return;
      }

      const chatId = chats[0].id;

      // Get chat messages
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (!messages || messages.length === 0) {
        setError("Chat is empty. Add some conversation first.");
        return;
      }

      // Build conversation transcript for the AI
      let transcript = "";
      messages.forEach((msg) => {
        transcript += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n\n`;
      });

      // Call AI to generate a structured report
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          chatId,
          messages: [
            {
              role: "user",
              content: `${templatePrompt}\n\nConversation transcript:\n\n${transcript}`,
            },
          ],
          selectedFileIds: [],
        }),
      });

      if (!response.ok) throw new Error("Failed to generate report from AI");

      const { response: aiReport } = await response.json();

      const reportContent = `# ${template.name} Report\n\nGenerated: ${new Date().toLocaleDateString()}\n\n${aiReport}`;

      // Create report
      const { error: insertError } = await supabase.from("reports").insert({
        project_id: projectId,
        chat_id: chatId,
        title: `${template.name} - ${new Date().toLocaleDateString()}`,
        content_markdown: reportContent,
      });

      if (insertError) throw insertError;

      await loadReports();
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Reports Sidebar */}
      <div className="w-72 border-r border-border/50 bg-card/30 flex flex-col">
        <div className="p-3">
          <div className="relative">
            <div className="flex gap-1">
              <Button
                onClick={() => generateReport()}
                disabled={generating}
                className="flex-1 gap-2 h-10 rounded-xl rounded-r-none bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all duration-200"
                variant="ghost"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {generating ? "Generating..." : "Generate"}
              </Button>
              <Button
                onClick={() => setShowTemplates(!showTemplates)}
                disabled={generating}
                className="h-10 w-10 rounded-xl rounded-l-none bg-primary/10 text-primary border border-primary/20 border-l-0 hover:bg-primary/20 transition-all duration-200 px-0"
                variant="ghost"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            {showTemplates && (
              <div className="absolute top-11 left-0 right-0 z-50 rounded-xl border border-border/50 bg-card shadow-xl overflow-hidden">
                {reportTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => generateReport(t.id)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-primary/10 transition-colors text-left"
                  >
                    <FileCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-3 mb-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-[11px] text-destructive">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-2 space-y-0.5">
          {loading ? (
            <div className="space-y-2 px-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border/50 bg-card/30 p-3">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : reports.length > 0 ? (
            reports.map((report) => (
              <div
                key={report.id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                  selectedReport?.id === report.id
                    ? "bg-primary/10 text-foreground border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent"
                }`}
                onClick={() => setSelectedReport(report)}
              >
                <FileText className="h-4 w-4 shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{report.title}</p>
                  <p className="text-[10px] opacity-50">{formatDate(report.created_at)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                <FileText className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-xs text-muted-foreground">No reports yet</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">Generate from chat conversations</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-auto">
        {selectedReport ? (
          <div className="p-6 md:p-8 max-w-3xl mx-auto">
            <div className="flex items-start justify-between mb-6 gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{selectedReport.title}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Generated {formatDate(selectedReport.created_at)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button onClick={() => handleExportHtml(selectedReport)} variant="outline" className="rounded-xl h-9 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export PDF
                </Button>
                <Button onClick={() => handleDownload(selectedReport)} variant="outline" className="rounded-xl h-9 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  .md
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-card/30 p-6 md:p-8">
              <div className="prose prose-invert prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-ul:text-foreground prose-ol:text-foreground prose-li:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedReport.content_markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground">Select a report to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
