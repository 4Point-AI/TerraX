"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { 
  Boxes,
  LayoutDashboard, 
  FolderOpen, 
  Settings, 
  LogOut,
  User as UserIcon,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import GlobalSearch from "@/components/app/GlobalSearch";
import OnboardingOverlay from "@/components/app/OnboardingOverlay";

interface AppLayoutProps {
  children: React.ReactNode;
  user: User;
}

const navigation = [
  { name: "Dashboard", href: "/app", icon: LayoutDashboard },
  { name: "Projects", href: "/app/projects", icon: FolderOpen },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export default function AppLayout({ children, user }: AppLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  }, []);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();
        if (profile && !profile.onboarding_completed) {
          setShowOnboarding(true);
        }
      } catch {
        // If column doesn't exist yet, skip onboarding
      }
    };
    checkOnboarding();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const sidebarContent = (
    <>
      <div className={cn("border-b border-dashed border-border/50 transition-all duration-300", collapsed ? "p-3" : "p-5")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center border border-dashed border-[rgba(188,132,88,0.56)] bg-[rgba(185,120,70,0.14)] flex-shrink-0">
              <Boxes className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-foreground">Terra-X</p>
                <p className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">by 4Point AI</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 border border-dashed border-transparent hover:border-border/40 hover:bg-muted/40 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <GlobalSearch />
        </div>
      )}

      <nav className={cn("flex-1 space-y-1 overflow-y-auto scrollbar-hide transition-all duration-300", collapsed ? "p-2" : "p-3")}>
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? item.name : undefined}
              className={cn(
                "flex items-center border border-dashed transition-all duration-200",
                collapsed ? "justify-center p-2.5" : "gap-3 px-4 py-2.5",
                isActive
                  ? "border-[rgba(188,132,88,0.52)] bg-[rgba(185,120,70,0.12)] text-primary"
                  : "border-transparent text-muted-foreground hover:border-border/45 hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{item.name}</span>}
            </Link>
          );
        })}
        <div className="hidden lg:block mt-2 pt-2 border-t border-dashed border-border/30">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center border border-dashed border-transparent transition-all duration-200 w-full text-muted-foreground/60 hover:border-border/45 hover:bg-muted/30 hover:text-muted-foreground",
              collapsed ? "justify-center p-2.5" : "gap-3 px-4 py-2"
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4 flex-shrink-0" /> : <PanelLeftClose className="h-4 w-4 flex-shrink-0" />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </nav>

      <div className={cn("border-t border-dashed border-border/50 transition-all duration-300", collapsed ? "p-2" : "p-3")}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-[9px] leading-tight text-center uppercase tracking-[0.12em] text-muted-foreground/70">Version 1.0</span>
            <div className="flex h-9 w-9 items-center justify-center border border-dashed border-border/45 bg-muted/20">
              <UserIcon className="h-4 w-4 text-primary" />
            </div>
            <button
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive transition-colors p-2 border border-dashed border-transparent hover:border-destructive/35 hover:bg-destructive/10"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border border-dashed border-border/40 bg-[rgba(255,255,255,0.02)] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Version 1.0</p>
            </div>
            <div className="flex items-center justify-between border border-dashed border-border/40 bg-muted/15 p-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center border border-dashed border-border/45 bg-muted/20 flex-shrink-0">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Active</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive transition-colors p-2 border border-dashed border-transparent hover:border-destructive/35 hover:bg-destructive/10"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b border-dashed border-border/50 bg-background/80 backdrop-blur-xl flex items-center px-4">
        <button onClick={() => setSidebarOpen(true)} className="p-2 border border-dashed border-transparent hover:border-border/40 hover:bg-muted/40 text-muted-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="flex h-7 w-7 items-center justify-center border border-dashed border-[rgba(188,132,88,0.56)] bg-[rgba(185,120,70,0.14)]">
            <Boxes className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-tight">Terra-X</span>
            <span className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">by 4Point AI</span>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 border-r border-dashed border-border/50 bg-card/80 backdrop-blur-xl flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "lg:w-[68px]" : "w-64",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-auto pt-14 lg:pt-0">{children}</main>

      {showOnboarding && (
        <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}
