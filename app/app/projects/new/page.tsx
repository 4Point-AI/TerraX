"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FolderPlus } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          name,
          description: description || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      router.push(`/app/projects/${project.id}/chat`);
    } catch (error: any) {
      setError(error.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up a new exploration project</p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/30 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Project Details</h3>
            <p className="text-xs text-muted-foreground">Name and describe your project</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Project Name</label>
            <Input
              placeholder="e.g., Red Canyon Copper Exploration"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
              className="h-10 rounded-xl bg-muted/30 border-border/50 focus:border-primary/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description (Optional)</label>
            <Textarea
              placeholder="Brief description of the project location, commodity, and goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={4}
              className="rounded-xl bg-muted/30 border-border/50 focus:border-primary/30 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="rounded-xl h-9 text-xs">
              {loading ? "Creating..." : "Create Project"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
