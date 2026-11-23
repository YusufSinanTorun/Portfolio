import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { onRequestPost as login } from "../functions/api/admin/login.js";
import { onRequestGet as session } from "../functions/api/admin/session.js";
import { onRequestPost as publish } from "../functions/api/admin/publish.js";

const password = "long-random-test-password-123456";
const env = {
  ADMIN_PASSWORD_HASH: createHash("sha256").update(password).digest("hex"),
  ADMIN_SESSION_SECRET: randomBytes(32).toString("hex"),
  GITHUB_REPO: "user/portfolio",
  GITHUB_BRANCH: "main",
  GITHUB_TOKEN: "test-token"
};
const origin = "https://example.pages.dev";

test("Password login creates a signed, HTTP-only session and rejects invalid requests", async () => {
  const wrong = await login({ request: new Request(`${origin}/api/admin/login`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong" })
  }), env });
  assert.equal(wrong.status, 401);

  const stolenOrigin = await login({ request: new Request(`${origin}/api/admin/login`, {
    method: "POST", headers: { Origin: "https://other.example", "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  }), env });
  assert.equal(stolenOrigin.status, 403);

  const good = await login({ request: new Request(`${origin}/api/admin/login`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  }), env });
  assert.equal(good.status, 200);
  const cookie = good.headers.get("set-cookie");
  assert.match(cookie, /^__Host-portfolio_admin=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  const cookieValue = cookie.split(";")[0];
  assert.equal((await session({ request: new Request(`${origin}/api/admin/session`, { headers: { Cookie: cookieValue } }), env })).status, 200);
  assert.equal((await session({ request: new Request(`${origin}/api/admin/session`, { headers: { Cookie: cookieValue.slice(0, -1) + "x" } }), env })).status, 401);
});

test("One upload writes the image and exhibition JSON into a single Git commit", async () => {
  const good = await login({ request: new Request(`${origin}/api/admin/login`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  }), env });
  const cookieValue = good.headers.get("set-cookie").split(";")[0];
  const form = new FormData();
  form.set("collectionId", "");
  form.set("collectionTitle", "Neue Collage");
  form.set("collectionDescription", "Eigene Werke");
  form.set("artTitle", "Erstes Bild");
  form.set("caption", "Bleistift");
  form.set("alt", "Handzeichnung mit Figuren");
  form.set("image", new File([new Uint8Array([255, 216, 255, 224])], "skizze.jpg", { type: "image/jpeg" }));

  const previousFetch = globalThis.fetch;
  const manifest = await readFile(new URL("../data/exhibition.json", import.meta.url));
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const path = new URL(url).pathname;
    calls.push({ path, method: options.method, body: options.body && JSON.parse(options.body) });
    const answer = path.endsWith("/git/blobs") ? { sha: "blobsha" }
      : path.endsWith("/git/ref/heads/main") ? { object: { sha: "parent" } }
      : path.endsWith("/git/commits/parent") ? { tree: { sha: "oldtree" } }
      : path.endsWith("/contents/data/exhibition.json") ? { content: manifest.toString("base64") }
      : path.endsWith("/git/trees") ? { sha: "newtree" }
      : path.endsWith("/git/commits") ? { sha: "newcommit" }
      : path.endsWith("/git/refs/heads/main") ? { ok: true }
      : null;
    assert.ok(answer, `Unbekannte GitHub-Anfrage: ${path}`);
    return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await publish({ request: new Request(`${origin}/api/admin/publish`, {
      method: "POST", headers: { Origin: origin, Cookie: cookieValue }, body: form
    }), env });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).commit, "newcommit");
    const tree = calls.find(call => call.path.endsWith("/git/trees")).body;
    assert.equal(tree.base_tree, "oldtree");
    assert.equal(tree.tree.length, 2);
    assert.match(tree.tree[0].path, /^gfx\/exhibition\/.*\.jpg$/);
    assert.equal(tree.tree[1].path, "data/exhibition.json");
    assert.equal(JSON.parse(tree.tree[1].content).collections.at(-1).artworks[0].caption, "Bleistift");
    const newCommit = calls.find(call => call.path.endsWith("/git/commits") && call.method === "POST");
    assert.deepEqual(newCommit.body.parents, ["parent"]);
    assert.equal(calls.at(-1).body.force, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Invalid file data is rejected before GitHub is contacted", async () => {
  const good = await login({ request: new Request(`${origin}/api/admin/login`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  }), env });
  const form = new FormData();
  form.set("collectionId", "collage-2026-11");
  form.set("artTitle", "Unpassendes Bild");
  form.set("caption", "Test");
  form.set("alt", "Testbeschreibung");
  form.set("image", new File(["<script>"], "fake.jpg", { type: "image/jpeg" }));

  const previousFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("GitHub should never be contacted"); };
  try {
    const result = await publish({ request: new Request(`${origin}/api/admin/publish`, {
      method: "POST", headers: { Origin: origin, Cookie: good.headers.get("set-cookie").split(";")[0] }, body: form
    }), env });
    assert.equal(result.status, 400);
  } finally { globalThis.fetch = previousFetch; }
});
