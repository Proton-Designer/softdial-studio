# Softdial Studio

Softdial Studio is a parallel dialing application with a React/Vite frontend and Supabase-backed serverless workflows.

## Repository structure

- `Frontend/` - React + Vite web application UI
- `supabase/` - Supabase configuration and Edge Functions (including webhook handlers)
- `docs/` - project documentation and supporting notes
- `telnyx-ext-agent-skills/` - Telnyx integration skills and references used during development

## Prerequisites

- Node.js 18+
- npm
- Supabase CLI (for deploying functions)

## Quick start

1. Install dependencies:

```bash
npm install
npm run install:frontend
```

2. Start the frontend app:

```bash
npm run dev
```

3. Build the frontend:

```bash
npm run build
```

## Supabase functions

Deploy the Telnyx webhook function:

```bash
npm run deploy:webhook
```

Deploy all functions:

```bash
npm run deploy:functions
```

## Environment setup

The frontend uses Supabase environment variables. In `Frontend/`, create a `.env` file from `.env.example` (if present) and set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Telnyx integrations should use:

- `TELNYX_API_KEY`
