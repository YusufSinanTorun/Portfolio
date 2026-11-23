import { hasSession, sameOrigin } from "../../../server/auth.js";
import { commitArtwork } from "../../../server/github.js";
import { error, json } from "../../../server/http.js";

const MAX_IMAGE = 2 * 1024 * 1024;
const MAX_REQUEST = 2_300_000;

function field(form, name, max) {
  const value = form.get(name);
  if (typeof value !== "string") throw new Error("Ein Textfeld fehlt.");
  const clean = value.trim();
  if (!clean || clean.length > max || /[\u0000-\u001f\u007f]/.test(clean)) throw new Error("Bitte alle Texte ausfüllen und die Längen beachten.");
  return clean;
}

function imageType(file, bytes) {
  if (file.type === "image/png" && bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((number, i) => bytes[i] === number)) return "png";
  if (file.type === "image/jpeg" && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (file.type === "image/webp" && bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") return "webp";
  throw new Error("Nur gültige PNG-, JPEG- oder WebP-Bilder sind erlaubt.");
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return error("Ungültige Herkunft.", 403);
  if (!await hasSession(env, request)) return error("Nicht angemeldet.", 401);
  if (Number(request.headers.get("Content-Length") || 0) > MAX_REQUEST) return error("Bild ist zu groß (maximal 2 MB).", 413);

  let fileBytes, extension, fields;
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE) return error("Bild ist zu groß oder fehlt (maximal 2 MB).", 413);
    fileBytes = new Uint8Array(await file.arrayBuffer());
    extension = imageType(file, fileBytes);
    const collectionId = form.get("collectionId");
    if (typeof collectionId !== "string" || collectionId.length > 100 || (collectionId && !/^[\w-]+$/.test(collectionId))) throw new Error("Ungültige Sammlung.");
    fields = {
      collectionId,
      collectionTitle: collectionId ? "" : field(form, "collectionTitle", 100),
      collectionDescription: collectionId ? "" : field(form, "collectionDescription", 800),
      artTitle: field(form, "artTitle", 100),
      caption: field(form, "caption", 240),
      alt: field(form, "alt", 240)
    };
  } catch (cause) {
    return error(cause.message || "Ungültiges Formular.", 400);
  }

  try {
    const commit = await commitArtwork(env, fileBytes, extension, fields);
    return json({ ok: true, commit });
  } catch (cause) {
    return error(cause.message || "Veröffentlichung fehlgeschlagen.", cause.conflict ? 409 : 502);
  }
}
