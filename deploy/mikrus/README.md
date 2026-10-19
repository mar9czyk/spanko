# Wdrożenie Spanko na VPS Mikr.us

Build robisz lokalnie (`pnpm deploy`), na serwer trafia tylko paczka `.next/standalone`.
Serwer: Caddy (HTTPS) → Next.js `127.0.0.1:3000` oraz PocketBase `127.0.0.1:8090` pod `/pb/*`.
Usługi działają jako użytkownik `spanko` (nie root).

## 0. Sieć na Mikr.usie (sprawdź najpierw)

Tańsze plany Mikr.usa **nie mają publicznego IPv4 na portach 80/443**. Zanim ruszysz dalej:
- sprawdź w panelu Mikr.usa, czy masz IPv4 na 80/443 albo przypisany port, czy tylko IPv6;
- jeśli IPv6 — ustaw w DNS rekord **AAAA** (nie A) i upewnij się, że klienci mają IPv6;
- jeśli dostajesz tylko port przekierowany przez proxy Mikr.usa — Caddy nie zdobędzie certyfikatu
  przez HTTP-01 na 80/443; użyj wtedy wyzwania DNS-01 (plugin DNS Caddy) lub proxy Mikr.usa.

## 1. Użytkownik i katalogi (jednorazowo, jako root)

```bash
adduser --system --group --home /opt/spanko --shell /usr/sbin/nologin spanko
mkdir -p /opt/spanko/web /opt/spanko/pb /opt/spanko/backups
chown -R spanko:spanko /opt/spanko
apt-get update && apt-get install -y sqlite3 unzip curl
```

Node.js 20+ musi być dostępny jako `/usr/bin/node` (`node -v`).

## 2. PocketBase

```bash
cd /opt/spanko/pb
# pobierz binarkę ze strony https://pocketbase.io/docs/ (linux_amd64 lub linux_arm64), np.:
curl -L -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/vX.Y.Z/pocketbase_X.Y.Z_linux_amd64.zip
unzip pb.zip && rm pb.zip && chmod +x pocketbase && chown -R spanko:spanko /opt/spanko/pb
```

Konto superusera (jednorazowo) — te same dane trafią do `.env.production`:

```bash
sudo -u spanko /opt/spanko/pb/pocketbase superuser upsert admin@twojadomena.pl 'DLUGIE_HASLO'
```

Import schematu: w panelu PocketBase (tunel SSH, bo `/pb/_/` jest zablokowane publicznie):

```bash
ssh -p PORT -L 8090:127.0.0.1:8090 root@srvXX.mikr.us
# następnie http://127.0.0.1:8090/_/  →  Settings → Import collections → wklej pb_schema.json
```

Na kolekcji `users` dodaj pole bool `is_admin` i `household_id` (relation → `households`), jeśli import
ich nie utworzył, oraz ustaw `is_admin = true` na swoim koncie.

## 3. Google OAuth2

W Google Cloud Console → Credentials → OAuth client (Web):
- **Authorized redirect URI:** `https://<domena>/pb/api/oauth2-redirect`
  (Caddy `handle_path /pb/*` obcina prefiks, więc PocketBase widzi `/api/oauth2-redirect`; w ustawieniach
  PocketBase → Application ustaw **URL aplikacji** na `https://<domena>/pb`, by adres zwrotny się zgadzał).
- W PocketBase: kolekcja `users` → Options → OAuth2 → Google (Client ID / Secret).

## 4. Caddy

```bash
cp deploy/mikrus/Caddyfile /etc/caddy/Caddyfile   # zamień domenę
systemctl reload caddy
```

## 5. Usługi systemd

```bash
cp deploy/mikrus/spanko-pb.service deploy/mikrus/spanko-web.service \
   deploy/mikrus/spanko-pb-backup.service deploy/mikrus/spanko-pb-backup.timer /etc/systemd/system/
cp deploy/mikrus/.env.production.example /opt/spanko/web/.env.production   # uzupełnij sekrety
chown spanko:spanko /opt/spanko/web/.env.production && chmod 600 /opt/spanko/web/.env.production
systemctl daemon-reload
systemctl enable --now spanko-pb spanko-pb-backup.timer
# spanko-web włączasz po pierwszym deployu (potrzebuje server.js):
systemctl enable spanko-web
```

## 6. Konfiguracja lokalna i deploy

```bash
cp scripts/deploy.env.example scripts/deploy.env                 # uzupełnij host/port/domenę
cp deploy/mikrus/.env.production.local.example .env.production.local   # NEXT_PUBLIC_POCKETBASE_URL
pnpm deploy
```

Uwagi (Windows / Git Bash):
- Git Bash nie ma `rsync` — skrypt sam przełączy się na `tar | ssh` z atomową zamianą katalogów
  (`/opt/spanko/web.old` zostaje jako kopia poprzedniej wersji). Symlinki pnpm są rozwiązywane (`tar -h` / `rsync -L`).
- `NEXT_PUBLIC_*` są wbudowywane przy buildzie — po zmianie domeny zrób nowy deploy.
- Sekrety (`OPENROUTER_API_KEY`, `POCKETBASE_SUPERUSER_*`, `VAPID_*`) są tylko w `/opt/spanko/web/.env.production`.
- Powiadomienia o pobudce (nasłuch mikrofonem) wymagają kluczy `VAPID_*` (`npx web-push generate-vapid-keys`),
  kolekcji `push_subscriptions` z `pb_schema.json` oraz `microphone=(self)` w `Permissions-Policy` Caddy.

Deploy kończy się healthcheckiem `APP_URL/` i `APP_URL/pb/api/health` (kod wyjścia ≠ 0 przy błędzie).

## Kopie zapasowe

`spanko-pb-backup.timer` robi codziennie ok. 03:30 spójną kopię `data.db` i `auxiliary.db`
(`sqlite3 .backup`) do `/opt/spanko/backups`, rotacja 14 dni. Test: `systemctl start spanko-pb-backup && ls /opt/spanko/backups`.
Kopie warto okresowo ściągać poza serwer (`scp`/`rsync`).

## Rollback

- Deploy przez tar: `mv /opt/spanko/web /opt/spanko/web.bad && mv /opt/spanko/web.old /opt/spanko/web && systemctl restart spanko-web`.
- Deploy przez rsync (brak `.old`): wróć do poprzedniego commita i uruchom `pnpm deploy`.
- Dane: zatrzymaj `spanko-pb`, podmień `pb_data/data.db` kopią z `/opt/spanko/backups`, uruchom ponownie.
