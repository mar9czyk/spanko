# Plan pracy z Claude Code — fazy A–E

Dokument steruje sesjami Claude Code przy Spanko. Każda sesja zaczyna od przeczytania swojej sekcji, kończy commitem i odhaczeniem checklisty tutaj.

## Zasady ogólne
- 1 sesja = 1 zadanie = 1 commit/PR. Kontekst między sesjami przekazuje ten plik, nie czat.
- Prace równoległe: osobne sesje z worktree (osobna gałąź), nigdy dwie sesje na tych samych plikach.
- Review zawsze w świeżej sesji (`/code-review high`, `/security-review`).
- Po każdej zmianie kodu: `pnpm check` i `pnpm test` (0 błędów).
- Modele: `opusplan` domyślnie (Opus planuje, Sonnet implementuje); subagenci mają model w nagłówku.

---

## Faza A — Higiena repo i konfiguracja Claude Code (1 sesja)
**Cel:** czyste repo i konfiguracja, która usuwa ręczne kroki.

- [x] A1. Przejrzyj i zacommituj zmianę w `scripts/dev-seed.mjs` (sprawdź `pnpm check`). _(Zrobione w 509d8d1.)_
- [ ] A2. Gałąź bazowa: lokalnie i na remote `spanko` jest `master`, a aplikacja zakłada `main`. **Nie zmieniaj nazw gałęzi na remote bez zgody właścicielki** — opisz opcje (zmiana na `main` vs. pozostanie przy `master`) i zapytaj. _(Status: opcje przedstawione właścicielce, czeka na decyzję.)_
- [x] A3. Utwórz `.claude/settings.json` (wspólny, w repo):
  - `"model": "opusplan"`,
  - `permissions.allow`: `pnpm check`, `pnpm test`, `pnpm lint`, `pnpm build`, `git status/diff/log`,
  - hook `PostToolUse` (matcher `Edit|Write`) uruchamiający `pnpm check` dla zmian w `src/` (Windows: działa z Git Bash/PowerShell — przetestuj).
- [x] A4. Uruchom skill `/fewer-permission-prompts` i uzupełnij allowlistę.
- [x] A5. Dopisz do `CLAUDE.md` krótką sekcję „Workflow” z linkiem do tego pliku (max 3 linie).
- [x] A6. Weryfikacja: `pnpm check`, `pnpm test`, commit `chore(claude): ...`.

**Gotowe gdy:** czyste `git status`, settings działa (hook odpala się po edycji), checklisty odhaczone.

---

## Faza B — Stabilizacja przed użytkownikami (3 sesje równolegle + 1 review)
Każda sesja w osobnym worktree, model Sonnet (Opus tylko do planu).

- **B1. E2E (Playwright):** logowanie DEV, 1-tap butelka/pielucha, start/stop snu, granica dnia fizjologicznego, zmiana języka EN/PL. Skrypt `pnpm e2e`.
- **B2. Bezpieczeństwo:** reguły PocketBase (`pb_schema.json`), `src/app/api/ai/*` (auth, limity, brak wycieku kluczy OpenRouter), `requireAdmin`, invite codes. Raport + poprawki; `/security-review`.
- **B3. UX 3 AM:** przegląd ekranów w przeglądarce w aplikacji, viewport mobile, dark mode, jedno-kciukowa obsługa; poprawki wg `docs/agent/ux-guidelines.md`.
- **B4. (po B1–B3) Świeża sesja:** `/code-review high` każdej gałęzi, merge do gałęzi bazowej.

**Gotowe gdy:** E2E zielone, brak krytycznych znalezisk security, zmergowane.

---

## Faza C — Własne subagenty i skille (1 sesja, Opus)
- [ ] `.claude/agents/sleep-engine-guardian.md` (`model: opus`) — pilnuje „deterministic first”, czyta `docs/agent/sleep-engine.md`, pisze testy Vitest.
- [ ] `.claude/agents/i18n-checker.md` (`model: haiku`) — brakujące/nieużywane klucze EN/PL, jednostki ml/oz.
- [ ] `.claude/agents/pb-schema.md` (`model: sonnet`) — migracje i reguły PocketBase wg `docs/agent/database.md`.
- [ ] Skill `.claude/skills/nowa-faza/` — plan w `docs/` → gałąź/worktree → implementacja → check/test → review → PR.
- [ ] Skill `.claude/skills/deploy-mikrus/` — owija `pnpm deploy` + checklistę z `deploy/mikrus/README.md`.
- [ ] Skill `.claude/skills/seed-dev/` — uruchomienie PocketBase + `scripts/dev-seed.mjs`.

**Gotowe gdy:** każdy agent/skill przetestowany jednym realnym wywołaniem.

---

## Faza D — Capacitor + push (orkiestrator + 2–3 sesje robocze)
- Sesja-orkiestrator (Opus): plan w `docs/plan-faza-12-capacitor.md`, podział na niezależne części.
- Sesje robocze (Sonnet, worktree): D1 powłoka Capacitor iOS/Android, D2 powiadomienia push (web push + APNs/FCM, kolekcja subskrypcji w PB), D3 pipeline buildów.
- Alternatywa: agent team (lider Opus + 3 członków Sonnet) — tylko jeśli części są naprawdę niezależne.
- Na końcu świeża sesja `/code-review high`.

---

## Faza E — Monetyzacja (dawna Faza 11, wstrzymana do decyzji właścicielki)
1. Sesja research (skill `deep-research`): modele freemium konkurencji, ceny, RevenueCat vs Stripe.
2. Sesja plan (Opus, plan mode) → aktualizacja `docs/plan-faza-7-11.md` §Faza 11.
3. Sesja implementacja (Sonnet, worktree), wyłącznie tryb testowy płatności.
4. `/security-review` + `/code-review ultra` przed produkcją.

---

## Na bieżąco
- Cotygodniowa routine (`/schedule`): raport kosztów/błędów z `ai_calls`, aktualizacje zależności.
- `/model` ręcznie tylko wyjątkowo — domyślnie `opusplan` + modele subagentów.
