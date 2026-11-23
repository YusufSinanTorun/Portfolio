import { cp, mkdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "dist");
if (relative(root, out) !== "dist") throw new Error("Ungültiger Ausgabeordner.");
await mkdir(out, { recursive: true });
for (const name of ["index.html", "main", "pages", "project-list", "gfx", "data"]) {
  try {
    await stat(join(root, name));
    await cp(join(root, name), join(out, name), { recursive: true });
  } catch (cause) {
    if (cause.code !== "ENOENT") throw cause;
    if (name !== "gfx" && name !== "project-list") throw new Error(`Projektdateien fehlen: ${name}`);
  }
}
console.log("Statische Website wurde nach dist/ gebaut.");
