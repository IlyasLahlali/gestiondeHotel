const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "frontend");

const LOGO_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" focusable="false">' +
  '<defs><linearGradient id="hf-logo-bg" x1="64" y1="48" x2="448" y2="464" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0%" stop-color="#3B82F6"/><stop offset="100%" stop-color="#2F64EA"/></linearGradient></defs>' +
  '<rect width="512" height="512" rx="108" fill="url(#hf-logo-bg)"/>' +
  '<path fill="#FFFFFF" d="M256 108 132 200v188h88V272h72v116h88V200L256 108z"/>' +
  '<rect x="228" y="292" width="56" height="96" rx="6" fill="#2F64EA"/>' +
  '<rect x="204" y="228" width="28" height="28" rx="4" fill="#2F64EA"/>' +
  '<rect x="280" y="228" width="28" height="28" rx="4" fill="#2F64EA"/>' +
  '<circle cx="372" cy="140" r="52" fill="#FBBF24"/>' +
  '<path fill="#FFFFFF" d="M372 108l9 27h29l-23 17 9 27-24-18-24 18 9-27-23-17h29z"/>' +
  "</svg>";

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

function baseFor(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  if (rel === "index.html" || rel === "login.html" || rel === "register.html") return "";
  return "../../";
}

function homeFor(filePath, href) {
  if (href && href !== "#") return href;
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  if (rel.startsWith("Public/")) return "index.html";
  if (rel.startsWith("Client/")) return "Dashboard.html";
  if (rel.startsWith("Proprietaire/")) return "Dashboard.html";
  if (rel.startsWith("Admin/")) return "Dashboard.html";
  return "index.html";
}

function brandInner(base, subtitle) {
  const sub = subtitle
    ? `<span class="app-logo__subtitle">${subtitle}</span>`
    : "";
  return (
    `<span class="app-logo__mark" aria-hidden="true">${LOGO_SVG}</span>` +
    `<img class="app-logo__img app-logo__img--fallback" src="${base}images/logo.svg" alt="" width="56" height="56" decoding="async">` +
    `<span class="app-logo__text"><span class="app-logo__name">HôtelFacile <em>Smart</em></span>${sub}</span>`
  );
}

function brandAnchor(home, base, subtitle) {
  return (
    `<a href="${home}" class="logo app-brand logo--upgraded" aria-label="HôtelFacile Smart — Accueil">` +
    brandInner(base, subtitle) +
    "</a>"
  );
}

function brandDiv(home, base, subtitle) {
  return (
    `<div class="logo logo--upgraded">` +
    `<a href="${home}" class="app-brand" aria-label="HôtelFacile Smart — Accueil">` +
    brandInner(base, subtitle) +
    "</a></div>"
  );
}

for (const filePath of walk(root)) {
  let html = fs.readFileSync(filePath, "utf8");
  if (html.includes("logo--upgraded")) continue;

  const base = baseFor(filePath);
  const orig = html;

  html = html.replace(
    /<a([^>]*)\sclass="logo"([^>]*)>[\s\S]*?<\/a>/gi,
    (match, a1, a2) => {
      const attrs = a1 + a2;
      if (attrs.includes("logo--upgraded")) return match;
      const href = (attrs.match(/href="([^"]*)"/) || [])[1] || "";
      const subtitle = (attrs.match(/data-logo-subtitle="([^"]*)"/) || [])[1] || "";
      const home = homeFor(filePath, href);
      return brandAnchor(home, base, subtitle);
    }
  );

  html = html.replace(
    /<div class="logo">\s*<h1>[\s\S]*?<\/h1>\s*<\/div>/gi,
    () => brandDiv(homeFor(filePath, "Dashboard.html"), base, "")
  );

  html = html.replace(
    /<div class="logo">\s*🏨 HôtelFacile Smart\s*<\/div>/gi,
    () => brandDiv(homeFor(filePath, ""), base, "")
  );

  if (!html.includes('rel="icon"')) {
    html = html.replace(
      /<\/head>/i,
      `  <link rel="icon" href="${base}images/logo.svg" type="image/svg+xml">\n</head>`
    );
  }

  if (html !== orig) {
    fs.writeFileSync(filePath, html);
    console.log("Embedded:", path.relative(root, filePath));
  }
}
