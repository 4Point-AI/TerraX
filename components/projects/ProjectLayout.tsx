"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Map, Box, FileText, FileUp, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project } from "@/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface ProjectLayoutProps {
  children: React.ReactNode;
  project: Project;
  projectId: string;
}

const projectNav = [
  { name: "Chat", href: "/chat", icon: MessageSquare },
  { name: "Files", href: "/files", icon: FileUp },
  { name: "Map", href: "/map", icon: Map },
  { name: "3D", href: "/3d", icon: Box },
  { name: "Reports", href: "/reports", icon: FileText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Team", href: "/team", icon: Users },
];

export default function ProjectLayout({ children, project, projectId }: ProjectLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h2 className="text-base font-semibold tracking-tight">{project.name}</h2>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-0.5 ml-5">{project.description}</p>
          )}
        </div>
        <div className="px-4">
          <nav className="flex gap-1">
            {projectNav.map((item) => {
              const href = `/app/projects/${projectId}${item.href}`;
              const isActive = pathname === href;
              return (
                <Link
                  key={item.name}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg rounded-b-none transition-all duration-200 relative",
                    isActive
                      ? "text-primary bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.name}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  );
}
