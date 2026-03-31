-- ============================================
-- STEP 6: Invites + required RLS updates (non-recursive)
-- ============================================

BEGIN;

-- ----------------------------
-- 1) Invite schema on project_members
-- ----------------------------

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS invited_email TEXT;

ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- allow pending invites without a user_id yet
ALTER TABLE public.project_members
  ALTER COLUMN user_id DROP NOT NULL;

-- status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_status_check'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_status_check
      CHECK (status IN ('pending', 'active', 'revoked'));
  END IF;
END $$;

-- pending rows must have invited_email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'project_members_pending_requires_email_check'
      AND conrelid = 'public.project_members'::regclass
  ) THEN
    ALTER TABLE public.project_members
      ADD CONSTRAINT project_members_pending_requires_email_check
      CHECK (status <> 'pending' OR invited_email IS NOT NULL);
  END IF;
END $$;

-- unique per project/email (for pending + active invites)
CREATE UNIQUE INDEX IF NOT EXISTS project_members_project_invited_email_unique
  ON public.project_members (project_id, lower(invited_email))
  WHERE invited_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_members_invited_email_idx
  ON public.project_members (lower(invited_email))
  WHERE invited_email IS NOT NULL;

COMMIT;

-- ----------------------------
-- 2) Helper function for "can edit project"
-- This avoids RLS recursion by not putting table joins inside policies.
-- ----------------------------

CREATE OR REPLACE FUNCTION public.can_edit_project(p_project_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.owner_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.user_id = p_user_id
      AND pm.role IN ('owner','editor')
      AND pm.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.can_edit_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid, uuid) TO authenticated;

-- ----------------------------
-- 3) RLS for project_members: allow invites
-- IMPORTANT: you currently only have SELECT on project_members.
-- You need INSERT/UPDATE/DELETE for owners/editors to manage members.
-- ----------------------------

DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners and editors can manage members" ON public.project_members;

CREATE POLICY "Project owners and editors can manage members"
ON public.project_members
FOR ALL
USING (
  public.can_edit_project(project_members.project_id, auth.uid())
)
WITH CHECK (
  public.can_edit_project(project_members.project_id, auth.uid())
);

-- ----------------------------
-- 4) Files UPDATE policy for parsed_summary persistence (non-recursive)
-- ----------------------------

DROP POLICY IF EXISTS "Users can update files in their projects" ON public.files;

CREATE POLICY "Users can update files in their projects"
ON public.files
FOR UPDATE
USING (public.can_edit_project(files.project_id, auth.uid()))
WITH CHECK (public.can_edit_project(files.project_id, auth.uid()));