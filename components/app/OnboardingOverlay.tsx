"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Boxes, FolderPlus, Upload, MessageSquare, Map, Box, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";

interface OnboardingOverlayProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: Boxes,
    title: "Welcome to Terra-X",
    description: "Your AI-powered geological reasoning and exploration intelligence platform. Let's get you started in 60 seconds.",
    color: "from-primary to-orange-500",
  },
  {
    icon: FolderPlus,
    title: "Create a Project",
    description: "Start by creating a project for your exploration area. Each project organizes your files, chats, maps, and reports in one place.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Upload,
    title: "Upload Your Data",
    description: "Drop CSV drillhole data, PDFs, geophysics files, or any other exploration data. Terra-X automatically parses and understands your files.",
    color: "from-emerald-500 to-green-500",
  },
  {
    icon: MessageSquare,
    title: "Chat with Your Data",
    description: "Ask Terra-X to analyze your data, identify structural trends, assess drill orientation bias, or generate competing exploration hypotheses.",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: Map,
    title: "Map & 3D Views",
    description: "Draw Areas of Interest on the satellite map, visualize drillhole data in 3D, and let AI help you interpret spatial patterns.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Sparkles,
    title: "You're Ready!",
    description: "Start exploring. Terra-X thinks like a senior geologist combined with a quantitative analyst — challenge it, and it'll challenge you back.",
    color: "from-primary to-orange-500",
  },
];

export default function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleComplete = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("id", user.id);
      }
    } catch {
      // Non-critical, just dismiss
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleComplete} />
      
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="overflow-hidden border border-dashed border-border/50 bg-card shadow-2xl">
          <div className="flex items-center justify-center gap-1.5 pt-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted/40"
                }`}
              />
            ))}
          </div>

          <div className="p-8 text-center">
            <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-dashed border-[rgba(188,132,88,0.4)] bg-gradient-to-br ${current.color} shadow-lg`}>
              <current.icon className="h-8 w-8 text-white" />
            </div>
            
            <h2 className="text-xl font-bold tracking-tight mb-2">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {current.description}
            </p>
          </div>

          <div className="flex items-center justify-between px-8 pb-8">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Skip
              </button>
            )}

            {isLast ? (
              <Button onClick={handleComplete} className="gap-1.5">
                Get Started
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button onClick={() => setStep(step + 1)} className="gap-1.5">
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
