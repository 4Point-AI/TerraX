"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, MessageSquare, FileText, File, X } from "lucide-react";

interface SearchResult {
  type: "project" | "chat" | "file" | "report";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "project": return <FolderOpen className="h-4 w-4 text-primary" />;
      case "chat": return <MessageSquare className="h-4 w-4 text-blue-400" />;
      case "file": return <File className="h-4 w-4 text-emerald-400" />;
      case "report": return <FileText className="h-4 w-4 text-amber-400" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent hover:border-border/50 transition-all duration-200"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left text-xs">Search...</span>
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 font-mono">⌘K</kbd>
      </button>

      {/* Search modal */}
      {mounted && open && createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-lg pointer-events-auto rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
              {/* Input */}
              <div className="flex items-center gap-3 px-4 border-b border-border/50">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search projects, chats, files, reports..."
                  className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-[50vh] overflow-auto">
                {query.length < 2 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground/50">
                    Type at least 2 characters to search
                  </div>
                ) : loading ? (
                  <div className="p-6 text-center text-xs text-muted-foreground/50">
                    Searching...
                  </div>
                ) : results.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground/50">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                ) : (
                  <div className="py-2">
                    {results.map((result, idx) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          idx === selectedIndex ? "bg-primary/10" : "hover:bg-muted/30"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                          {getIcon(result.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-[10px] text-muted-foreground truncate">{result.subtitle}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground/50 capitalize shrink-0">{result.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 border-t border-border/50 flex items-center gap-4 text-[10px] text-muted-foreground/40">
                <span><kbd className="font-mono">↑↓</kbd> Navigate</span>
                <span><kbd className="font-mono">↵</kbd> Select</span>
                <span><kbd className="font-mono">Esc</kbd> Close</span>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
