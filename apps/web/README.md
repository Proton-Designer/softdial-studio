# @softdial/web

The Softdial Studio web client — React 18 + TypeScript + Vite 6, styled with
Tailwind CSS v4 and Radix-based shadcn/ui primitives.

Run everything from the **repository root**; this is an npm workspace.

```bash
npm run dev        # http://localhost:3000
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build
```

## Layout

| Path | Contains |
|---|---|
| `src/components/` | Feature screens — `Dashboard`, `Dialer`, `Contacts`, `Campaigns`, `Analytics`, `Settings` |
| `src/components/<feature>/` | Sub-components for a single feature |
| `src/components/ui/` | Generated shadcn/ui primitives — excluded from Prettier, prefer regenerating over editing |
| `src/contexts/` | `AuthContext`, `PhoneNumbersContext` |
| `src/hooks/` | `useDialerSession` — the live dial-session state machine |
| `src/lib/` | `supabase.ts` (client), `api.ts` (Edge Function calls), `useTelnyxCall.ts` (WebRTC) |
| `src/styles/globals.css` | **The only stylesheet.** Tailwind entry + design tokens |

## Styling

`src/styles/globals.css` is the single entry point, compiled by
`@tailwindcss/vite`. Design tokens are CSS custom properties on `:root`,
re-exported to Tailwind via `@theme inline`. Add colors as tokens; the raw hex
literals throughout the components are legacy.

## Environment

```bash
cp .env.example .env
```

Every `VITE_`-prefixed value is **inlined into the public bundle** — never put a
secret here. Server-side secrets belong in Supabase. Full reference:
[`../../docs/reference/environment-variables.md`](../../docs/reference/environment-variables.md).

## Attribution

UI primitives derive from [shadcn/ui](https://ui.shadcn.com/) (MIT). This app
began as a Figma Make export; the scaffold has since been rebuilt around a real
Tailwind toolchain. See [`../../ATTRIBUTIONS.md`](../../ATTRIBUTIONS.md).
