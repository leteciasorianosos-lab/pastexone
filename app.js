(function () {
  const STORE_KEY = "xonepaste_v1";
  const app = document.getElementById("app");

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

  function uid() {
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return t + r;
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
      .replace(/>/g, "&gt;");
  }

  function route() {
    const hash = location.hash || "#/";
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "p" && parts[1]) {
      if (parts[2] === "edit") return renderEdit(parts[1]);
      if (parts[2] === "raw") return renderRaw(parts[1]);
      return renderView(parts[1]);
    }
    if (parts[0] === "recent") return renderRecent();
    return renderNew();
  }

  function renderNew() {
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
      const paste = {
        id,
        title: document.getElementById("title").value.trim() || "Untitled",
        syntax: document.getElementById("syntax").value,
        content,
        created: now,
        updated: now,
        expires: expireMs ? now + expireMs : null,
      };
      const all = loadAll();
      all[id] = paste;
      saveAll(all);
      location.hash = "#/p/" + id;
      toast("Paste saved");
    };
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

  function renderView(id) {
    const paste = getPaste(id);
    if (!paste) {
      app.innerHTML = `<div class="empty">Paste not found or expired.<br/><br/><a class="btn" href="#/">New paste</a></div>`;
      return;
    }
    const when = new Date(paste.updated || paste.created).toLocaleString();
    app.innerHTML = `
      <div class="toolbar">
        <a class="btn" href="#/p/${id}/edit">Edit</a>
        <a class="btn" href="#/p/${id}/raw" target="_blank">Open Raw</a>
        <button class="btn" type="button" id="btnCopy">Copy Raw</button>
        <button class="btn btn-ghost" type="button" id="btnDel">Delete</button>
        <a class="btn btn-ghost" href="#/">New</a>
      </div>
      <div class="meta">
        <strong>${escapeHtml(paste.title)}</strong>
        · ${escapeHtml(paste.syntax)}
        · updated ${escapeHtml(when)}
        · id <code>${escapeHtml(id)}</code>
      </div>
      <div class="view-box">${escapeHtml(paste.content)}</div>
    `;
    document.getElementById("btnCopy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(paste.content);
        toast("Copied to clipboard");
      } catch {
        const ta = document.createElement("textarea");
        ta.value = paste.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        toast("Copied");
      }
    };
    document.getElementById("btnDel").onclick = () => {
      if (!confirm("Delete this paste?")) return;
      const all = loadAll();
      delete all[id];
      saveAll(all);
      location.hash = "#/";
      toast("Deleted");
    };
  }

  function renderEdit(id) {
    const paste = getPaste(id);
    if (!paste) {
      app.innerHTML = `<div class="empty">Paste not found.</div>`;
      return;
    }
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
            ${["text","lua","js","py","html","css","json","c"].map(
              (s) => `<option value="${s}" ${paste.syntax === s ? "selected" : ""}>${s}</option>`
            ).join("")}
          </select>
        </div>
        <div></div>
      </div>
      <label for="content">Content</label>
      <textarea id="content" spellcheck="false">${escapeHtml(paste.content)}</textarea>
      <div class="actions">
        <button class="btn btn-primary" id="btnSave" type="button">Save changes</button>
        <a class="btn" href="#/p/${id}">Cancel</a>
      </div>
    `;
    document.getElementById("btnSave").onclick = () => {
      const content = document.getElementById("content").value;
      const all = loadAll();
      if (!all[id]) {
        toast("Paste missing");
        return;
      }
      all[id].title = document.getElementById("title").value.trim() || "Untitled";
      all[id].syntax = document.getElementById("syntax").value;
      all[id].content = content;
      all[id].updated = Date.now();
      saveAll(all);
      location.hash = "#/p/" + id;
      toast("Changes saved");
    };
  }

  function renderRaw(id) {
    const paste = getPaste(id);
    // plain document for "Open Raw"
    document.body.innerHTML = "";
    document.body.style.cssText =
      "margin:0;background:#0d1117;color:#e6edf3;font:13px/1.45 ui-monospace,monospace;white-space:pre-wrap;padding:16px;word-break:break-word;";
    document.body.textContent = paste ? paste.content : "Not found";
  }

  function renderRecent() {
    const all = loadAll();
    const list = Object.values(all)
      .filter((p) => !p.expires || p.expires > Date.now())
      .sort((a, b) => (b.updated || b.created) - (a.updated || a.created));
    if (!list.length) {
      app.innerHTML = `<h1>Recent</h1><div class="empty">No pastes yet. <a href="#/">Create one</a></div>`;
      return;
    }
    app.innerHTML = `
      <h1>Recent</h1>
      <ul class="list">
        ${list
          .map(
            (p) => `
          <li>
            <a href="#/p/${p.id}">
              <div>${escapeHtml(p.title)}</div>
              <div class="sub">${escapeHtml(p.syntax)} · ${new Date(p.updated || p.created).toLocaleString()} · ${p.content.length} chars</div>
            </a>
          </li>`
          )
          .join("")}
      </ul>
    `;
  }

  window.addEventListener("hashchange", route);
  route();
})();
