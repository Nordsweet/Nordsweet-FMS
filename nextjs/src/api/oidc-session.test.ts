import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshTokens = vi.fn();
vi.mock("./oidc", () => ({ refreshTokens }));
// The auth store persists to localStorage as in a browser. Node has none, and Node 24's
// navigator.locks takes the cross-tab path that rehydrates from it.
const stored = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => void stored.set(key, value),
  removeItem: (key: string) => void stored.delete(key),
});

const { useAuth } = await import("~/stores/auth");
const { expiring, renewedToken } = await import("./oidc-session");

const session = (expiresInMs: number) => ({
  token: "old",
  username: "pilot",
  role: "user",
  refreshToken: "r1",
  expiresAt: Date.now() + expiresInMs,
});

beforeEach(() => {
  refreshTokens.mockReset();
  useAuth.setState({ session: session(5_000) });
});

describe("Zitadel token renewal", () => {
  it("only renews a token that is about to expire", () => {
    expect(expiring(session(5_000))).toBe(true);
    expect(expiring(session(3_600_000))).toBe(false);
    // A password-login token has no refresh token and is never renewed here.
    expect(expiring({ token: "t", username: "u", role: "user" })).toBe(false);
  });

  it("renews once for concurrent requests and keeps the rotated refresh token", async () => {
    refreshTokens.mockResolvedValue({
      accessToken: "new",
      refreshToken: "r2",
      expiresAt: Date.now() + 3_600_000,
    });
    const tokens = await Promise.all([renewedToken(), renewedToken()]);
    expect(tokens).toEqual(["new", "new"]);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(useAuth.getState().session).toMatchObject({
      token: "new",
      refreshToken: "r2",
      username: "pilot",
    });
  });

  it("signs out when the refresh token was revoked", async () => {
    refreshTokens.mockRejectedValue(
      Object.assign(new Error("bad"), { error: "invalid_grant" }),
    );
    expect(await renewedToken()).toBeUndefined();
    expect(useAuth.getState().session).toBeNull();
  });

  it("stays signed in when Zitadel cannot be reached", async () => {
    refreshTokens.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await renewedToken()).toBe("old");
    expect(useAuth.getState().session?.token).toBe("old");
  });
});
