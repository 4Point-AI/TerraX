-- ============================================
-- STEP 2: RLS Policies & Storage
-- Run this AFTER step 1 succeeds
-- ============================================

-- Drop existing policies so this is safe to rerun
DO $$
BEGIN
  -- profiles
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

  -- projects
  DROP POLICY IF EXISTS "Users can view projects they are members of" ON projects;
  DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
  DROP POLICY IF EXISTS "Project owners can update their projects" ON projects;
  DROP POLICY IF EXISTS "Project owners can delete their projects" ON projects;

  -- project_members
  DROP POLICY IF EXISTS "Users can view project members for their projects" ON project_members;
  DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;

  -- files
  DROP POLICY IF EXISTS "Users can view files in their projects" ON files;
  DROP POLICY IF EXISTS "Users can upload files to their projects" ON files;
  DROP POLICY IF EXISTS "Users can delete files from their projects" ON files;

  -- aoi
  DROP POLICY IF EXISTS "Users can view AOI in their projects" ON aoi;
  DROP POLICY IF EXISTS "Users can create AOI in their projects" ON aoi;
  DROP POLICY IF EXISTS "Users can update AOI in their projects" ON aoi;
  DROP POLICY IF EXISTS "Users can delete AOI in their projects" ON aoi;

  -- chats
  DROP POLICY IF EXISTS "Users can view chats in their projects" ON chats;
  DROP POLICY IF EXISTS "Users can create chats in their projects" ON chats;
  DROP POLICY IF EXISTS "Chat creators can update their chats" ON chats;
  DROP POLICY IF EXISTS "Chat creators can delete their chats" ON chats;

  -- chat_messages
  DROP POLICY IF EXISTS "Users can view messages in their chats" ON chat_messages;
  DROP POLICY IF EXISTS "Users can insert messages in their chats" ON chat_messages;
  DROP POLICY IF EXISTS "Users can delete messages in their chats" ON chat_messages;

  -- reports
  DROP POLICY IF EXISTS "Users can view reports in their projects" ON reports;
  DROP POLICY IF EXISTS "Users can create reports in their projects" ON reports;
  DROP POLICY IF EXISTS "Users can update reports in their projects" ON reports;
  DROP POLICY IF EXISTS "Users can delete reports in their projects" ON reports;

  -- leads
  DROP POLICY IF EXISTS "Anyone can insert leads" ON leads;
END $$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects RLS policies
CREATE POLICY "Users can view projects they are members of" ON projects FOR SELECT USING (
  owner_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())
);
CREATE POLICY "Users can insert their own projects" ON projects FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Project owners can update their projects" ON projects FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Project owners can delete their projects" ON projects FOR DELETE USING (owner_id = auth.uid());

-- Project members RLS policies
CREATE POLICY "Users can view project members for their projects" ON project_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.owner_id = auth.uid())
  OR user_id = auth.uid()
);
CREATE POLICY "Project owners can manage members" ON project_members FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = project_members.project_id AND projects.owner_id = auth.uid())
);

-- Files RLS policies
CREATE POLICY "Users can view files in their projects" ON files FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = files.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Users can upload files to their projects" ON files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = files.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid() AND project_members.role IN ('owner', 'editor'))))
);
CREATE POLICY "Users can delete files from their projects" ON files FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = files.project_id AND projects.owner_id = auth.uid()) OR uploader_id = auth.uid()
);

-- AOI RLS policies
CREATE POLICY "Users can view AOI in their projects" ON aoi FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = aoi.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Users can create AOI in their projects" ON aoi FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = aoi.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid() AND project_members.role IN ('owner', 'editor'))))
);
CREATE POLICY "Users can update AOI in their projects" ON aoi FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = aoi.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid() AND project_members.role IN ('owner', 'editor'))))
);
CREATE POLICY "Users can delete AOI in their projects" ON aoi FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = aoi.project_id AND projects.owner_id = auth.uid())
);

-- Chats RLS policies
CREATE POLICY "Users can view chats in their projects" ON chats FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = chats.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Users can create chats in their projects" ON chats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = chats.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Chat creators can update their chats" ON chats FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Chat creators can delete their chats" ON chats FOR DELETE USING (created_by = auth.uid());

-- Chat messages RLS policies
CREATE POLICY "Users can view messages in their chats" ON chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chats JOIN projects ON chats.project_id = projects.id WHERE chats.id = chat_messages.chat_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Users can insert messages in their chats" ON chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM chats JOIN projects ON chats.project_id = projects.id WHERE chats.id = chat_messages.chat_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Users can delete messages in their chats" ON chat_messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM chats JOIN projects ON chats.project_id = projects.id WHERE chats.id = chat_messages.chat_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);

-- Reports RLS policies
CREATE POLICY "Users can view reports in their projects" ON reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Users can create reports in their projects" ON reports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid())))
);
CREATE POLICY "Users can update reports in their projects" ON reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid() AND project_members.role IN ('owner', 'editor'))))
);
CREATE POLICY "Users can delete reports in their projects" ON reports FOR DELETE USING (
  EXISTS (SELECT 1 FROM projects WHERE projects.id = reports.project_id AND (projects.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid() AND project_members.role IN ('owner', 'editor'))))
);

-- Leads RLS policies (public insert, admin view)
CREATE POLICY "Anyone can insert leads" ON leads FOR INSERT WITH CHECK (true);

-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE: Storage policies on storage.objects must be created via
-- the Supabase Dashboard UI (Storage -> Policies), NOT via SQL Editor.
-- See schema_step2_STORAGE_NOTES.md or the instructions provided.
