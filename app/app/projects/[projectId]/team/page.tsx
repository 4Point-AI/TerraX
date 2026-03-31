"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Crown, Pencil, Eye, Trash2, Loader2, Mail } from "lucide-react";

interface Member {
  id: string;
  user_id: string | null;
  role: string;
  status: string;
  name: string | null;
  email: string | null;
}

interface InviteResponse {
  success?: boolean;
  status?: "pending" | "active";
  message?: string;
  inviteLink?: string;
  error?: string;
}

export default function TeamPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [members, setMembers] = useState<Member[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devInviteLink, setDevInviteLink] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      setMembers(data.members || []);
      setIsOwner(data.isOwner || false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(null);
    setDevInviteLink(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = (await res.json()) as InviteResponse;

      // Backward-compatible UX: if backend still returns this specific error text,
      // treat it as non-fatal and mark invite as pending.
      const alreadyRegistered = String(data.error || "").toLowerCase().includes("already been registered")
        || String(data.error || "").toLowerCase().includes("already exists");

      if (!res.ok && !alreadyRegistered) {
        throw new Error(data.error || "Failed to invite");
      }

      if (alreadyRegistered) {
        setSuccess("Invite already pending (auth user exists). Resend attempted.");
      } else {
        setSuccess(data.message || `Invitation sent to ${inviteEmail.trim().toLowerCase()}`);
        if (data.inviteLink && process.env.NODE_ENV !== "production") {
          setDevInviteLink(data.inviteLink);
        }
      }

      setInviteEmail("");
      setShowInvite(false);
      await loadMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Remove this member from the project?")) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }
      await loadMembers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner": return <Crown className="h-3.5 w-3.5 text-amber-400" />;
      case "editor": return <Pencil className="h-3.5 w-3.5 text-primary" />;
      case "viewer": return <Eye className="h-3.5 w-3.5 text-muted-foreground" />;
      default: return null;
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      owner: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      editor: "bg-primary/10 text-primary border-primary/20",
      viewer: "bg-muted text-muted-foreground border-border",
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${styles[role] || styles.viewer}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isOwner && (
          <Button
            onClick={() => setShowInvite(!showInvite)}
            className="rounded-xl h-9 text-xs gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs opacity-70">dismiss</button>
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-400">
          {success}
          {devInviteLink && process.env.NODE_ENV !== "production" && (
            <div className="mt-2 text-[11px] text-emerald-300/90 break-all">
              <span className="opacity-80">Dev invite link:</span> {devInviteLink}
            </div>
          )}
          <button onClick={() => setSuccess(null)} className="ml-2 underline text-xs opacity-70">dismiss</button>
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 animate-in fade-in duration-300">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            Invite Team Member
          </h3>
          <form onSubmit={handleInvite} className="flex gap-3">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              disabled={inviting}
              className="h-9 rounded-xl bg-background/50 border-border/50 text-sm flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
              disabled={inviting}
              className="h-9 rounded-xl bg-background/50 border border-border/50 text-sm px-3 text-foreground"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <Button type="submit" disabled={inviting} className="rounded-xl h-9 text-xs shrink-0">
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send Invite"}
            </Button>
          </form>
        </div>
      )}

      {/* Members List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border/50 bg-card/30 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted/50 rounded" />
                  <div className="h-3 w-24 bg-muted/30 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="group rounded-2xl border border-border/50 bg-card/30 hover:bg-card/60 transition-all duration-200 p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  member.role === "owner"
                    ? "bg-gradient-to-br from-amber-500/20 to-amber-500/5"
                    : "bg-gradient-to-br from-primary/20 to-primary/5"
                }`}>
                  {getRoleIcon(member.role)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {member.name || member.email || "Pending"}
                    </p>
                    {getRoleBadge(member.role)}
                    {member.status === "pending" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                        pending
                      </span>
                    )}
                  </div>
                  {member.email && member.name && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{member.email}</p>
                  )}
                </div>
                {isOwner && member.role !== "owner" && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && members.length <= 1 && (
        <div className="text-center py-10 rounded-2xl border border-dashed border-border/50">
          <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">No team members yet</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Invite colleagues to collaborate on this project</p>
        </div>
      )}
    </div>
  );
}
