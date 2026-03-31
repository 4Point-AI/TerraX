"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Mail } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setName(profile.name || "");
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name })
        .eq("id", user.id);

      if (error) throw error;

      setMessage({ type: "success", text: "Profile updated successfully" });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update profile" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account</p>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/30 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Profile Information</h3>
            <p className="text-xs text-muted-foreground">Update your personal details</p>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-5">
          {message && (
            <div className={`p-3 rounded-xl text-sm border ${
              message.type === "success"
                ? "bg-primary/10 border-primary/20 text-primary"
                : "bg-destructive/10 border-destructive/20 text-destructive"
            }`}>
              {message.text}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="h-10 rounded-xl bg-muted/30 border-border/50 focus:border-primary/30"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <div className="flex items-center gap-2.5 h-10 px-3 rounded-xl bg-muted/20 border border-border/30">
              <Mail className="h-4 w-4 text-muted-foreground/50" />
              <span className="text-sm text-muted-foreground">{user?.email}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/50">Email cannot be changed</p>
          </div>

          <Button type="submit" disabled={loading} className="rounded-xl h-9 text-xs">
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/30 p-6">
        <h3 className="text-sm font-semibold mb-1">Account</h3>
        <p className="text-xs text-muted-foreground">
          Created {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
        </p>
      </div>
    </div>
  );
}
