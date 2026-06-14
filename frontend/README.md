# Lommin

Frontend-only, local-first PSD2 spending tracker. You bring your own Enable Banking
`.pem`; the browser signs RS256 JWTs with Web Crypto and stores data in IndexedDB.

## Security model

- **Your key never leaves the device.** The `.pem` is imported as a non-extractable
  `CryptoKey`; raw bytes are unrecoverable by JS after import.
- **CORS proxy trust boundary.** Browsers can't call `api.enablebanking.com` directly,
  so requests are relayed through a proxy (`proxy/worker.ts`, a Cloudflare Worker). The
  default is a **shared hosted proxy** used by everyone. That proxy **can observe your
  transaction data and short-lived (5 min) access token in transit** — it never receives
  your signing key, and cannot mint new tokens. For full privacy, deploy your own proxy
  (`wrangler deploy`) and set its URL in **Settings → CORS Proxy**.
- **Proxy hardening.** The Worker only relays the Enable Banking endpoints the app uses,
  to allowlisted origins (`ALLOWED_ORIGINS`), with per-IP rate limiting (KV) and a
  minimal forwarded header set — it is not an open relay.
- **CSP.** `script-src 'self'` (no inline/eval) is the primary XSS defense. `connect-src`
  permits any HTTPS origin so users can configure a custom proxy at runtime.
- **Encrypted backup.** Optional export is AES-GCM encrypted with a PBKDF2-derived key;
  the passphrase never leaves the device.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
