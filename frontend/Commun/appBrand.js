/**
 * Logo HôtelFacile Smart — toutes les pages
 */
(function () {
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="appBrand.js"]');
  const base = (scriptEl && scriptEl.getAttribute("data-base")) || "../../";

  function detectHome() {
    const path = location.pathname.replace(/\\/g, "/").toLowerCase();
    const role = document.body?.dataset?.authRole;

    if (role === "client" || path.includes("/client/html/")) {
      return "Dashboard.html";
    }
    if (role === "proprietaire" || path.includes("/proprietaire/html/")) {
      return "Dashboard.html";
    }
    if (role === "admin" || path.includes("/admin/html/")) {
      return "Dashboard.html";
    }
    if (path.includes("/public/html/")) {
      return "index.html";
    }
    return base + "Public/html/index.html";
  }

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

  function logoIconHtml() {
    const svg = base + "images/logo.svg";
    return (
      '<span class="app-logo__mark" aria-hidden="true">' +
      LOGO_SVG +
      "</span>" +
      '<img class="app-logo__img app-logo__img--fallback" src="' +
      svg +
      '" alt="" width="56" height="56" decoding="async">'
    );
  }

  function brandMarkup(subtitle) {
    const sub = subtitle
      ? '<span class="app-logo__subtitle">' + subtitle + "</span>"
      : "";
    return (
      logoIconHtml() +
      '<span class="app-logo__text">' +
      '<span class="app-logo__name">HôtelFacile <em>Smart</em></span>' +
      sub +
      "</span>"
    );
  }

  function createBrandLink(homeUrl, subtitle) {
    const a = document.createElement("a");
    a.href = homeUrl;
    a.className = "app-brand";
    a.setAttribute("aria-label", "HôtelFacile Smart — Accueil");
    a.innerHTML = brandMarkup(subtitle);
    return a;
  }

  function extractSubtitle(el) {
    const sub = el.dataset?.logoSubtitle;
    if (sub) return sub;
    const text = (el.textContent || "").trim();
    if (!text || text.includes("🏨") || text === "HôtelFacile Smart") return "";
    if (text.startsWith("👑")) return text.replace(/^👑\s*/, "").trim();
    return "";
  }

  function isUpgraded(el) {
    return (
      el.classList.contains("logo--upgraded") ||
      el.querySelector(".app-brand, .app-logo__mark, .app-logo__img")
    );
  }

  function upgradeLogoElement(el) {
    if (isUpgraded(el)) return;

    const home = el.getAttribute("href") || el.dataset?.home || detectHome();
    const subtitle = extractSubtitle(el);

    if (el.tagName === "A") {
      el.classList.add("app-brand", "logo--upgraded");
      el.innerHTML = brandMarkup(subtitle);
      if (!el.getAttribute("href") || el.getAttribute("href") === "#") {
        el.href = home;
      }
      if (!el.getAttribute("aria-label")) {
        el.setAttribute("aria-label", "HôtelFacile Smart — Accueil");
      }
      return;
    }

    const link = createBrandLink(home, subtitle);
    el.innerHTML = "";
    el.classList.add("logo", "logo--upgraded");
    el.appendChild(link);
  }

  function upgradePageHeader(header) {
    if (header.querySelector(".app-brand")) return;
    const link = createBrandLink(detectHome(), "");
    link.classList.add("app-brand--compact");
    header.insertBefore(link, header.firstChild);
    header.classList.add("page-header--with-brand");
  }

  function initFavicon() {
    const href = base + "images/logo.svg";
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = href;
  }

  function init() {
    try {
      initFavicon();
      document.querySelectorAll(".logo").forEach(upgradeLogoElement);
      document.querySelectorAll("header.page-header").forEach(upgradePageHeader);
    } catch (err) {
      console.error("appBrand:", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
