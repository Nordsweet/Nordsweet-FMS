import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_OIDC_ISSUER: "https://id.test",
    NEXT_PUBLIC_OIDC_CLIENT_ID: "client-1",
  },
}));

const { authorizationRequest, exchangeCode } = await import("./oidc");

const discovery = {
  issuer: "https://id.test",
  authorization_endpoint: "https://id.test/oauth/v2/authorize",
  token_endpoint: "https://id.test/oauth/v2/token",
  jwks_uri: "https://id.test/oauth/v2/keys",
  code_challenge_methods_supported: ["S256"],
};

afterEach(() => vi.unstubAllGlobals());

describe("Zitadel sign-in", () => {
  it("sends the browser to the issuer with PKCE, state and the roles scope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(discovery))),
    );
    const { url, pending } = await authorizationRequest(
      "https://fms.test/auth/callback",
    );
    expect(url.origin + url.pathname).toBe(discovery.authorization_endpoint);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "client-1",
      response_type: "code",
      redirect_uri: "https://fms.test/auth/callback",
      code_challenge_method: "S256",
      state: pending.state,
    });
    expect(url.searchParams.get("scope")).toContain("offline_access");
    expect(url.searchParams.get("scope")).toContain(
      "urn:zitadel:iam:org:project:roles",
    );
    // The verifier itself never leaves the browser; only its hash does.
    expect(url.search).not.toContain(pending.verifier);
  });

  it("refuses a callback whose state this browser did not issue", async () => {
    const fetchMock = vi.fn((_input: string | URL) =>
      Promise.resolve(Response.json(discovery)),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      exchangeCode(
        new URL("https://fms.test/auth/callback?code=abc&state=forged"),
        { state: "expected", verifier: "v" },
        "https://fms.test/auth/callback",
      ),
    ).rejects.toThrow();
    // No code was ever sent to the token endpoint.
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/oauth/v2/token"),
      ),
    ).toBe(false);
  });
});
