---
name: deploy-mikrus
description: Wdrożenie Spanko na VPS Mikr.us przez pnpm deploy z checklistą przed- i po-deployową wg deploy/mikrus/README.md. Używaj, gdy użytkowniczka prosi o deploy, wdrożenie, rollback lub sprawdzenie produkcji.
disable-model-invocation: true
---

# Deploy na Mikr.us

Pełna dokumentacja serwera: `deploy/mikrus/README.md`. Skrypt: `scripts/deploy.sh` (`pnpm deploy`) — build lokalny, wysyłka `.next/standalone` (rsync lub `tar | ssh` w Git Bash), healthcheck.

**Deploy to akcja produkcyjna — uruchamiaj `pnpm deploy` wyłącznie po wyraźnym „tak” użytkowniczki w czacie.**

## Przed deployem
- [ ] Drzewo czyste, jesteś na `main` z zmergowanymi zmianami (`git status`, `git log -1`).
- [ ] `pnpm check` i `pnpm test` przechodzą.
- [ ] Istnieją `scripts/deploy.env` (host/port/domena) i `.env.production.local` (`NEXT_PUBLIC_POCKETBASE_URL`) — nie wypisuj ich zawartości/sekretów w czacie.
- [ ] Zmiana schematu? Najpierw import `pb_schema.json` w panelu PocketBase przez tunel SSH (`ssh -p PORT -L 8090:127.0.0.1:8090 root@srvXX.mikr.us` → `http://127.0.0.1:8090/_/`) — krok ręczny użytkowniczki.
- [ ] Zmiana `NEXT_PUBLIC_*`/domeny wymaga nowego builda (wartości wbudowywane przy buildzie).
- [ ] Nowe sekrety serwerowe dopisane ręcznie do `/opt/spanko/web/.env.production`.

## Deploy
Po akceptacji: `pnpm deploy` (uruchom w tle, długi). Kod wyjścia ≠ 0 = błąd builda, wysyłki lub healthchecku.

## Po deployu
- [ ] Healthcheck `APP_URL/` i `APP_URL/pb/api/health` zielony (raportuje skrypt).
- [ ] Szybki test ręczny: logowanie Google, dashboard, zapis snu.
- [ ] Przy problemie — rollback (README, sekcja „Rollback”): `mv /opt/spanko/web /opt/spanko/web.bad && mv /opt/spanko/web.old /opt/spanko/web && systemctl restart spanko-web`; dane z `/opt/spanko/backups`.
