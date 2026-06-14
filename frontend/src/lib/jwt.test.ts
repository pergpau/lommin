import { beforeEach, describe, expect, it } from "vitest";
import { clearJwtCache, mintJwt } from "./jwt";

function genKeys() {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  ) as Promise<CryptoKeyPair>;
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function b64urlJson(s: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlDecode(s)));
}

describe("mintJwt", () => {
  beforeEach(() => clearJwtCache());

  it("produces a verifiable RS256 JWT with the expected claims", async () => {
    const { privateKey, publicKey } = await genKeys();
    const jwt = await mintJwt(privateKey, "app-123");
    const [h, p, sig] = jwt.split(".");
    expect(jwt.split(".")).toHaveLength(3);

    expect(b64urlJson(h)).toMatchObject({ typ: "JWT", alg: "RS256", kid: "app-123" });

    const payload = b64urlJson(p);
    expect(payload).toMatchObject({ iss: "enablebanking.com", aud: "api.enablebanking.com" });
    expect((payload.exp as number) - (payload.iat as number)).toBe(300);

    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      b64urlDecode(sig),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it("caches the token within its lifetime", async () => {
    const { privateKey } = await genKeys();
    const a = await mintJwt(privateKey, "app-123");
    const b = await mintJwt(privateKey, "app-123");
    expect(a).toBe(b);
  });
});
