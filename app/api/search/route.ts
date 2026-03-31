import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const pattern = `%${query}%`;

    // Search projects
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, description")
      .eq("owner_id", user.id)
      .ilike("name", pattern)
      .limit(5);

    // Search chats
    const { data: chats } = await supabase
      .from("chats")
      .select("id, title, project_id, projects(name)")
      .eq("created_by", user.id)
      .ilike("title", pattern)
      .limit(5);

    // Search files
    const { data: files } = await supabase
      .from("files")
      .select("id, filename, file_kind, project_id, projects(name)")
      .ilike("filename", pattern)
      .limit(5);

    // Search reports
    const { data: reports } = await supabase
      .from("reports")
      .select("id, title, project_id, projects(name)")
      .ilike("title", pattern)
      .limit(5);

    const results = [
      ...(projects || []).map((p) => ({
        type: "project" as const,
        id: p.id,
        title: p.name,
        subtitle: p.description || "",
        href: `/app/projects/${p.id}/chat`,
      })),
      ...(chats || []).map((c: any) => ({
        type: "chat" as const,
        id: c.id,
        title: c.title,
        subtitle: c.projects?.name || "",
        href: `/app/projects/${c.project_id}/chat?chatId=${c.id}`,
      })),
      ...(files || []).map((f: any) => ({
        type: "file" as const,
        id: f.id,
        title: f.filename,
        subtitle: `${f.file_kind} · ${f.projects?.name || ""}`,
        href: `/app/projects/${f.project_id}/files`,
      })),
      ...(reports || []).map((r: any) => ({
        type: "report" as const,
        id: r.id,
        title: r.title,
        subtitle: r.projects?.name || "",
        href: `/app/projects/${r.project_id}/reports`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
