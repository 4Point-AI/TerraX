# Terra-X

Terra-X is a Next.js application for mining and exploration workflows. It combines project-based data management with geological AI chat, map-based AOI work, file parsing, reports, and lightweight 3D visualization.

## What it includes

- **AI chat**
  - Geological reasoning workflow powered by Google Gemini
- **Project workspaces**
  - Projects, chats, files, reports, AOIs, and team members
- **File handling**
  - Upload and parse CSV, PDF, and selected technical data files
- **Spatial workflow**
  - Mapbox-powered map views and AOI drawing
- **3D workflow**
  - Drillhole-oriented visualization using Three.js and React Three Fiber
- **Reporting**
  - Markdown-based reports and export flows

## Stack

- **Framework**
  - Next.js 14 App Router
- **Language**
  - TypeScript
- **Database/Auth/Storage**
  - Supabase
- **AI**
  - Google Gemini
- **Mapping**
  - Mapbox GL
- **3D**
  - Three.js + React Three Fiber
- **Styling**
  - Tailwind CSS

## Requirements

- **Node.js**
  - 18+
- **Accounts/services**
  - Supabase project
  - Google Gemini API key
  - Mapbox access token

## Quick start

1. Install dependencies

```bash
npm install
```

2. Copy the env template

```bash
cp .env.example .env.local
```

3. Fill in the required values in `.env.local`

4. Set up Supabase using the SQL files in `lib/supabase/`

5. Start the app

```bash
npm run dev
```

6. Open `http://localhost:3000`

For the full setup flow, see `SETUP.md`.

## Environment variables

The app currently uses these variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
GEMINI_API_KEY=
```

## Database setup source of truth

The canonical public database setup lives in:

- `lib/supabase/schema_step1.sql`
- `lib/supabase/schema_step2.sql`
- `lib/supabase/schema_step3.sql`
- `lib/supabase/schema_step4.sql`
- `lib/supabase/schema_step5.sql`
- `lib/supabase/schema_step6.sql`
- `lib/supabase/schema_step7.sql`

If you are preparing this repo for public release, keep those files. They are the cleanest setup path for a new user.

## Important implementation notes

- **Storage bucket**
  - The app expects a private Supabase Storage bucket named `project-files`
- **Invites**
  - Team invites require `SUPABASE_SERVICE_ROLE_KEY` on the server
- **Public insert tables**
  - The schema includes public insert flows for lead/request capture tables; consider adding rate limiting or bot protection before production use

## Project structure

```text
TerraX-public/
├── app/
├── components/
├── lib/
│   └── supabase/
├── public/
├── types/
├── .env.example
├── README.md
└── SETUP.md
```

## Deployment

This app can be deployed anywhere that supports a standard Next.js server build.

## Before making the repo public

- **Do not commit**
  - real `.env` files
  - service role keys
  - database passwords

## License

This project is open source and available under the MIT License.

Copyright (c) 2026 4Point AI.

See `LICENSE` for the full text.
