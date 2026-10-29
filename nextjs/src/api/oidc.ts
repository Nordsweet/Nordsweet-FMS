import * as oauth from "oauth4webapi";

import { env } from "~/env";

/**
 * Zitadel sign-in: authorization code with PKCE and no client secret (the app is a static page).
 * Off until both env vars are set. The access token goes to the Aviation API as the bearer token.
 */
export const oidcEnabled = Boolean(
  env.NEXT_PUBLIC_OIDC_ISSUER && env.NEXT_PUBLIC_OIDC_CLIENT_ID,
);

/** The roles scope makes Zitadel add the project's roles, which is what admits a user to the API. */
const SCOPE = "openid profile offline_access urn:zitadel:iam:org:project:roles";
/** sessionStorage: the state and PKCE verifier only have to survive the redirect to Zitadel and back. */
const PENDING = "nordsweet.oidc.pending";

export type Tokens = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  /** Epoch ms. */
  expiresAt: number;
};
type Pending = { state: string; verifier: string };

const issuer = () => new URL(env.NEXT_PUBLIC_OIDC_ISSUER ?? "");
const client = (): oauth.Client => ({
  client_id: env.NEXT_PUBLIC_OIDC_CLIENT_ID ?? "",
});
const redirectUri = () => new URL("/auth/callback", location.origin).href;

let discovered: Promise<oauth.AuthorizationServer> | undefined;
const metadata = () =>
  (discovered ??= oauth
    .discoveryRequest(issuer())
    .then((response) => oauth.processDiscoveryResponse(issuer(), response))
    .catch((error: unknown) => {
      discovered = undefined; // offline now must not break the next attempt
      throw error;
    }));

const toTokens = (r: oauth.TokenEndpointResponse): Tokens => ({
  accessToken: r.access_token,
  refreshToken: r.refresh_token,
  idToken: r.id_token,
  expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000,
});

export async function authorizationRequest(redirect: string) {
  const server = await metadata();
  const verifier = oauth.generateRandomCodeVerifier();
  const state = oauth.generateRandomState();
  const url = new URL(server.authorization_endpoint ?? "");
  url.search = new URLSearchParams({
    client_id: client().client_id,
    redirect_uri: redirect,
    response_type: "code",
    scope: SCOPE,
    code_challenge: await oauth.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
  }).toString();
  return { url, pending: { state, verifier } satisfies Pending };
}

/** Sends the browser to Zitadel; it comes back to /auth/callback. */
export async function startLogin() {
  const { url, pending } = await authorizationRequest(redirectUri());
  sessionStorage.setItem(PENDING, JSON.stringify(pending));
  location.assign(url);
}

export async function exchangeCode(
  callback: URL,
  pending: Pending,
  redirect: string,
) {
  const server = await metadata();
  const params = oauth.validateAuthResponse(
    server,
    client(),
    callback,
    pending.state,
  );
  const response = await oauth.authorizationCodeGrantRequest(
    server,
    client(),
    oauth.None(),
    params,
    redirect,
    pending.verifier,
  );
  return toTokens(
    await oauth.processAuthorizationCodeResponse(server, client(), response),
  );
}

/** Completes the redirect back from Zitadel. Throws when this browser did not start the login. */
export function finishLogin() {
  const saved = sessionStorage.getItem(PENDING);
  sessionStorage.removeItem(PENDING); // a state is single use
  if (!saved) throw new Error("No sign-in in progress");
  return exchangeCode(
    new URL(location.href),
    JSON.parse(saved) as Pending,
    redirectUri(),
  );
}

/** A new access token from the refresh token; Zitadel may rotate the refresh token too. */
export async function refreshTokens(refreshToken: string): Promise<Tokens> {
  const server = await metadata();
  const response = await oauth.refreshTokenGrantRequest(
    server,
    client(),
    oauth.None(),
    refreshToken,
  );
  const next = toTokens(
    await oauth.processRefreshTokenResponse(server, client(), response),
  );
  return { ...next, refreshToken: next.refreshToken ?? refreshToken };
}

/** Ends the Zitadel session (and with it the single sign-on on this device). */
export async function logoutUrl(idToken?: string) {
  const { end_session_endpoint } = await metadata();
  if (!end_session_endpoint) return null;
  const url = new URL(end_session_endpoint);
  url.searchParams.set("client_id", client().client_id);
  url.searchParams.set("post_logout_redirect_uri", location.origin);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  return url;
}
