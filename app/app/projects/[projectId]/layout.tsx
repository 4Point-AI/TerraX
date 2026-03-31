import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import ProjectLayout from "@/components/projects/ProjectLayout";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    notFound();
  }

  const hasAccess =
    project.owner_id === user.id ||
    (await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .single()).data !== null;

  if (!hasAccess) {
    notFound();
  }

  return (
    <ProjectLayout project={project} projectId={projectId}>
      {children}
    </ProjectLayout>
  );
}
