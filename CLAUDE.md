# Spanko — AI Baby Sleep Assistant & Tracker (PWA)

Mobile-first Progressive Web App combining a real-time baby sleep/routine tracker with a deterministic 3-Drive Sleep Engine and OpenRouter AI insights.

## Tech Stack & Verification Commands
- **Package Manager:** `pnpm`
- **Framework:** Next.js 16 (App Router, `output: 'standalone'`, TypeScript Strict), Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** PocketBase (SQLite + Realtime SSE + Google OAuth2)
- **Fast Verification Loop (MANDATORY — RUN AFTER EVERY CODE CHANGE):**
  - `pnpm check` -> runs Biome lint/format + `tsc --noEmit` (must return 0 errors)
  - `pnpm test` -> runs Vitest unit tests for the deterministic sleep engine
- **Deploy:** `pnpm deploy` (lokalny build + SSH na Mikr.us) — konfiguracja i serwer: `deploy/mikrus/README.md`

## Core Architectural Guardrails
1. **Deterministic First, AI Second:** Never use LLMs to calculate wake windows, sleep debt, or circadian anchors. All math and diagnostic trees live in `src/lib/sleep-engine/` as pure, unit-tested TypeScript functions.
2. **OpenRouter Server-Only:** All OpenRouter calls happen server-side in `src/app/api/ai/` using models and prompts fetched from PocketBase `admin_settings`. No STT/voice in MVP.
3. **Physiological Day Boundary:** A baby's day starts at morning wake-up (`woke_up_at` from night sleep) and ends at the next morning's wake-up (e.g., Tuesday morning wake-up closes Monday's physiological day).
4. **3 AM One-Thumb UX:** Dark mode by default (`#0B0F17`), warm amber/violet accents, zero mandatory typing at night, bottom-anchored controls.

## Progressive Disclosure (Read ONLY when working on a specific domain)
- Database schema, PocketBase rules & invite codes -> `docs/agent/database.md`
- Deterministic 3-Drive Sleep Engine & 7 Diagnostic Trees -> `docs/agent/sleep-engine.md`
- OpenRouter JSON schemas, Insight Versioning & Admin Panel -> `docs/agent/ai-and-admin.md`
- Silnik Celów (cele snu, plany, metody, progresja) -> `docs/agent/goals-engine.md`
- Internacjonalizacja EN/PL, jednostki ml/oz -> `docs/agent/i18n.md`
- UI/UX guidelines, Dark Mode palette & 3 AM workflow -> `docs/agent/ux-guidelines.md`
