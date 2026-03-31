import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, FolderOpen, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user?.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your exploration projects</p>
        </div>
        <Link href="/app/projects/new">
          <Button className="rounded-xl h-9 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
        </Link>
      </div>

      {projects && projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/app/projects/${project.id}/chat`}>
              <div className="group rounded-2xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-border p-5 transition-all duration-200 cursor-pointer h-full">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{project.name}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Created {formatDate(project.created_at)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors mt-0.5" />
                </div>
                {project.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-3 ml-[52px]">{project.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border/50">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-base font-semibold mb-1">No projects yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Create your first project to start analyzing geological data</p>
          <Link href="/app/projects/new">
            <Button className="rounded-xl h-9 text-xs">Create Project</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
