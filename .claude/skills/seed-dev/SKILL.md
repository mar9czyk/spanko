---
name: seed-dev
description: Uruchamia lokalny PocketBase i zasila go danymi testowymi (scripts/dev-seed.mjs, opcjonalnie dev-seed-history.mjs) do logowania DEV bez Google. Używaj, gdy trzeba przetestować aplikację lokalnie, odtworzyć dane testowe lub zalogować się testowym użytkownikiem/adminem.
---

# Lokalny PocketBase + seed DEV

## Jak to działa w repo
- Binarka: `pb/pocketbase.exe` w **głównym checkoutcie** (`pb/` jest w `.gitignore` — w worktree go nie ma; użyj ścieżki do głównego repo, np. `D:/_dev/Spanko/pb/pocketbase.exe`). Dane: `pb/pb_data/`.
- `pnpm dev:seed` = `node --env-file=.env.development.local scripts/dev-seed.mjs`:
  - odmawia działania, jeśli `NEXT_PUBLIC_POCKETBASE_URL` nie jest localhost/127.0.0.1 (domyślnie `http://127.0.0.1:8090`);
  - wymaga `POCKETBASE_SUPERUSER_EMAIL/PASSWORD` w `.env.development.local` (gitignored);
  - włącza `passwordAuth` w kolekcji `users` (lokalnie), idempotentnie tworzy `dev@spanko.test`, `dev-admin@spanko.test` (is_admin), gospodarstwo „Dom testowy (DEV)”, dziecko „Tymon (DEV)” i 5 dni `sleep_logs`/`day_context`;
  - brakujące hasła `DEV_USER_*`/`DEV_ADMIN_*` generuje i dopisuje do `.env.development.local`.
- `pnpm dev:seed:history` — dodatkowe 14 starszych dób + wnioski AI `DEV_*` dla „Tymon (DEV)” (idempotentny).

## Kroki
1. Sprawdź, czy PB już działa: `curl -s http://127.0.0.1:8090/api/health`.
2. Jeśli nie — uruchom w tle (z katalogu głównego repo): `pb/pocketbase.exe serve --http=127.0.0.1:8090`.
3. Pierwszy raz: superuser `pb/pocketbase.exe superuser upsert <email> <hasło>` (dane wpisuje użytkowniczka do `.env.development.local`) i import `pb_schema.json` w `http://127.0.0.1:8090/_/` → Settings → Import collections.
4. Upewnij się, że `.env.development.local` istnieje w bieżącym katalogu (w worktree skopiuj z głównego checkoutu). Nie wypisuj haseł w czacie.
5. `pnpm dev:seed` (opcjonalnie `pnpm dev:seed:history`).
6. `pnpm dev` → `http://localhost:3000/login` → „Zaloguj jako testowy użytkownik (DEV)” (serwerowy `POST /api/dev/login`, działa tylko w development z lokalnym PB).
