
  # Parallel Dialer SaaS Web App

  This is a code bundle for Parallel Dialer SaaS Web App. The original project is available at https://www.figma.com/design/2Gu2qiJ0GHGdXeTovQQRkt/Parallel-Dialer-SaaS-Web-App.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Auth (Supabase)

  Sign up and sign in use Supabase. To enable auth:

  1. Create a project at [supabase.com](https://supabase.com).
  2. In the Supabase dashboard: **Authentication** → **Providers** → enable **Email**.
  3. Copy `.env.example` to `.env` and set:
     - `VITE_SUPABASE_URL` — your project URL
     - `VITE_SUPABASE_ANON_KEY` — your project anon/public key (Settings → API).

  Collected at sign up: First name, Last name, Company email, Account password, Company name. These are stored in Supabase Auth (user metadata for name/company).
  