import { describe, expect, it } from "vitest";
import { decryptStore, encryptStore } from "./cryptoFile";

describe("cryptoFile", () => {
  it("round-trips data with the correct passphrase", async () => {
    const data = { accounts: [{ uid: "a", n: 42 }], cursors: [] };
    const blob = await encryptStore(data, "correct horse battery staple");
    expect(await decryptStore(blob, "correct horse battery staple")).toEqual(data);
  });

  it("rejects decryption with the wrong passphrase", async () => {
    const blob = await encryptStore({ x: 1 }, "right-passphrase");
    await expect(decryptStore(blob, "wrong-passphrase")).rejects.toBeTruthy();
  });

  it("uses a fresh salt/iv each time (ciphertext differs for identical input)", async () => {
    const a = await encryptStore({ x: 1 }, "p");
    const b = await encryptStore({ x: 1 }, "p");
    expect([...a]).not.toEqual([...b]);
  });

  it("new blobs start with version byte 0x01", async () => {
    const blob = await encryptStore({ x: 1 }, "p");
    expect(blob[0]).toBe(0x01);
  });

  it("decrypts legacy uncompressed blobs (no version byte)", async () => {
    const data = { accounts: [{ uid: "legacy" }], cursors: [] };
    const passphrase = "legacy-pass";

    const SALT_LEN = 16;
    const IV_LEN = 12;
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN)) as Uint8Array<ArrayBuffer>;
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN)) as Uint8Array<ArrayBuffer>;
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const plaintext = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

    const legacy = new Uint8Array(SALT_LEN + IV_LEN + ciphertext.byteLength);
    legacy.set(salt, 0);
    legacy.set(iv, SALT_LEN);
    legacy.set(new Uint8Array(ciphertext), SALT_LEN + IV_LEN);

    expect(await decryptStore(legacy, passphrase)).toEqual(data);
  });
});
