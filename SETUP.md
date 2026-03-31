# Setup

This guide walks through the actual setup required to run the public Terra-X repo locally.

## Prerequisites

- **Node.js**
  - Version 18 or newer
- **npm**
- **Supabase account**
  - Create a new project at `https://supabase.com`
- **Google Gemini API key**
- **Mapbox access token**

## 1. Install dependencies

```bash
npm install
```

## 2. Create your local environment file

Copy the tracked template:

```bash
cp .env.example .env.local
```

Fill in these values in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
GEMINI_API_KEY=
```

## 3. Create a Supabase project

In Supabase, create a new project and collect:

- **Project URL**
  - Use this for `NEXT_PUBLIC_SUPABASE_URL`
- **Anon key**
  - Use this for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Service role key**
  - Use this for `SUPABASE_SERVICE_ROLE_KEY`

The service role key is required for server-side team invite flows. Keep it private.

## 4. Run the database SQL in order

Open the Supabase SQL Editor and run these files in this exact order:

1. `lib/supabase/schema_step1.sql`
2. `lib/supabase/schema_step2.sql`
3. `lib/supabase/schema_step3.sql`
4. `lib/supabase/schema_step4.sql`
5. `lib/supabase/schema_step5.sql`
6. `lib/supabase/schema_step6.sql`
7. `lib/supabase/schema_step7.sql`

### What each step does

- **Step 1**
  - Creates the core tables, triggers, and base functions
- **Step 2**
  - Adds initial RLS policies and creates the `project-files` storage bucket
- **Step 3**
  - Backfills `profiles` for any existing auth users
- **Step 4**
  - Fixes recursive RLS behavior and adds the onboarding column expected by the app
- **Step 5**
  - Adds the `parsed_summary` column to `files`
- **Step 6**
  - Adds invite-related schema and policies used by team management
- **Step 7**
  - Adds the `siim_deployment_requests` table

## 5. Configure Supabase Storage policies

The app uses a private bucket named `project-files`.

The bucket is created by `schema_step2.sql`, but storage object policies still need to be created in the Supabase dashboard.

Open:

- **Supabase Dashboard**
  - Storage
  - Bucket: `project-files`
  - Policies

For local development, create policies that allow authenticated users to read, upload, and delete files in `project-files`.

### Minimum development policies

```sql
create policy "Authenticated users can read project files"
on storage.objects
for select
to authenticated
using (bucket_id = 'project-files');

create policy "Authenticated users can upload project files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'project-files');

create policy "Authenticated users can delete project files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'project-files');
```

These are broad development policies. Tighten them before production if you need stricter project-level isolation.

## 6. Configure authentication

The app uses Supabase Auth.

Minimum local setup:

- enable email sign-in / magic link in Supabase Auth
- make sure your site URL allows local development if Supabase asks for it

If you want team invite emails to be delivered reliably, configure an email provider / SMTP in Supabase Auth.

## 7. Start the app

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## 8. Verify the core flows

After startup, verify these flows:

- **Authentication**
  - Sign in successfully
- **Projects**
  - Create a project
- **Files**
  - Upload a file into a project
- **Chat**
  - Ask a geological question in a project chat
- **Map**
  - Load the project map with your Mapbox token
- **Reports**
  - Generate or export report content

## Troubleshooting

### `Unauthorized` or redirect loops

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase Auth settings

### Invite flow fails

Check:

- `SUPABASE_SERVICE_ROLE_KEY`
- `schema_step6.sql` has been run
- Supabase email / SMTP configuration if expecting delivery

### File upload or download fails

Check:

- the `project-files` bucket exists
- storage policies were created for `storage.objects`

### Map does not load

Check:

- `NEXT_PUBLIC_MAPBOX_TOKEN`

### AI chat fails

Check:

- `GEMINI_API_KEY`


That schema-step path is the cleanest setup path for a new user.
