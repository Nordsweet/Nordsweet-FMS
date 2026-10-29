# Zitadel sign-in

Status: **prepared, not switched.** The Aviation API accepts Zitadel tokens and the app has an OIDC
client and a callback page, but the login screen still uses username and password.

## Shape

The app is a static export behind nginx, so there is no server of ours to hold a secret or a
cookie: the browser runs authorization code + PKCE directly against Zitadel (`src/api/oidc.ts`,
`oauth4webapi`). The access token is the Aviation API bearer token, exactly where the 30-day API token
is today (`useAuth` → `aviationFetch`). Sessions are per device; "the same session on another device"
is the passkey (synced by the OS or password manager) plus a long-lived refresh token, not a shared cookie.

The API (`aviation-api-collector`, `app/oidc.py`) checks a token it does not recognise at
`{OIDC_ISSUER}/oidc/v1/userinfo`, cached 60 s, and admits a user who holds a project role (`admin` →
`admin`, `user` → `user`). The username is `preferred_username` without `@domain`, so a Zitadel user named
like an existing account reaches that account's synced data. The first sign-in creates the `users` row the
sync tables reference. Zitadel unreachable → `503` (never `401`, which signs the app out).

## Zitadel setup

1. **Project**: roles `user` and `admin`; enable *Assert Roles on Authentication* and *Check authorization
   on Authentication*, so the roles claim is issued and users without a grant cannot sign in.
2. **Application**: type Web, **PKCE** (auth method None), grant types Authorization Code + **Refresh Token**.
   Token type **Bearer** is enough (the API asks Zitadel, it does not read the JWT).
   - Redirect URIs: `https://dev.fms.lab.vibecde.com/auth/callback`, `http://localhost:3000/auth/callback`
     (plus production). Post-logout URIs: the same origins. Dev mode only while `http://localhost` is listed.
   - Origins of the redirect URIs are allowed for browser requests; add any other origin under *Additional
     Origins* if the browser reports a CORS error on the token endpoint. Leave the Login V2 base URL and
     the back-channel logout URI empty.
3. **Login behaviour** (instance or organisation): allow **passkeys**; turn *username and password* off
   after the cutover. Passkeys are bound to the Zitadel domain: keep `ExternalDomain` stable.
4. **Users**: create each existing account with the *same username* and grant it a project role. Passkeys
   are enrolled by the user (or via a registration link sent from the Console).
5. Lifetimes: raise the refresh-token idle and absolute expiry to what a pilot should stay signed in for.

## Switching on

Set `OIDC_ISSUER` on the API, and `NEXT_PUBLIC_OIDC_ISSUER` + `NEXT_PUBLIC_OIDC_CLIENT_ID` for the app
build (`oidcEnabled`). Still to do, in this order:

1. Login screen: a "Sign in with Zitadel" button calling `startLogin()` when `oidcEnabled`.
2. Token freshness: renew with `refreshTokens()` shortly before `session.expiresAt`, one request at a time,
   in one place that `aviationFetch`, `flight-sync`, `logbook`, `charts` and `sync/client` all read the token
   from (today each reads `useAuth` directly). A refresh that fails with `invalid_grant` ends the session;
   being offline must not.
3. Sign out: `api.auth.logout` is a no-op for Zitadel tokens; also redirect to `logoutUrl(idToken)`.
4. A browser test with a mocked issuer, then remove the password form and the API's `/auth/login` once
   every account exists in Zitadel.

Not verified against a live Zitadel yet: the exact console labels above, the roles scope/claim
(`urn:zitadel:iam:org:project:roles`) and the `userinfo` shape.
