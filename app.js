(function () {
  const STORE_KEY = "xonepaste_v1";

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveAll(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  /** short id like 54TKDcyh */
  function uid() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let id = "";
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 8; i++) id += chars[arr[i] % chars.length];
    return id;
  }

  function toast(msg) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function originBase() {
    return location.origin || (location.protocol + "//" + location.host);
  }

  /** https://pastexone.vercel.app/raw/54TKDcyh */
  function rawUrl(id) {
    return originBase() + "/raw/" + encodeURIComponent(id);
  }

  function viewUrl(id) {
    return originBase() + "/p/" + encodeURIComponent(id);
  }

  function editUrl(id) {
    return originBase() + "/p/" + encodeURIComponent(id) + "/edit";
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        return true;
      } catch {
        return false;
      }
    }
  }

  function getPaste(id) {
    const all = loadAll();
    const paste = all[id];
    if (!paste) return null;
    if (paste.expires && Date.now() > paste.expires) {
      delete all[id];
      saveAll(all);
      return null;
    }
    return paste;
  }

  function parsePath() {
    let path = location.pathname || "/";
    // support file:// or subfolder deploy
    path = path.replace(/\/index\.html$/i, "/");
    const parts = path.split("/").filter(Boolean);
    return parts;
  }

  function go(path) {
    if (location.protocol === "file:") {
      // file:// cannot use real paths — fall back to hash
      location.hash = "#" + path;
      route();
      return;
    }
    history.pushState(null, "", path);
    route();
  }

  function route() {
    // hash fallback for local file open
    if (location.protocol === "file:" && location.hash) {
      const h = location.hash.replace(/^#/, "") || "/";
      const parts = h.split("/").filter(Boolean);
      return dispatch(parts);
    }
    return dispatch(parsePath());
  }

  function dispatch(parts) {
    // /raw/:id  → plain text body (Pastebin-style)
    if (parts[0] === "raw" && parts[1]) {
      return renderRaw(parts[1]);
    }
    // /p/:id/edit
    if (parts[0] === "p" && parts[1] && parts[2] === "edit") {
      ensureShell();
      return renderEdit(parts[1]);
    }
    // /p/:id
    if (parts[0] === "p" && parts[1]) {
      ensureShell();
      return renderView(parts[1]);
    }
    if (parts[0] === "recent") {
      ensureShell();
      return renderRecent();
    }
    ensureShell();
    return renderNew();
  }

  function ensureShell() {
    // restore full page chrome if we came from raw
    if (!document.getElementById("app")) {
      document.documentElement.innerHTML = "";
      location.reload();
      return false;
    }
    // show chrome
    const top = document.querySelector(".top");
    const foot = document.querySelector(".foot");
    if (top) top.style.display = "";
    if (foot) foot.style.display = "";
    document.body.style.cssText = "";
    document.body.className = "";
    return true;
  }

  function renderRaw(id) {
    const paste = getPaste(id);
    // pure raw — no header/footer, plaintext only
    document.title = paste ? "raw/" + id : "not found";
    const text = paste ? paste.content : "404: paste not found";
    document.body.innerHTML = "";
    document.body.style.cssText =
      "margin:0;background:#fff;color:#111;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
      "white-space:pre-wrap;word-break:break-word;padding:0;";
    // match classic raw: plain text, no chrome
    const pre = document.createElement("pre");
    pre.style.cssText = "margin:0;padding:12px;white-space:pre-wrap;word-break:break-word;";
    pre.textContent = text;
    document.body.appendChild(pre);
  }

  function renderNew() {
    const app = document.getElementById("app");
    if (!app) return;
    document.title = "XonePaste";
    app.innerHTML = `
      <h1>New paste</h1>
      <div class="row">
        <div>
          <label for="title">Title (optional)</label>
          <input id="title" type="text" placeholder="Untitled" maxlength="120" />
        </div>
        <div>
          <label for="syntax">Syntax</label>
          <select id="syntax">
            <option value="text">Plain text</option>
            <option value="lua">Lua</option>
            <option value="js">JavaScript</option>
            <option value="py">Python</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="c">C / C++</option>
          </select>
        </div>
        <div>
          <label for="expire">Expire</label>
          <select id="expire">
            <option value="0">Never</option>
            <option value="3600000">1 hour</option>
            <option value="86400000">1 day</option>
            <option value="604800000">1 week</option>
          </select>
        </div>
      </div>
      <label for="content">Content</label>
      <textarea id="content" placeholder="Paste your text here…" spellcheck="false"></textarea>
      <div class="actions">
        <button class="btn btn-primary" id="btnSave" type="button">Create paste</button>
      </div>
    `;
    document.getElementById("btnSave").onclick = () => {
      const content = document.getElementById("content").value;
      if (!content.trim()) {
        toast("Content is empty");
        return;
      }
      const id = uid();
      const expireMs = Number(document.getElementById("expire").value) || 0;
      const now = Date.now();
      const all = loadAll();
      all[id] = {
        id,
        title: document.getElementById("title").value.trim() || "Untitled",
        syntax: document.getElementById("syntax").value,
        content,
        created: now,
        updated: now,
        expires: expireMs ? now + expireMs : null,
      };
      saveAll(all);
      go("/p/" + id);
      toast("Paste saved");
    };
  }

  function renderView(id) {
    const app = document.getElementById("app");
    if (!app) return;
    const paste = getPaste(id);
    if (!paste) {
      document.title = "Not found · XonePaste";
      app.innerHTML = `<div class="empty">Paste not found or expired.<br/><br/><a class="btn" href="/">New paste</a></div>`;
      bindNav();
      return;
    }
    document.title = paste.title + " · XonePaste";
    const when = new Date(paste.updated || paste.created).toLocaleString();
    const raw = rawUrl(id);
    app.innerHTML = `
      <div class="toolbar">
        <a class="btn" href="/p/${encodeURIComponent(id)}/edit" data-nav>Edit</a>
        <a class="btn" href="/raw/${encodeURIComponent(id)}" target="_blank" rel="noopener">Open Raw</a>
        <button class="btn" type="button" id="btnCopyRaw">Copy Raw</button>
        <button class="btn" type="button" id="btnCopyRawLink">Copy Raw Link</button>
        <button class="btn btn-ghost" type="button" id="btnDel">Delete</button>
        <a class="btn btn-ghost" href="/" data-nav>New</a>
      </div>
      <div class="meta">
        <strong>${escapeHtml(paste.title)}</strong>
        · ${escapeHtml(paste.syntax)}
        · updated ${escapeHtml(when)}
        · id <code>${escapeHtml(id)}</code>
      </div>
      <div class="meta raw-line">
        raw: <a href="${escapeHtml(raw)}" target="_blank" rel="noopener">${escapeHtml(raw)}</a>
      </div>
      <div class="view-box">${escapeHtml(paste.content)}</div>
    `;

    document.getElementById("btnCopyRaw").onclick = async () => {
      const ok = await copyText(paste.content);
      toast(ok ? "Raw content copied" : "Copy failed");
    };
    document.getElementById("btnCopyRawLink").onclick = async () => {
      const ok = await copyText(raw);
      toast(ok ? "Raw link copied" : "Copy failed");
    };
    document.getElementById("btnDel").onclick = () => {
      if (!confirm("Delete this paste?")) return;
      const all = loadAll();
      delete all[id];
      saveAll(all);
      go("/");
      toast("Deleted");
    };
    bindNav();
  }

  function renderEdit(id) {
    const app = document.getElementById("app");
    if (!app) return;
    const paste = getPaste(id);
    if (!paste) {
      app.innerHTML = `<div class="empty">Paste not found.</div>`;
      return;
    }
    document.title = "Edit · " + paste.title;
    app.innerHTML = `
      <h1>Edit paste</h1>
      <div class="row">
        <div>
          <label for="title">Title</label>
          <input id="title" type="text" maxlength="120" value="${escapeHtml(paste.title)}" />
        </div>
        <div>
          <label for="syntax">Syntax</label>
          <select id="syntax">
            ${["text", "lua", "js", "py", "html", "css", "json", "c"]
              .map(
                (s) =>
                  `<option value="${s}" ${paste.syntax === s ? "selected" : ""}>${s}</option>`
              )
              .join("")}
          </select>
        </div>
        <div></div>
      </div>
      <label for="content">Content</label>
      <textarea id="content" spellcheck="false">${escapeHtml(paste.content)}</textarea>
      <div class="actions">
        <button class="btn btn-primary" id="btnSave" type="button">Save changes</button>
        <a class="btn" href="/p/${encodeURIComponent(id)}" data-nav>Cancel</a>
      </div>
    `;
    document.getElementById("btnSave").onclick = () => {
      const all = loadAll();
      if (!all[id]) {
        toast("Paste missing");
        return;
      }
      all[id].title = document.getElementById("title").value.trim() || "Untitled";
      all[id].syntax = document.getElementById("syntax").value;
      all[id].content = document.getElementById("content").value;
      all[id].updated = Date.now();
      saveAll(all);
      go("/p/" + id);
      toast("Changes saved");
    };
    bindNav();
  }

  function renderRecent() {
    const app = document.getElementById("app");
    if (!app) return;
    document.title = "Recent · XonePaste";
    const all = loadAll();
    const list = Object.values(all)
      .filter((p) => !p.expires || p.expires > Date.now())
      .sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
    if (!list.length) {
      app.innerHTML = `<h1>Recent</h1><div class="empty">No pastes yet. <a href="/" data-nav>Create one</a></div>`;
      bindNav();
      return;
    }
    app.innerHTML = `
      <h1>Recent</h1>
      <ul class="list">
        ${list
          .map(
            (p) => `
          <li>
            <a href="/p/${encodeURIComponent(p.id)}" data-nav>
              <div>${escapeHtml(p.title)}</div>
              <div class="sub">${escapeHtml(p.syntax)} · ${new Date(
              p.updated || p.created
            ).toLocaleString()} · ${p.content.length} chars · /raw/${escapeHtml(p.id)}</div>
            </a>
          </li>`
          )
          .join("")}
      </ul>
    `;
    bindNav();
  }

  function bindNav() {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.addEventListener("click", (e) => {
        if (location.protocol === "file:") return;
        e.preventDefault();
        const href = a.getAttribute("href");
        if (href) go(href);
      });
    });
  }

  // header links
  document.getElementById("brandLink")?.addEventListener("click", (e) => {
    if (location.protocol === "file:") return;
    e.preventDefault();
    go("/");
  });
  document.getElementById("navNew")?.addEventListener("click", (e) => {
    if (location.protocol === "file:") return;
    e.preventDefault();
    go("/");
  });
  document.getElementById("navRecent")?.addEventListener("click", (e) => {
    if (location.protocol === "file:") return;
    e.preventDefault();
    go("/recent");
  });

  window.addEventListener("popstate", route);
  window.addEventListener("hashchange", route);
  route();
})();
