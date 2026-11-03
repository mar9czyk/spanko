export interface AuthMethodToggles {
  readonly email: boolean;
  readonly google: boolean;
}

export interface AuthMethods {
  readonly login: AuthMethodToggles;
  readonly signup: AuthMethodToggles;
}

export const DEFAULT_AUTH_METHODS: AuthMethods = {
  login: { email: true, google: true },
  signup: { email: true, google: true },
};

const OAUTH2_ONLY_CLAUSE = '@request.context = "oauth2"';
const NOT_OAUTH2_CLAUSE = '@request.context != "oauth2"';
const CLAUSE_JOINER = " && ";

/**
 * Sprawdza spójność wybranych metod logowania i rejestracji.
 *
 * @description
 * Co najmniej jedna metoda logowania i jedna rejestracji; Google wymaga zapisanych kluczy;
 * rejestracja daną metodą wymaga logowania tą metodą (inaczej nowe konto nie mogłoby się zalogować).
 *
 * @param {AuthMethods} methods - Wybrane metody
 * @param {boolean} googleConfigured - Czy klucze Google są zapisane
 * @returns {string | null} Opis problemu lub null, gdy konfiguracja jest poprawna
 */
export function validateAuthMethods(
  methods: AuthMethods,
  googleConfigured: boolean,
): string | null {
  const { login, signup } = methods;
  if (!login.email && !login.google) return "Co najmniej jedna metoda logowania musi być włączona.";
  if (!signup.email && !signup.google) {
    return "Co najmniej jedna metoda rejestracji musi być włączona.";
  }
  if (!googleConfigured && (login.google || signup.google)) {
    return "Aby włączyć Google, najpierw zapisz Client ID i Client Secret.";
  }
  if (signup.email && !login.email) {
    return "Rejestracja e-mailem wymaga włączonego logowania e-mailem.";
  }
  if (signup.google && !login.google) {
    return "Rejestracja przez Google wymaga włączonego logowania przez Google.";
  }
  return null;
}

/**
 * Odczytuje dozwolone metody rejestracji z `createRule` kolekcji `users`.
 *
 * @param {string | null | undefined} createRule - Reguła tworzenia rekordu (null = rejestracja zamknięta)
 * @returns {AuthMethodToggles} Dozwolone metody rejestracji
 */
export function readSignupMethods(createRule: string | null | undefined): AuthMethodToggles {
  if (createRule === null || createRule === undefined) return { email: false, google: false };
  return {
    email: !createRule.includes(OAUTH2_ONLY_CLAUSE),
    google: !createRule.includes(NOT_OAUTH2_CLAUSE),
  };
}

/**
 * Buduje `createRule` z wybranymi metodami rejestracji, zachowując pozostałe warunki reguły.
 *
 * @description
 * PocketBase sprawdza `createRule` także przy zakładaniu konta przez OAuth2 i ustawia wtedy
 * `@request.context = "oauth2"`, więc jedna reguła rozróżnia obie metody.
 *
 * @param {string} createRule - Obecna reguła
 * @param {AuthMethodToggles} signup - Wybrane metody (co najmniej jedna)
 * @returns {string} Nowa reguła
 */
export function applySignupMethods(createRule: string, signup: AuthMethodToggles): string {
  const conditions = createRule
    .split(CLAUSE_JOINER)
    .map((condition) => condition.trim())
    .filter(
      (condition) =>
        condition !== "" && condition !== OAUTH2_ONLY_CLAUSE && condition !== NOT_OAUTH2_CLAUSE,
    );
  if (!signup.email) conditions.push(OAUTH2_ONLY_CLAUSE);
  if (!signup.google) conditions.push(NOT_OAUTH2_CLAUSE);
  return conditions.join(CLAUSE_JOINER);
}
