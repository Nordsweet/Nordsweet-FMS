export const authEn = {
  "auth.title": "Sign in",
  "auth.intro": "Sign in to the Nordsweet Aviation API to use the planner.",
  "auth.username": "Username",
  "auth.password": "Password",
  "auth.submit": "Sign in",
  "auth.submitting": "Signing in…",
  "auth.noAccount": "There is no self-signup: ask an admin for an account.",
  "auth.error.credentials": "Wrong username or password.",
  "auth.error.tooMany": "Too many failed attempts. Try again in a minute.",
  "auth.error.offline": "No connection to the Aviation API. Check the network.",
  "auth.error.failed": "Sign-in failed ({status}). Try again later.",
  "auth.signOut": "Sign out",
  "auth.signedInAs": "Signed in as {username}",
  "auth.callback.working": "Signing you in…",
  "auth.callback.failed":
    "Sign-in failed or your account has no access. Try again.",
  "auth.callback.back": "Back to sign in",
} as const;

export const authPl: Record<keyof typeof authEn, string> = {
  "auth.title": "Logowanie",
  "auth.intro":
    "Zaloguj się do Nordsweet Aviation API, aby korzystać z planera.",
  "auth.username": "Użytkownik",
  "auth.password": "Hasło",
  "auth.submit": "Zaloguj",
  "auth.submitting": "Logowanie…",
  "auth.noAccount":
    "Nie ma samodzielnej rejestracji: poproś administratora o konto.",
  "auth.error.credentials": "Nieprawidłowy użytkownik lub hasło.",
  "auth.error.tooMany": "Za dużo nieudanych prób. Spróbuj ponownie za minutę.",
  "auth.error.offline": "Brak połączenia z Aviation API. Sprawdź sieć.",
  "auth.error.failed":
    "Logowanie nie powiodło się ({status}). Spróbuj później.",
  "auth.signOut": "Wyloguj",
  "auth.signedInAs": "Zalogowano jako {username}",
  "auth.callback.working": "Logowanie…",
  "auth.callback.failed":
    "Logowanie nie powiodło się lub konto nie ma dostępu. Spróbuj ponownie.",
  "auth.callback.back": "Wróć do logowania",
};
