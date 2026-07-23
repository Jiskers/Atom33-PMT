/* devboard marketing site — shared behavior */

/* ---- mobile nav toggle ---- */
const burger = document.getElementById("burger");
if (burger) {
  burger.addEventListener("click", () => {
    const nav = document.querySelector(".nav-links");
    const open = nav.style.display === "flex";
    nav.style.display = open ? "none" : "flex";
    nav.style.cssText += open ? "" : "position:absolute;top:62px;left:0;right:0;background:#191c22;flex-direction:column;padding:10px;border-bottom:1px solid #2a2f39;gap:2px;";
  });
}

/* ---- mini calendar recreation used on the homepage ---- */
function buildMiniCalendar(el) {
  if (!el) return;
  const flagged = { 20: "#E8564A", 25: "#E8C87A", 29: "#E8C87A" };
  const today = 22;
  const daysInMonth = 31;
  const startOffset = 3; // July 1 2026 is a Wednesday
  let html = "";
  for (let i = 0; i < startOffset; i++) html += `<div class="cd"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const classes = ["cd"];
    if (d === today) classes.push("today");
    if (flagged[d]) classes.push("flagged");
    html += `<div class="${classes.join(" ")}">${d}</div>`;
  }
  el.innerHTML = html;
}
buildMiniCalendar(document.getElementById("mini-cal"));

/* ---- releases feed (releases.html) ---- */
const releaseList = document.getElementById("release-list");
if (releaseList) {
  const REPO = "Jiskers/Atom33-PMT";
  fetch(`https://api.github.com/repos/${REPO}/releases`)
    .then((r) => {
      if (!r.ok) throw new Error(`GitHub API returned ${r.status}`);
      return r.json();
    })
    .then((releases) => {
      if (!Array.isArray(releases) || releases.length === 0) {
        releaseList.innerHTML = `<div class="release-loading">No releases published yet.</div>`;
        return;
      }
      releaseList.innerHTML = releases.map((rel) => {
        const date = new Date(rel.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
        const asset = (rel.assets || []).find((a) => a.name.endsWith(".exe"));
        const notes = mdLite(rel.body || "No release notes.");
        return `
          <div class="release-item">
            <div class="rhead">
              <span class="rtag">${escapeHtml(rel.tag_name)}</span>
              ${rel.name && rel.name !== rel.tag_name ? `<span>${escapeHtml(rel.name)}</span>` : ""}
              <span class="rdate">${date}</span>
              ${rel === releases[0] ? `<span class="badge">Latest</span>` : ""}
            </div>
            <div class="rnotes">${notes}</div>
            ${asset ? `<a class="btn btn-primary btn-sm" href="${asset.browser_download_url}">Download ${escapeHtml(asset.name)}</a>` : `<a class="btn btn-ghost btn-sm" href="${rel.html_url}" target="_blank" rel="noopener">View on GitHub</a>`}
          </div>`;
      }).join("");
    })
    .catch((err) => {
      releaseList.innerHTML = `<div class="release-error">Couldn't load releases (${escapeHtml(err.message)}). <a href="https://github.com/${REPO}/releases" target="_blank" rel="noopener">View them on GitHub instead →</a></div>`;
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* Minimal GitHub-flavored-markdown → HTML for release notes: headers,
   bullet lists, and **bold** only — release notes don't need more. */
function mdLite(src) {
  const lines = escapeHtml(src).split("\n");
  let html = "";
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = line.match(/^[-*]\s+(.*)/);
    if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inlineMd(bullet[1])}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (!line) continue;
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (h) { html += `<h4 style="color:var(--text); font-size:13.5px; margin:14px 0 4px;">${inlineMd(h[2])}</h4>`; continue; }
    html += `<p style="margin:6px 0;">${inlineMd(line)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}
function inlineMd(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "<strong style=\"color:var(--text)\">$1</strong>")
          .replace(/`(.+?)`/g, "<code class=\"code\">$1</code>")
          .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
