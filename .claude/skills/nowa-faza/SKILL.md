---
name: nowa-faza
description: Procedura realizacji nowej fazy/zadania w Spanko — plan w docs/plan-*.md, osobna sesja/worktree, implementacja, pnpm check + pnpm test, /code-review w świeżej sesji, commit/PR. Używaj, gdy użytkowniczka zaczyna nową fazę, funkcję lub większe zadanie.
---

# Nowa faza (sesja = zadanie = commit)

1. **Plan** — znajdź lub utwórz plik `docs/plan-<nazwa>.md` (wzór: istniejące `docs/plan-*.md`). Zawiera: cel, zakres/poza zakresem, kroki z checklistą `- [ ]`, pliki do zmiany, kryteria akceptacji. Przeczytaj tylko potrzebne `docs/agent/*.md` (progressive disclosure z CLAUDE.md). Przy większej fazie użyj trybu planu i poczekaj na akceptację.
2. **Sesja/worktree** — jedna faza = jedna sesja na własnej gałęzi `claude/<nazwa>` (worktree). Niezależne kroki planu, które nie dotykają tych samych plików, można rozdzielić na równoległe sesje.
3. **Implementacja** — trzymaj się guardrails z CLAUDE.md. Deleguj do subagentów:
   - zmiany w `src/lib/sleep-engine/` → `sleep-engine-guardian`,
   - schemat/reguły PocketBase → `pb-schema`,
   - po zmianach UI/słowników → `i18n-checker` (raport).
4. **Weryfikacja** — `pnpm check` (0 błędów) i `pnpm test` (wszystko zielone). Nie przechodź dalej przy błędach.
5. **Review** — uruchom `/code-review` w **świeżej sesji** (bez kontekstu implementacji), popraw potwierdzone uwagi, powtórz krok 4.
6. **Zamknięcie** — odhacz checklistę w pliku planu, jeden commit (Conventional Commits, np. `feat(goals): …`), PR do `main` tylko na prośbę użytkowniczki. Bez push/merge bez zgody.
