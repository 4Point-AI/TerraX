import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function normalizeEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

function isAlreadyRegisteredError(error: unknown): boolean {
  const msg = String((error as any)?.message || "").toLowerCase();
  return (
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    msg.includes("already exists")
  );
}

function isSchemaInviteError(error: unknown): boolean {
  const msg = String((error as any)?.message || "").toLowerCase();
  return msg.includes("invited_email") || msg.includes("status") || msg.includes("null value in column \"user_id\"");
}

function extractActionLink(generateLinkData: any): string | null {
  return (
    generateLinkData?.properties?.action_link ||
    generateLinkData?.action_link ||
    null
  );
}

// GET - List project members
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = params;

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) throw projectError;

    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Get members (without brittle per-column selects to avoid schema mismatch failures)
    const { data: members, error } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", projectId);

    if (error) {
      console.error("Failed to load project_members; falling back to owner-only payload", error);
    }

    const safeMembers = Array.isArray(members) ? members : [];

    const userIds = Array.from(
      new Set(
        [project.owner_id, ...(members || []).map((m: any) => m.user_id)].filter(Boolean)
      )
    ) as string[];

    const { data: profiles, error: profilesError } = userIds.length
      ? await supabase.from("profiles").select("*").in("id", userIds)
      : { data: [] as any[], error: null as any };

    if (profilesError) {
      console.error("Failed to load profiles; continuing with fallback names", profilesError);
    }

    const profileById = new Map((profiles || []).map((p: any) => [p.id, p]));
    const ownerProfile = profileById.get(project.owner_id);

    // Get owner's email from auth (we have it from our own user if we're the owner)
    const ownerEmail = project.owner_id === user.id ? user.email : null;

    const enrichedMembers = [
      {
        id: "owner",
        user_id: project.owner_id,
        role: "owner",
        status: "active",
        name: ownerProfile?.name || ownerProfile?.full_name || "Project Owner",
        email: ownerEmail,
      },
      ...safeMembers.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role || "viewer",
        status: m.status || "active",
        name: m.user_id
          ? (profileById.get(m.user_id)?.name || profileById.get(m.user_id)?.full_name || null)
          : null,
        email: m.invited_email || null,
      })),
    ];

    return NextResponse.json({ members: enrichedMembers, isOwner: project.owner_id === user.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Invite a member
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = params;
    const { email, role } = await request.json();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!["editor", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Role must be 'editor' or 'viewer'" }, { status: 400 });
    }

    // Verify ownership
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (!project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the project owner can invite members" }, { status: 403 });
    }

    // Check current invite/member row for this email in this project
    const { data: existing, error: existingError } = await supabase
      .from("project_members")
      .select("id, user_id, status, role, invited_email")
      .eq("project_id", projectId)
      .ilike("invited_email", normalizedEmail)
      .maybeSingle();

    if (existingError) {
      if (isSchemaInviteError(existingError)) {
        return NextResponse.json(
          { error: "Invites require the updated team schema. Run lib/supabase/schema_step4.sql in Supabase SQL editor." },
          { status: 500 }
        );
      }
      throw existingError;
    }

    if (existing?.status === "active" && existing?.user_id) {
      return NextResponse.json({
        success: true,
        status: "active",
        message: "User already a member",
      });
    }

    const wasExistingPending = existing?.status === "pending";

    // Ensure an invite row exists in pending state (idempotent for re-invites)
    let memberRow = existing;

    if (!memberRow) {
      const { error: insertError } = await supabase
        .from("project_members")
        .insert({
          project_id: projectId,
          invited_email: normalizedEmail,
          role,
          status: "pending",
        });

      if (insertError) {
        if (isSchemaInviteError(insertError)) {
          return NextResponse.json(
            { error: "Invites require the updated team schema. Run lib/supabase/schema_step4.sql in Supabase SQL editor." },
            { status: 500 }
          );
        }

        const msg = String(insertError.message || "").toLowerCase();
        if (msg.includes("duplicate") || (insertError as any).code === "23505") {
          const { data: conflictRow } = await supabase
            .from("project_members")
            .select("id, user_id, status, role, invited_email")
            .eq("project_id", projectId)
            .ilike("invited_email", normalizedEmail)
            .maybeSingle();
          memberRow = conflictRow || null;
        } else {
          throw insertError;
        }
      } else {
        const { data: insertedRow } = await supabase
          .from("project_members")
          .select("id, user_id, status, role, invited_email")
          .eq("project_id", projectId)
          .ilike("invited_email", normalizedEmail)
          .maybeSingle();
        memberRow = insertedRow || null;
      }
    }

    if (memberRow && memberRow.status !== "pending" && !(memberRow.status === "active" && memberRow.user_id)) {
      const { data: updatedRow } = await supabase
        .from("project_members")
        .update({
          status: "pending",
          role,
          invited_email: normalizedEmail,
        })
        .eq("id", memberRow.id)
        .select("id, user_id, status, role, invited_email")
        .maybeSingle();
      memberRow = updatedRow || memberRow;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Invite email is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 }
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const redirectTo = `${request.nextUrl.origin}/auth/callback`;

    let responseMessage = wasExistingPending
      ? "Invite already pending (resend attempted)"
      : `Invitation sent to ${normalizedEmail}`;
    let inviteLink: string | null = null;

    const { error: inviteEmailError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo,
      data: {
        project_id: projectId,
        invited_role: role,
        invited_by: user.id,
      },
    });

    if (!inviteEmailError) {
      responseMessage = wasExistingPending
        ? "Invite already pending (resend email sent)"
        : `Invitation sent to ${normalizedEmail}`;
    } else if (isAlreadyRegisteredError(inviteEmailError)) {
      const { data: linkData, error: generateLinkError } = await admin.auth.admin.generateLink({
        type: "invite",
        email: normalizedEmail,
        options: {
          redirectTo,
          data: {
            project_id: projectId,
            invited_role: role,
            invited_by: user.id,
          },
        },
      });

      inviteLink = !generateLinkError ? extractActionLink(linkData) : null;
      responseMessage = generateLinkError
        ? "Invite already pending (auth user exists). Could not generate resend link. Configure SMTP/email provider for delivery."
        : "Invite already pending (auth user exists). Email resend requires SMTP/email provider configuration.";
    } else {
      return NextResponse.json(
        { error: `Failed to send invite email: ${inviteEmailError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: memberRow?.status === "active" ? "active" : "pending",
      message: responseMessage,
      ...(process.env.NODE_ENV !== "production" && inviteLink ? { inviteLink } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { projectId } = params;
    const { memberId } = await request.json();

    // Verify ownership
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .single();

    if (!project || project.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the project owner can remove members" }, { status: 403 });
    }

    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("id", memberId)
      .eq("project_id", projectId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
