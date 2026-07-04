import { describe, expect, it } from "vitest";
import {
  classifyBackupError,
  compareFreshness,
  computeBackupHash,
  decideSyncAction,
  shouldWarnBeforeRestore,
} from "./backup";
import { DriveAuthError } from "./googleDrive";

describe("classifyBackupError", () => {
  it("maps decrypt failure with a passphrase to wrong-passphrase", () => {
    const e = new DOMException("decrypt failed", "OperationError");
    expect(classifyBackupError(e, true)).toBe("wrong-passphrase");
  });

  it("maps decrypt failure without a passphrase to passphrase-required", () => {
    const e = new DOMException("decrypt failed", "OperationError");
    expect(classifyBackupError(e, false)).toBe("passphrase-required");
  });

  it("maps DriveAuthError to drive-auth", () => {
    expect(classifyBackupError(new DriveAuthError(), false)).toBe("drive-auth");
  });

  it("maps file-picker aborts to cancelled", () => {
    expect(classifyBackupError(new DOMException("aborted", "AbortError"), false)).toBe("cancelled");
  });

  it("maps everything else to unknown", () => {
    expect(classifyBackupError(new Error("boom"), true)).toBe("unknown");
    expect(classifyBackupError(null, false)).toBe("unknown");
    expect(classifyBackupError("string error", false)).toBe("unknown");
  });
});

describe("shouldWarnBeforeRestore", () => {
  it("warns when the backup has fewer transactions than local", () => {
    expect(shouldWarnBeforeRestore(5, 10)).toBe(true);
    expect(shouldWarnBeforeRestore(0, 1)).toBe(true);
  });

  it("does not warn when the backup has as many or more", () => {
    expect(shouldWarnBeforeRestore(10, 10)).toBe(false);
    expect(shouldWarnBeforeRestore(11, 10)).toBe(false);
    expect(shouldWarnBeforeRestore(0, 0)).toBe(false);
  });
});

describe("compareFreshness", () => {
  it("detects same, local-newer and backup-newer", () => {
    expect(compareFreshness(1000, 1000)).toBe("same");
    expect(compareFreshness(2000, 1000)).toBe("local-newer");
    expect(compareFreshness(1000, 2000)).toBe("backup-newer");
  });

  it("treats a missing side as older when the other is known", () => {
    expect(compareFreshness(1000, null)).toBe("local-newer");
    expect(compareFreshness(null, 1000)).toBe("backup-newer");
  });

  it("is unknown when both sides are missing", () => {
    expect(compareFreshness(null, null)).toBe("unknown");
  });
});

describe("decideSyncAction", () => {
  const base = {
    driveAutosave: true,
    backupMethod: "drive" as const,
    usePassphrase: false,
    lastDataModifiedAt: null as number | null,
    lastLocalSavedAt: null as number | null,
  };
  const token = { has: true, had: true };

  it("is disabled when autosave is off, method is file, or a passphrase is set", () => {
    expect(decideSyncAction({ ...base, driveAutosave: false }, token, null)).toBe("disabled");
    expect(decideSyncAction({ ...base, backupMethod: "file" }, token, null)).toBe("disabled");
    expect(decideSyncAction({ ...base, usePassphrase: true }, token, null)).toBe("disabled");
  });

  it("requires reauth only when a token existed and expired", () => {
    expect(decideSyncAction(base, { has: false, had: true }, null)).toBe("reauth-needed");
    expect(decideSyncAction(base, { has: false, had: false }, null)).toBe("disabled");
  });

  it("pushes when local changes are unsaved", () => {
    expect(
      decideSyncAction({ ...base, lastDataModifiedAt: 2000, lastLocalSavedAt: 1000 }, token, null),
    ).toBe("push");
    expect(
      decideSyncAction({ ...base, lastDataModifiedAt: 2000, lastLocalSavedAt: null }, token, null),
    ).toBe("push");
  });

  it("pulls when the remote backup is newer", () => {
    expect(
      decideSyncAction({ ...base, lastDataModifiedAt: 1000, lastLocalSavedAt: 1000 }, token, 2000),
    ).toBe("pull");
    expect(decideSyncAction(base, token, 2000)).toBe("pull");
  });

  it("is in sync when the remote is not newer or has no backup", () => {
    expect(
      decideSyncAction({ ...base, lastDataModifiedAt: 1000, lastLocalSavedAt: 2000 }, token, 2000),
    ).toBe("in-sync");
    expect(
      decideSyncAction({ ...base, lastDataModifiedAt: 1000, lastLocalSavedAt: 2000 }, token, 1500),
    ).toBe("in-sync");
    expect(
      decideSyncAction({ ...base, lastDataModifiedAt: 1000, lastLocalSavedAt: 2000 }, token, null),
    ).toBe("in-sync");
  });
});

describe("computeBackupHash", () => {
  const payload = {
    accounts: [{ uid: "a1" }],
    transactions: [{ id: "t1", amount: -42 }],
    cursors: [],
  };

  it("ignores exportedAt so identical data hashes identically", async () => {
    const h1 = await computeBackupHash({ ...payload, exportedAt: 1000 });
    const h2 = await computeBackupHash({ ...payload, exportedAt: 2000 });
    expect(h1).toBe(h2);
  });

  it("changes when the data changes", async () => {
    const h1 = await computeBackupHash({ ...payload, exportedAt: 1000 });
    const h2 = await computeBackupHash({
      ...payload,
      transactions: [{ id: "t1", amount: -43 }],
      exportedAt: 1000,
    });
    expect(h1).not.toBe(h2);
  });
});
