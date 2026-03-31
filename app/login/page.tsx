"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Boxes } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<"google" | "azure" | null>(null);
  const [error, setError] = useState("");

  const handleOAuthLogin = async (provider: "google" | "azure") => {
    setLoadingProvider(provider);
    setError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      setError(error.message || `Failed to sign in with ${provider === "google" ? "Google" : "Microsoft"}`);
      setLoadingProvider(null);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(185,120,70,0.16),transparent_32%),radial-gradient(circle_at_82%_10%,rgba(196,148,79,0.08),transparent_24%)]" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="space-y-5 text-center">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center border border-dashed border-[rgba(188,132,88,0.56)] bg-[rgba(185,120,70,0.14)]">
              <Boxes className="h-6 w-6 text-white" />
            </div>
            <div className="text-left leading-none">
              <span className="text-xl font-bold block tracking-tight">Terra-X</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground uppercase tracking-[0.14em]">by 4Point AI</span>
            </div>
          </Link>
          <div className="space-y-3">
            <p className="eyebrow-label">Free Workspace Access</p>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Sign up to Terra-X</h1>
              <p className="mt-2 text-sm text-muted-foreground">Access your geological reasoning workspace and continue your project analysis.</p>
            </div>
          </div>
        </div>

        <div className="panel-surface space-y-6 p-6 sm:p-7">
          <Button
            onClick={() => handleOAuthLogin("google")}
            className="w-full gap-2"
            disabled={loadingProvider !== null}
          >
            <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {loadingProvider === "google" ? "Signing in..." : "Continue with Google"}
          </Button>

          <Button
            onClick={() => handleOAuthLogin("azure")}
            variant="outline"
            className="w-full gap-2"
            disabled={loadingProvider !== null}
          >
            <svg className="mr-2.5 h-4 w-4" viewBox="0 0 23 23" aria-hidden="true">
              <path fill="currentColor" d="M1 1h10v10H1zM12 1h10v10H12zM1 12h10v10H1zM12 12h10v10H12z" />
            </svg>
            {loadingProvider === "azure" ? "Signing in..." : "Continue with Microsoft"}
          </Button>

          {error && (
            <div className="border border-dashed border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
