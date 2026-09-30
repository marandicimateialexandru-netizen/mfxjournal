const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, keyMaterial, 256);
  return new Uint8Array(bits);
}

/** Local-account password hashing via the Web Crypto API already built into the webview — no
 *  external dependency needed. This protects against a housemate casually opening someone else's
 *  profile, not a serious remote attacker; that threat model matches what local profiles are for
 *  (this app has no server, nothing here is ever sent anywhere). */
export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt);
  return { hash: bytesToBase64(bits), salt: bytesToBase64(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const bits = await deriveBits(password, base64ToBytes(salt));
  return bytesToBase64(bits) === hash;
}
