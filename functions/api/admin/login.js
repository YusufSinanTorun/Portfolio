import { passwordMatches, sameOrigin, sessionCookie } from "../../../server/auth.js";
import { error, json } from "../../../server/http.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return error("Ungültige Herkunft.", 403);
  if (Number(request.headers.get("Content-Length") || 0) > 1024) return error("Ungültige Anfrage.", 413);
  try {
    const { password } = await request.json();
    if (!await passwordMatches(password, env)) return error("Passwort stimmt nicht.", 401);
    return json({ ok: true }, 200, { "Set-Cookie": await sessionCookie(env, request) });
  } catch (cause) {
    if (cause.message === "Admin-Zugang ist noch nicht eingerichtet.") return error(cause.message, 503);
    return error("Ungültige Anfrage.", 400);
  }
}
