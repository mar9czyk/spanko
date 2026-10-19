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

## Workflow
- 1 sesja = 1 zadanie = 1 commit; plan faz i checklisty: `docs/plan-workflow-claude-code.md` (czytaj swoją sekcję, odhaczaj po zakończeniu).
- `.claude/settings.json`: model `opusplan`, allowlista, hook PostToolUse uruchamia `pnpm check` po edycji plików w `src/`.

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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
