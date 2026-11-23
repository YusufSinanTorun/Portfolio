import { clearSessionCookie, sameOrigin } from "../../../server/auth.js";
import { error, json } from "../../../server/http.js";

export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return error("Ungültige Herkunft.", 403);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
}
