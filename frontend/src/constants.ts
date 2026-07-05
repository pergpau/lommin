// App name, used as the namespace prefix for all IndexedDB databases. This is a
// frozen internal token: IndexedDB has no rename API, so changing it would orphan
// every user's existing data. Keep it stable regardless of branding.
export const APP_NAME = "lommin";

export const PAGE_SIZE = 50;
export const SYNC_LOOKBACK_DAYS = 90;
export const SESSION_VALID_DAYS = 90;
export const JWT_LIFETIME_SECONDS = 300;
export const CHART_MONTHS = 6;
export const MAX_IMPORT_BYTES = 50 * 1024 * 1024; // 50 MB

export const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === "true";
