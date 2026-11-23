(() => {
  "use strict";

  const gallery = document.querySelector("#gallery");
  const dialog = document.querySelector("#admin-dialog");
  const login = document.querySelector("#admin-login");
  const publish = document.querySelector("#admin-publish");
  const status = document.querySelector("#admin-status");
  const collectionSelect = document.querySelector("#admin-collection");
  const newCollection = document.querySelector("#admin-new-collection");
  let collections = [];

  const el = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  };
  const message = (value, error = false) => {
    status.textContent = value;
    status.dataset.error = String(error);
  };

  function render(data) {
    if (!data || !Array.isArray(data.collections)) throw new Error("Ungültige Ausstellung.");
    collections = data.collections;
    const fragment = document.createDocumentFragment();

    for (const [index, collection] of collections.entries()) {
      const section = el("section", "exhibition-collection");
      const intro = el("div", "collection-intro");
      intro.append(el("p", "collection-index", `Sammlung ${String(index + 1).padStart(2, "0")}`));
      intro.append(el("h2", "", collection.title));
      intro.append(el("p", "", collection.description));
      section.append(intro);

      const grid = el("div", "exhibition-grid");
      for (const work of collection.artworks || []) {
        // Repository paths are data, never unrestricted external URLs or HTML.
        if (!/^\/gfx\/[a-zA-Z0-9/_-]+\.(?:png|jpe?g|webp)$/.test(work.image)) continue;
        const figure = el("figure", "exhibition-card");
        const media = el("div", "exhibition-media");
        const img = document.createElement("img");
        img.src = work.image;
        img.alt = work.alt || work.title || "Eigenzeichnung";
        img.loading = "lazy";
        media.append(img);
        const caption = document.createElement("figcaption");
        caption.append(el("strong", "", work.title || "Ohne Titel"));
        caption.append(el("span", "", work.caption || ""));
        figure.append(media, caption);
        grid.append(figure);
      }
      section.append(grid);
      fragment.append(section);
    }

    gallery.replaceChildren(fragment);
    collectionSelect.replaceChildren(new Option("Neue Sammlung erstellen", ""));
    for (const collection of collections) collectionSelect.add(new Option(collection.title, collection.id));
  }

  async function loadGallery() {
    try {
      const response = await fetch("../data/exhibition.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("Sammlung kann nicht geladen werden.");
      render(await response.json());
    } catch (error) {
      // Keep the four HTML figures if the page is opened without a web server.
      console.warn("Ausstellung verwendet die HTML-Ansicht:", error);
    }
  }

  function toggleCollectionFields() {
    const isNew = !collectionSelect.value;
    newCollection.hidden = !isNew;
    for (const field of newCollection.querySelectorAll("input, textarea")) field.required = isNew;
  }

  function showAuthenticated(authenticated) {
    login.hidden = authenticated;
    publish.hidden = !authenticated;
    if (authenticated) toggleCollectionFields();
  }

  async function api(path, options) {
    const response = await fetch(`/api/admin/${path}`, { credentials: "same-origin", cache: "no-store", ...options });
    let result;
    try { result = await response.json(); } catch { throw new Error("Serverantwort unlesbar."); }
    if (!response.ok) throw new Error(result.error || "Anfrage fehlgeschlagen.");
    return result;
  }

  document.querySelector("#admin-open").addEventListener("click", async () => {
    dialog.showModal();
    message("");
    showAuthenticated(false);
    try {
      await api("session");
      showAuthenticated(true);
    } catch (error) {
      if (error.message !== "Nicht angemeldet.") message(error.message, true);
    }
  });
  document.querySelector("#admin-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  collectionSelect.addEventListener("change", toggleCollectionFields);

  login.addEventListener("submit", async event => {
    event.preventDefault();
    const button = login.querySelector("button[type=submit]");
    button.disabled = true;
    message("Passwort wird geprüft …");
    try {
      await api("login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: login.elements.namedItem("password").value })
      });
      login.reset();
      showAuthenticated(true);
      message("Angemeldet. Wähle ein Bild und eine Sammlung.");
    } catch (error) { message(error.message, true); }
    finally { button.disabled = false; }
  });

  publish.addEventListener("submit", async event => {
    event.preventDefault();
    const file = publish.querySelector("input[type=file]").files[0];
    if (!file || file.size > 2 * 1024 * 1024) { message("Bitte ein Bild unter 2 MB wählen.", true); return; }
    const button = publish.querySelector("button[type=submit]");
    button.disabled = true;
    message("Bild und Texte werden als Git-Commit gespeichert …");
    try {
      const result = await api("publish", { method: "POST", body: new FormData(publish) });
      publish.reset();
      toggleCollectionFields();
      message(`Gespeichert (${result.commit.slice(0, 7)}). Öffentlich nach dem nächsten erfolgreichen Cloudflare-Deployment.`);
    } catch (error) { message(error.message, true); }
    finally { button.disabled = false; }
  });

  document.querySelector("#admin-logout").addEventListener("click", async () => {
    try {
      await api("logout", { method: "POST" });
      showAuthenticated(false);
      message("Abgemeldet.");
    } catch (error) { message(error.message, true); }
  });

  loadGallery();
})();
