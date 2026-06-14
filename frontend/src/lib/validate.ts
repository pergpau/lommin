// Lightweight runtime validation for data crossing a trust boundary:
// Enable Banking API responses and imported backup / Spiir files. The shapes are
// declared by an external system (or an attacker-supplied file), so we validate
// before mapping or persisting instead of trusting `as` casts. Kept dependency-free
// (no Zod) — these guards are small and the surface is narrow.

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function asRecord(v: unknown, what: string): Record<string, unknown> {
  if (!isRecord(v)) throw new ValidationError(`Ugyldig data: forventet et objekt for ${what}.`);
  return v;
}

export function asArray(v: unknown, what: string): unknown[] {
  if (!Array.isArray(v)) throw new ValidationError(`Ugyldig data: forventet en liste for ${what}.`);
  return v;
}

// Tolerant readers — return undefined when the field is missing or the wrong type,
// for genuinely optional fields where a bad value should be dropped, not fatal.
export function optString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function optNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// Strict reader — throws when a required string is missing/empty/wrong type.
export function reqString(v: unknown, what: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new ValidationError(`Ugyldig data: mangler tekstfeltet ${what}.`);
  }
  return v;
}
