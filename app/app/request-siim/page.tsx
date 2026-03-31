"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rocket, CheckCircle } from "lucide-react";

export default function RequestSIIMPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  const validate = () => {
    const nextErrors: { name?: string; email?: string } = {};
    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedName) {
      nextErrors.name = "Name is required.";
    }

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("siim_deployment_requests").insert({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
      });

      if (error) throw error;
      setSubmitted(true);
      setFormData({ name: "", email: "" });
    } catch (error: any) {
      setError(error.message || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 md:p-8 max-w-md mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="panel-surface p-8 text-center w-full">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center border border-dashed border-[rgba(143,167,127,0.42)] bg-[rgba(143,167,127,0.12)]">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-2">Request submitted</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Thanks for your interest in SIIM deployment. Our team will review your request and contact you soon.
          </p>
          <Button onClick={() => (window.location.href = "/app")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const steps = [
    "We review your request and confirm fit.",
    "We contact you to scope deployment requirements.",
    "We prepare the next steps for a SIIM rollout.",
  ];

  const inputCls = "min-h-[44px] bg-[rgba(255,255,255,0.03)]";

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="space-y-3">
        <p className="eyebrow-label">Enterprise request</p>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-dashed border-[rgba(188,132,88,0.42)] bg-primary/10">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Request SIIM deployment</h1>
            <p className="mt-2 max-w-[58ch] text-sm text-muted-foreground">
              Submit your name and email to start a conversation about a Terra-X SIIM deployment for your organization.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="panel-surface p-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div className="border border-dashed border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.09em] text-muted-foreground">Name</label>
              <Input
                placeholder="Jane Smith"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: undefined }));
                }}
                required
                disabled={loading}
                className={inputCls}
                aria-invalid={Boolean(fieldErrors.name)}
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-[0.09em] text-muted-foreground">Email</label>
              <Input
                type="email"
                placeholder="jane@company.com"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
                }}
                required
                disabled={loading}
                className={inputCls}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Submitting..." : "Submit request"}
            </Button>
          </form>
        </div>

        <div className="panel-surface p-5">
          <h2 className="text-base font-semibold tracking-tight">What happens next</h2>
          <div className="mt-4 space-y-3">
            {steps.map((step, index) => (
              <div key={step} className="flex items-start gap-3 border-b border-dashed border-border/35 pb-3 last:border-b-0 last:pb-0">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border border-dashed border-[rgba(188,132,88,0.42)] bg-primary/10 text-[11px] font-semibold leading-none text-primary">
                  {index + 1}
                </div>
                <p className="pt-[1px] text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
