-- =========================================================
-- FIX: Remove RLS recursion between projects <-> project_members
-- Keeps member access while breaking circular policy evaluation
-- Also adds missing onboarding_completed column to profiles
-- =========================================================

-- 0) Add missing column that the app expects
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- 1) Drop the recursive policies
DROP POLICY IF EXISTS "Users can view projects they are members of" ON public.projects;
DROP POLICY IF EXISTS "Users can view project members for their projects" ON public.project_members;

-- Also drop policies that directly depended on the recursive pattern
DROP POLICY IF EXISTS "Users can view files in their projects" ON public.files;
DROP POLICY IF EXISTS "Users can upload files to their projects" ON public.files;
DROP POLICY IF EXISTS "Users can delete files from their projects" ON public.files;

DROP POLICY IF EXISTS "Users can view AOI in their projects" ON public.aoi;
DROP POLICY IF EXISTS "Users can create AOI in their projects" ON public.aoi;
DROP POLICY IF EXISTS "Users can update AOI in their projects" ON public.aoi;
DROP POLICY IF EXISTS "Users can delete AOI in their projects" ON public.aoi;

DROP POLICY IF EXISTS "Users can view chats in their projects" ON public.chats;
DROP POLICY IF EXISTS "Users can create chats in their projects" ON public.chats;

DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.chat_messages;

DROP POLICY IF EXISTS "Users can view reports in their projects" ON public.reports;
DROP POLICY IF EXISTS "Users can create reports in their projects" ON public.reports;


-- 2) Create a SECURITY DEFINER helper function that checks membership
-- This runs with definer privileges and avoids RLS recursion
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id = p_user_id
  );
$$;

-- Hardening: only authenticated users can call this function
REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;


-- 3) Recreate NON-recursive policies using the helper function

-- Projects: owners OR members can view
CREATE POLICY "Users can view projects they are members of"
ON public.projects
FOR SELECT
USING (
  owner_id = auth.uid()
  OR public.is_project_member(id, auth.uid())
);

-- Project members: owners can view all members, users can see their own rows
CREATE POLICY "Users can view project members for their projects"
ON public.project_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = project_members.project_id
      AND p.owner_id = auth.uid()
  )
);

-- Files
CREATE POLICY "Users can view files in their projects"
ON public.files
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = files.project_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

CREATE POLICY "Users can upload files to their projects"
ON public.files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = files.project_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner','editor')
        )
      )
  )
);

-- Files: DELETE (project owner OR uploader)
CREATE POLICY "Users can delete files from their projects"
ON public.files
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = files.project_id
      AND p.owner_id = auth.uid()
  )
  OR uploader_id = auth.uid()
);

-- AOI
CREATE POLICY "Users can view AOI in their projects"
ON public.aoi
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = aoi.project_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

CREATE POLICY "Users can create AOI in their projects"
ON public.aoi
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = aoi.project_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner','editor')
        )
      )
  )
);

CREATE POLICY "Users can update AOI in their projects"
ON public.aoi
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = aoi.project_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner','editor')
        )
      )
  )
);

CREATE POLICY "Users can delete AOI in their projects"
ON public.aoi
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = aoi.project_id
      AND p.owner_id = auth.uid()
  )
);

-- Chats
CREATE POLICY "Users can view chats in their projects"
ON public.chats
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = chats.project_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

CREATE POLICY "Users can create chats in their projects"
ON public.chats
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = chats.project_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

-- Chat messages
CREATE POLICY "Users can view messages in their chats"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.chats c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = chat_messages.chat_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

CREATE POLICY "Users can insert messages in their chats"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chats c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = chat_messages.chat_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

-- Reports
CREATE POLICY "Users can view reports in their projects"
ON public.reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = reports.project_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);

CREATE POLICY "Users can create reports in their projects"
ON public.reports
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = reports.project_id
      AND (p.owner_id = auth.uid() OR public.is_project_member(p.id, auth.uid()))
  )
);
