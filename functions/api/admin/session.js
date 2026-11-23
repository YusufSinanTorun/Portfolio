import { hasSession } from "../../../server/auth.js";
import { error, json } from "../../../server/http.js";

export async function onRequestGet({ request, env }) {
  if (!await hasSession(env, request)) return error("Nicht angemeldet.", 401);
  return json({ ok: true });
}
