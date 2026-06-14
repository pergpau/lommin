// Short token lifetime limits how long a captured JWT (e.g. observed by the relay
// proxy) can be replayed against Enable Banking. The client re-mints on demand.
const JWT_LIFETIME = 300 // seconds

let cachedToken: string | null = null
let cacheExp = 0

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlJson(obj: object): string {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)).buffer as ArrayBuffer)
}

export async function mintJwt(key: CryptoKey, appId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && now < cacheExp - 30) return cachedToken

  const header = b64urlJson({ typ: 'JWT', alg: 'RS256', kid: appId })
  const payload = b64urlJson({
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + JWT_LIFETIME,
  })

  const message = `${header}.${payload}`
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(message),
  )

  cachedToken = `${message}.${b64url(sigBuf)}`
  cacheExp = now + JWT_LIFETIME
  return cachedToken
}

export function clearJwtCache() {
  cachedToken = null
  cacheExp = 0
}
