import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, FolderOpen, MessageSquare, Rocket, ChevronRight, Sparkles } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user?.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentChats } = await supabase
    .from("chats")
    .select(`
      *,
      projects (
        name
      )
    `)
    .eq("created_by", user?.id)
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back to your Terra-X workspace
          </p>
        </div>
        <Link href="/app/projects/new">
          <Button className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Recent Projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Recent Projects</h2>
          <Link href="/app/projects" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        {projects && projects.length > 0 ? (
          <div className="space-y-2">
            {projects.map((project) => (
              <Link key={project.id} href={`/app/projects/${project.id}/chat`}>
                <div className="group flex cursor-pointer items-center gap-3 border border-dashed border-border/50 bg-card/30 p-3.5 transition-all duration-200 hover:border-border hover:bg-card/60">
                  <div className="flex h-10 w-10 items-center justify-center border border-dashed border-[rgba(188,132,88,0.42)] bg-primary/10 shrink-0 group-hover:bg-primary/15 transition-colors">
                    <FolderOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{project.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-14 border border-dashed border-border/50 panel-surface">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center border border-dashed border-border/45 bg-muted/30">
              <FolderOpen className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">No projects yet</p>
            <Link href="/app/projects/new">
              <Button>Create Your First Project</Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-dashed border-border/50 bg-card/30 p-6 flex flex-col justify-between transition-all duration-200 hover:bg-card/60 hover:border-border">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center border border-dashed border-[rgba(188,132,88,0.42)] bg-primary/10 shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Max Plan</h3>
                <p className="text-xs text-muted-foreground">Full platform access</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-gradient mb-4">$2,000<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
            <ul className="space-y-2 text-xs mb-5">
              {["Unlimited projects", "Advanced 3D modeling", "500GB Storage", "API access"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <Button className="w-full" disabled>Coming Soon</Button>
        </div>

        <div className="border border-dashed border-border/50 bg-card/30 p-6 flex flex-col justify-between transition-all duration-200 hover:bg-card/60 hover:border-border">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center border border-dashed border-[rgba(188,132,88,0.42)] bg-primary/10 shrink-0">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">SIIM Deployment</h3>
                <p className="text-xs text-muted-foreground">Enterprise Spatial Intelligence</p>
              </div>
            </div>
            <div className="text-2xl font-bold text-gradient mb-4">$75,000<span className="text-xs font-normal text-muted-foreground"> base</span></div>
            <ul className="space-y-2 text-xs mb-5">
              {["Custom model training", "On-premise deployment", "Dedicated support team", "Full data integration (ArcGIS, Leapfrog, etc.)"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <Link href="/app/request-siim">
            <Button variant="outline" className="w-full">
              Request SIIM deployment
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {recentChats && recentChats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Recent Chats</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {recentChats.map((chat: any) => (
              <Link key={chat.id} href={`/app/projects/${chat.project_id}/chat?chatId=${chat.id}`}>
                <div className="group flex cursor-pointer items-center gap-3 border border-dashed border-border/50 bg-card/30 p-3 transition-all duration-200 hover:border-border hover:bg-card/60">
                  <div className="flex h-8 w-8 items-center justify-center border border-dashed border-border/40 bg-muted/50 shrink-0">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{chat.projects?.name}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
