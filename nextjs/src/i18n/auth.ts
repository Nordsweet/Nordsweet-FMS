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
  "auth.zitadel": "Sign in",
  "auth.signup": "Sign up",
  "auth.zitadel.hint":
    "Opens the sign-in page: use your email or username with your password, or a passkey.",
  "auth.legacy": "Old account login",
  "auth.callback.working": "Signing you in…",
  "auth.callback.failed":
    "Sign-in failed or your account has no access. Try again.",
  "auth.callback.back": "Back to sign in",
  "users.title": "Create user",
  "users.intro":
    "Creates an account in Zitadel. The person signs in with this initial password, then must change it.",
  "users.username": "Username",
  "users.firstName": "First name",
  "users.lastName": "Last name",
  "users.email": "Email",
  "users.password": "Initial password",
  "users.role": "Role",
  "users.role.user": "User",
  "users.role.admin": "Admin",
  "users.create": "Create user",
  "users.creating": "Creating…",
  "users.created":
    "User {username} created. They sign in with the Sign in button, using their email or username and the initial password, and must change it.",
  "users.error.taken": "That username is already taken.",
  "users.error.forbidden": "Only admins can create users.",
  "users.error.invalid":
    "Check the fields: the username is 3–32 letters, digits, . _ - and the password at least 8 characters.",
  "users.error.notConfigured":
    "Creating users is not set up on the server yet.",
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
  "auth.zitadel": "Zaloguj się",
  "auth.signup": "Załóż konto",
  "auth.zitadel.hint":
    "Otwiera stronę logowania: użyj e-maila lub nazwy użytkownika i hasła albo klucza dostępu.",
  "auth.legacy": "Logowanie starym kontem",
  "auth.callback.working": "Logowanie…",
  "auth.callback.failed":
    "Logowanie nie powiodło się lub konto nie ma dostępu. Spróbuj ponownie.",
  "auth.callback.back": "Wróć do logowania",
  "users.title": "Utwórz użytkownika",
  "users.intro":
    "Tworzy konto w Zitadel. Osoba loguje się tym hasłem początkowym i musi je zmienić.",
  "users.username": "Użytkownik",
  "users.firstName": "Imię",
  "users.lastName": "Nazwisko",
  "users.email": "E-mail",
  "users.password": "Hasło początkowe",
  "users.role": "Rola",
  "users.role.user": "Użytkownik",
  "users.role.admin": "Administrator",
  "users.create": "Utwórz użytkownika",
  "users.creating": "Tworzenie…",
  "users.created":
    "Użytkownik {username} został utworzony. Loguje się przyciskiem Zaloguj się, używając e-maila lub nazwy użytkownika i hasła początkowego, i musi je zmienić.",
  "users.error.taken": "Ta nazwa użytkownika jest zajęta.",
  "users.error.forbidden": "Tylko administratorzy mogą tworzyć użytkowników.",
  "users.error.invalid":
    "Sprawdź pola: nazwa użytkownika to 3–32 liter, cyfr lub . _ - a hasło co najmniej 8 znaków.",
  "users.error.notConfigured":
    "Tworzenie użytkowników nie jest jeszcze skonfigurowane na serwerze.",
};
