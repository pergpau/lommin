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
});
