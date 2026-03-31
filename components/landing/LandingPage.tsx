"use client";

import Image from "next/image";
import Link from "next/link";
import homepageImage from "../../homepage.png";
import { Button } from "@/components/ui/button";
import { Boxes, Map, Box, Database, Layers, ChevronRight } from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: Database,
      title: "Structured geological reasoning",
      desc: "Convert drill logs, PDFs, maps, and project notes into a consistent technical workspace with traceable AI summaries.",
    },
    {
      icon: Map,
      title: "Spatial interpretation workflows",
      desc: "Review targets in map context, define areas of interest, and move from raw evidence to defensible exploration hypotheses faster.",
    },
    {
      icon: Box,
      title: "3D-ready exploration context",
      desc: "Connect datasets to visual interpretation so teams can evaluate structure, continuity, and next-step drilling with more confidence.",
    },
  ];

  const proofPoints = [
    "Technical workspace for geologists and exploration teams",
    "Project-centric reasoning across files, maps, chats, and reports",
    "Built for faster interpretation, cleaner handoff, and better decisions",
  ];

  const metrics = [
    { value: "Files, maps, and chat", label: "in one exploration workspace" },
    { value: "Faster interpretation", label: "from raw data to decision support" },
    { value: "Enterprise path available", label: "via SIIM deployment requests" },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-dashed border-border/70 bg-[rgba(12,11,10,0.84)] backdrop-blur-xl">
        <div className="page-shell flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center border border-dashed border-[rgba(188,132,88,0.56)] bg-[rgba(185,120,70,0.14)]">
              <Boxes className="h-5 w-5 text-white" />
            </div>
            <div className="flex min-w-0 flex-col leading-none">
              <span className="block text-lg font-bold tracking-tight">Terra-X</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">by 4Point AI</span>
            </div>
          </div>
          <Link href="/login" className="shrink-0">
            <Button className="px-5">Sign in</Button>
          </Link>
        </div>
      </nav>

      <main>
        <section className="relative py-[clamp(4.2rem,8vw,6rem)]">
          <div className="page-shell relative section-grid grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
            <div className="relative z-10 max-w-3xl space-y-8">
              <div className="space-y-4">
                <div className="eyebrow-label">
                  <span className="h-1.5 w-1.5 bg-[var(--color-accent)]" />
                  Geological reasoning platform
                </div>
                <div className="space-y-5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Terra-X by 4Point AI</p>
                  <h1 className="max-w-[12ch] text-balance text-left text-[clamp(2.6rem,6.2vw,4.25rem)] font-bold text-foreground lg:text-[3.95vw]">
                    Make exploration decisions with sharper geological context.
                  </h1>
                  <p className="max-w-[62ch] text-left text-muted-foreground">
                    Terra-X gives exploration teams a disciplined workspace for interpreting datasets, synthesizing evidence, and producing clearer technical outputs across maps, files, chats, and reports.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/login">
                  <Button className="w-full gap-2 sm:w-auto">
                    Get started
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {metrics.map((metric) => (
                  <div key={metric.value} className="panel-surface px-4 py-5">
                    <strong className="block font-[var(--font-display)] text-base font-semibold tracking-[-0.02em] text-foreground">{metric.value}</strong>
                    <span className="mt-2 block text-sm text-muted-foreground">{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 flex h-full min-h-[28rem] flex-col justify-end gap-4 lg:min-h-[40rem]">
              <div className="relative aspect-[4/3] overflow-hidden border border-dashed border-border/35 bg-transparent shadow-[0_24px_60px_rgba(0,0,0,0.22)] lg:absolute lg:left-[-15%] lg:right-[4%] lg:top-[15%] lg:scale-[1.08]">
                <div className="relative h-full w-full overflow-hidden bg-transparent">
                  <Image
                    src={homepageImage}
                    alt="Terra-X homepage preview"
                    fill
                    className="object-cover object-center"
                    sizes="(min-width: 1280px) 52vw, (min-width: 1024px) 48vw, 100vw"
                    quality={100}
                    priority
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(12,11,10,0.02)_0%,rgba(12,11,10,0)_38%,rgba(12,11,10,0.1)_100%)]" />
                </div>
              </div>

              <div className="panel-surface p-6 sm:p-7 lg:mt-auto">
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-dashed border-border/70 pb-4">
                    <div>
                      <p className="caption-text text-muted-foreground">What Terra-X does</p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">A focused AI workflow for technical teams</h2>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center border border-dashed border-[rgba(188,132,88,0.5)] bg-[rgba(185,120,70,0.12)]">
                      <Layers className="h-5 w-5 text-primary" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {proofPoints.map((point) => (
                      <div key={point} className="flex items-start gap-3 border-b border-dashed border-border/35 pb-3 last:border-b-0 last:pb-0">
                        <span className="tight-list-bullet" />
                        <p className="text-sm text-muted-foreground">{point}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(185,120,70,0.18),transparent_32%),radial-gradient(circle_at_84%_10%,rgba(196,148,79,0.08),transparent_24%)]" />
        </section>

        <section className="py-[clamp(4.2rem,8vw,6rem)]">
          <div className="page-shell grid gap-4 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="panel-surface p-6 sm:p-7">
                <div className="mb-5 flex h-12 w-12 items-center justify-center border border-dashed border-[rgba(188,132,88,0.56)] bg-[rgba(185,120,70,0.12)]">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-[clamp(4.2rem,8vw,6rem)]">
          <div className="page-shell panel-surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
            <div className="space-y-4">
              <p className="caption-text text-muted-foreground">Why teams use Terra-X</p>
              <h2 className="max-w-[18ch] text-balance text-left text-[clamp(2rem,3.1vw,2.95rem)] font-bold tracking-[-0.03em] text-foreground">A cleaner path from fragmented project data to technical action.</h2>
              <p className="max-w-[60ch] text-muted-foreground">
                Terra-X is designed to reduce friction between data intake, geological interpretation, and decision support. It helps teams keep context together and move faster without sacrificing technical clarity.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "Organize project evidence around a single workspace.",
                "Interrogate data with AI while keeping the geological frame visible.",
                "Generate clearer outputs for internal review and downstream execution.",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3 border border-dashed border-border/60 bg-[rgba(255,255,255,0.02)] px-4 py-4">
                  <div className="flex h-8 w-8 items-center justify-center border border-dashed border-[rgba(188,132,88,0.56)] bg-[rgba(185,120,70,0.12)] text-sm font-semibold text-primary">
                    0{index + 1}
                  </div>
                  <p className="text-sm text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-dashed border-border/70 bg-[rgba(17,13,10,0.92)]">
          <div className="page-shell flex flex-col gap-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-[var(--font-display)] text-base font-semibold tracking-[-0.02em] text-foreground">Terra-X by 4Point AI</p>
              <p className="mt-1 text-sm text-muted-foreground">AI-powered geological reasoning, spatial interpretation, and exploration decision support.</p>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full sm:w-auto">Access workspace</Button>
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
