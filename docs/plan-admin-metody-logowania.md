# Plan: administratorzy, klucz Google w panelu, przełączniki logowania i rejestracji

Status: etapy 2 i 3 wdrożone bez kopii w `app_secrets` i bez flag w `admin_settings` (źródłem prawdy jest konfiguracja PocketBase, patrz `docs/agent/ai-and-admin.md`). Etap 1 nie jest zrobiony.

## 0. Stan obecny (sprawdzony w kodzie)

- Rola admina to pole `users.is_admin` (bool). Na nim opiera się ~25 reguł API PocketBase
  (`@request.auth.is_admin = true` w `admin_settings`, `prompts`, `announcements`, `feature_flags`,
  `audit_log`, `users` itd.) oraz `requireAdmin()` w `src/lib/server/auth.ts` (rekord z serwera, nie z klienta).
- Użytkownik nie może sam ustawić sobie `is_admin` (reguły `createRule`/`updateRule` na `users`).
- Panel → zakładka Użytkownicy ma już przycisk „Nadaj admina” i blokadę odebrania roli ostatniemu adminowi
  (`checkAdminDemotion`). Zmiany trafiają do `audit_log`.
- Logowanie: Google OAuth2 (`authWithOAuth2`), e-mail + hasło (`/login/email`), logowanie DEV tylko lokalnie.
- Rejestracja: e-mail (`/signup`, weryfikacja adresu) oraz Google (pierwsze logowanie tworzy konto).
- Klient ID/secret Google trzyma PocketBase w konfiguracji kolekcji `users` (`oauth2.providers`).
  Dziś ustawia się je ręcznie w panelu PocketBase przez tunel SSH. `pb_schema.json` ma `providers: []`,
  więc **ponowny import schematu kasuje konfigurację Google** (pułapka, którą plan usuwa).

## 1. Jak definiować adminów — rekomendacja

Rozważone opcje:

| Opcja | Plusy | Minusy |
|---|---|---|
| A. Lista e-maili/ID w parametrze systemowym (`admin_settings` lub `.env`) jako jedyne źródło | jedno miejsce, czytelne | reguły PocketBase nie umieją czytać listy z innej kolekcji per żądanie tak prosto jak pola; trzeba by przepisać ~25 reguł albo dublować sprawdzanie; e-mail może się zmienić; lista w `.env` wymaga redeployu |
| B. Zostaje `users.is_admin` + zarządzanie w panelu + awaryjny „bootstrap” z `.env` | działa natywnie w regułach PB, zmiana bez redeployu, audyt już jest, ochrona ostatniego admina już jest | lista adminów nie jest „w jednym polu”, tylko widoczna jako filtr |

**Rekomendacja: B.** Pole `is_admin` *jest* tym parametrem, tylko trzymanym przy koncie, dzięki czemu
PocketBase sam pilnuje dostępu do danych. Dokładamy:

1. W panelu sekcję **„Administratorzy”** (w zakładce Użytkownicy albo Ustawienia): lista kont z `is_admin = true`
   i pole „Dodaj admina po e-mailu” (konto musi istnieć). Odebranie roli zostaje z blokadą ostatniego admina.
2. Zmienną `SPANKO_BOOTSTRAP_ADMIN_EMAILS` (opcjonalna, `.env.production`): przy logowaniu konta z tej listy
   serwer ustawia mu `is_admin = true` (tylko nadaje, nigdy nie odbiera). To furtka awaryjna, gdyby jedyny
   admin stracił rolę; normalnie lista może być pusta. Ostatnią deską ratunku zostaje superuser PocketBase przez tunel SSH.

## 2. Dostęp tylko dla admina + klucz Google w panelu

Dostęp do `/admin` i `/api/admin/*` jest już ograniczony do `is_admin` (UI + serwer + reguły PB).
Etap 1 dodaje test regresji, że zwykły użytkownik dostaje 403 na każdej trasie `/api/admin/*`.

Nowa karta w Panelu → Ustawienia: **„Logowanie Google”**

- Pola: Client ID (widoczny), Client Secret (tylko do zapisu, pokazujemy „ustawiony / brak” i 4 ostatnie znaki ID).
  Puste pole sekretu przy zapisie = bez zmiany.
- Pokazujemy do skopiowania Redirect URI: `https://spanko.mikrus.dev/pb/api/oauth2-redirect`.
- Przycisk „Sprawdź konfigurację”: serwer pyta PB o `listAuthMethods` i potwierdza, że provider `google` jest aktywny.
- Trasa `PUT /api/admin/auth/google` (`requireAdmin`), zapis przez klienta serwisowego superusera:
  pobiera kolekcję `users`, podmienia/dodaje tylko wpis `google` w `oauth2.providers`, zapisuje całą kolekcję.
  Sekret nigdy nie wraca do przeglądarki ani do logów; wpis w `audit_log` bez wartości.
- Kopia ID/sekretu Google także w `app_secrets` (szyfrowanie AES-GCM jak klucz OpenRouter), żeby po
  ponownym imporcie `pb_schema.json` dało się konfigurację odtworzyć jednym kliknięciem (patrz 3.4).

## 3. Przełączniki metod logowania i rejestracji

### 3.1 Metody

- Logowanie: `google`, `email` (e-mail + hasło). Logowanie DEV nie jest metodą produkcyjną i nie wchodzi do przełączników.
- Rejestracja: `google` (nowe konto przy pierwszym logowaniu Google), `email` (formularz `/signup`).

### 3.2 Reguły (czysta funkcja, testy jednostkowe)

`validateAuthMethods(config, { googleConfigured })` w `src/lib/server/authMethods.ts`:

1. Co najmniej jedna metoda logowania włączona.
2. Co najmniej jedna metoda rejestracji włączona.
3. Rejestracja metodą X wymaga włączonego logowania metodą X (inaczej konto powstanie, a nie da się zalogować).
4. Google (logowanie lub rejestracja) można włączyć tylko, gdy Client ID i Secret są ustawione.
5. Ostrzeżenie (nie blokada): wyłączasz metodę, której używa któryś admin — pokaż listę takich adminów.

### 3.3 Gdzie zapisane i jak egzekwowane

Stan żądany w `admin_settings`: `login_google`, `login_email`, `signup_google`, `signup_email` (bool, domyślnie wszystkie `true`).
Po zapisie serwer **stosuje** go do kolekcji `users` (klient serwisowy), funkcją
`deriveUsersAuthConfig(flags)` (czysta, testowana):

| Flaga | Ustawienie w PocketBase |
|---|---|
| `login_email` | `passwordAuth.enabled` |
| `login_google` | `oauth2.enabled` (provider `google` zostaje zapisany) |
| `signup_*` | `createRule` = obecna reguła + `@request.context = "oauth2"` (tylko Google), `@request.context != "oauth2"` (tylko e-mail) lub bez dodatku (obie) |

Dzięki temu wyłączenie działa także przy wywołaniu API PocketBase z pominięciem aplikacji.
(PocketBase v0.40 sprawdza `createRule` przy zakładaniu konta przez OAuth2 i udostępnia `@request.context`;
implementacja potwierdza to testem na lokalnym PB.)

UI: publiczna trasa `GET /api/auth/methods` zwraca tylko flagi (bez sekretów); `/login`, `/login/email`
i `/signup` ukrywają wyłączone przyciski, a `/signup` przy wyłączonej rejestracji e-mail pokazuje komunikat.
Teksty EN/PL w `src/i18n/messages.ts`.

### 3.4 Odporność na import schematu

Karta pokazuje „Stan w PocketBase zgodny / niezgodny z ustawieniami” (porównanie `deriveUsersAuthConfig`
z rzeczywistą kolekcją) i przycisk „Zastosuj ponownie” (odtwarza także providera Google z `app_secrets`).
W `deploy/mikrus/README.md` krok: po imporcie `pb_schema.json` kliknij „Zastosuj ponownie”.

## 4. Etapy implementacji

- **Etap 1 (PR):** sekcja Administratorzy + dodawanie po e-mailu, `SPANKO_BOOTSTRAP_ADMIN_EMAILS`,
  test 403 dla tras `/api/admin/*`.
- **Etap 2 (PR):** karta Logowanie Google (zapis do PB + kopia w `app_secrets`, sprawdzenie konfiguracji).
- **Etap 3 (PR):** przełączniki metod (pola w `admin_settings` → zmiana `pb_schema.json`, `validateAuthMethods`,
  `deriveUsersAuthConfig`, `GET /api/auth/methods`, UI logowania/rejestracji, „Zastosuj ponownie”).

Każdy etap: `pnpm check` + `pnpm test`, docs w `docs/agent/database.md` i `docs/agent/ai-and-admin.md`.
Etap 3 zmienia schemat: po scaleniu import `pb_schema.json` lokalnie i na produkcji (backup przed importem),
potem „Zastosuj ponownie” i `pnpm dev:seed` lokalnie.

## 5. Produkcja: konto admina (osobno od kodu)

Prośba Gosi: na produkcji adminem ma być tylko `malgosiacomarch@gmail.com`. Robione przez sesję na
komputerze Gosi (SSH na bill132): backup bazy, sprawdzenie, czy konto istnieje, ustawienie `is_admin = true`
(i `verified = true`), odebranie roli pozostałym kontom. Jeśli konto jeszcze nie istnieje, trzeba się nim
najpierw raz zalogować/zarejestrować, a wtedy (albo przez `SPANKO_BOOTSTRAP_ADMIN_EMAILS` z etapu 1) nadać rolę.
