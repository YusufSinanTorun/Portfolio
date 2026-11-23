const COOKIE = "__Host-portfolio_admin";
const text = new TextEncoder();

function bytesToBase64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlToBytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
    return Uint8Array.from(raw, letter => letter.charCodeAt(0));
  } catch { return null; }
}
function configured(env) {
  return /^[a-f0-9]{64}$/i.test(env.ADMIN_PASSWORD_HASH || "") && (env.ADMIN_SESSION_SECRET || "").length >= 32;
}
async function key(secret) {
  return crypto.subtle.importKey("raw", text.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function requireConfiguration(env) {
  if (!configured(env)) throw new Error("Admin-Zugang ist noch nicht eingerichtet.");
}

export async function passwordMatches(password, env) {
  requireConfiguration(env);
  if (typeof password !== "string" || password.length < 16 || password.length > 256) return false;
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", text.encode(password)));
  const expected = env.ADMIN_PASSWORD_HASH.toLowerCase();
  let diff = 0;
  for (let i = 0; i < hash.length; i++) {
    diff |= hash[i] ^ parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  }
  return diff === 0;
}

export async function sessionCookie(env, request) {
  requireConfiguration(env);
  const expires = String(Date.now() + 60 * 60 * 1000);
  const nonce = crypto.randomUUID();
  const payload = `${expires}.${nonce}`;
  const signature = bytesToBase64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key(env.ADMIN_SESSION_SECRET), text.encode(payload))));
  const local = new URL(request.url).hostname === "localhost" || new URL(request.url).hostname === "127.0.0.1";
  return `${local ? "portfolio_admin" : COOKIE}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600${local ? "" : "; Secure"}`;
}

export async function hasSession(env, request) {
  if (!configured(env)) return false;
  const local = new URL(request.url).hostname === "localhost" || new URL(request.url).hostname === "127.0.0.1";
  const name = local ? "portfolio_admin" : COOKIE;
  const value = request.headers.get("Cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !/^[0-9a-f-]{36}$/.test(parts[1])) return false;
  if (Number(parts[0]) < Date.now()) return false;
  const signature = base64urlToBytes(parts[2]);
  if (!signature || signature.length !== 32) return false;
  return crypto.subtle.verify("HMAC", await key(env.ADMIN_SESSION_SECRET), signature, text.encode(`${parts[0]}.${parts[1]}`));
}

export function sameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

export function clearSessionCookie(request) {
  const local = new URL(request.url).hostname === "localhost" || new URL(request.url).hostname === "127.0.0.1";
  return `${local ? "portfolio_admin" : COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${local ? "" : "; Secure"}`;
}
