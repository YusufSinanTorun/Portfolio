const API = "https://api.github.com";

function repository(env) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO || "") || !/^[\w.-]+$/.test(env.GITHUB_BRANCH || "") || !env.GITHUB_TOKEN) {
    throw new Error("GitHub-Zugang ist noch nicht eingerichtet.");
  }
  return `/repos/${env.GITHUB_REPO}`;
}

async function github(env, path, method = "GET", body) {
  const response = await fetch(`${API}${repository(env)}${path}`, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2026-03-10",
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (response.status === 409 || response.status === 422) {
    const conflict = new Error("Der Git-Stand hat sich geändert. Bitte erneut versuchen.");
    conflict.conflict = true;
    throw conflict;
  }
  if (!response.ok) throw new Error(`GitHub konnte die Veröffentlichung nicht speichern (HTTP ${response.status}).`);
  return response.json();
}

function base64(bytes) {
  let result = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    result += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(result);
}

function jsonFromBase64(value) {
  const raw = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(raw, letter => letter.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function commitArtwork(env, fileBytes, extension, fields) {
  const imagePath = `gfx/exhibition/${crypto.randomUUID()}.${extension}`;
  const imageBlob = await github(env, "/git/blobs", "POST", { content: base64(fileBytes), encoding: "base64" });
  const branch = env.GITHUB_BRANCH;

  for (let attempt = 0; attempt < 2; attempt++) {
    const ref = await github(env, `/git/ref/heads/${encodeURIComponent(branch)}`);
    const parent = ref.object.sha;
    const [current, stored] = await Promise.all([
      github(env, `/git/commits/${parent}`),
      github(env, `/contents/data/exhibition.json?ref=${encodeURIComponent(parent)}`)
    ]);
    const manifest = jsonFromBase64(stored.content);
    if (!Array.isArray(manifest.collections)) throw new Error("Sammlungsdatei ist ungültig.");

    let collection;
    if (fields.collectionId) {
      collection = manifest.collections.find(item => item.id === fields.collectionId);
      if (!collection) throw new Error("Diese Sammlung existiert nicht mehr. Seite neu laden.");
    } else {
      collection = {
        id: crypto.randomUUID(),
        title: fields.collectionTitle,
        description: fields.collectionDescription,
        artworks: []
      };
      manifest.collections.push(collection);
    }
    if (!Array.isArray(collection.artworks)) throw new Error("Sammlungsdatei ist ungültig.");
    collection.artworks.push({
      id: crypto.randomUUID(),
      title: fields.artTitle,
      caption: fields.caption,
      alt: fields.alt,
      image: `/${imagePath}`
    });

    const tree = await github(env, "/git/trees", "POST", {
      base_tree: current.tree.sha,
      tree: [
        { path: imagePath, mode: "100644", type: "blob", sha: imageBlob.sha },
        { path: "data/exhibition.json", mode: "100644", type: "blob", content: JSON.stringify(manifest, null, 2) + "\n" }
      ]
    });
    const commit = await github(env, "/git/commits", "POST", {
      message: `Ausstellung: ${fields.artTitle}`,
      tree: tree.sha,
      parents: [parent]
    });
    try {
      await github(env, `/git/refs/heads/${encodeURIComponent(branch)}`, "PATCH", { sha: commit.sha, force: false });
      return commit.sha;
    } catch (error) {
      if (!error.conflict || attempt === 1) throw error;
    }
  }
  throw new Error("Veröffentlichung nicht abgeschlossen.");
}
