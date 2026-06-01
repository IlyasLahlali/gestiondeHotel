const API = window.API_BASE || `${window.location.origin}/api`;
const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");
const headers = { Authorization: "Bearer " + token };

if (!token) {
  window.location.href = "login.html";
} else if (user.role !== "admin") {
  alert("Accès réservé aux administrateurs");
  window.location.href = "../../Public/html/index.html";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function searchTerms(value) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function escapeHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(v) {
  return escapeHtml(v).replace(/'/g, "&#39;");
}
function statutLabel(s) {
  if (s === "valide") return "Validé";
  if (s === "refuse") return "Refusé";
  return "En attente";
}
function statutClass(s) {
  if (s === "valide") return "badge-valide";
  if (s === "refuse") return "badge-refuse";
  return "badge-attente";
}
function hotelCover(hotel) {
  if (typeof hotelCoverSrc === "function") return hotelCoverSrc(hotel, "../../images/");
  const origin = window.API_ORIGIN || window.location.origin;
  return hotel?.image_principale ? `${origin}${hotel.image_principale}` : "../../images/hero.jpg";
}
function renderStars(note) {
  const filled = Math.max(0, Math.min(5, Math.round(Number(note) || 0)));
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="admin-search-card__star${i < filled ? " is-filled" : ""}" aria-hidden="true">${i < filled ? "★" : "☆"}</span>`
  ).join("");
}

function renderCard(hotel) {
  const prop = [hotel.proprietaire_prenom, hotel.proprietaire_nom].filter(Boolean).join(" ");
  const nb = Number(hotel.nb_chambres) || 0;
  const ch = nb === 1 ? "1 chambre" : `${nb} chambres`;
  const cover = hotelCover(hotel);
  const note = Number(hotel.note_moyenne);
  const nbAvis = Number(hotel.nb_avis) || 0;
  const hasNote = nbAvis > 0 && Number.isFinite(note) && note > 0;

  const adresse = hotel.adresse?.trim();
  const adresseLine = adresse
    ? `<p class="admin-search-card__adresse">${escapeHtml(adresse)}</p>`
    : "";

  const noteBlock = hasNote
    ? `<div class="search-hotel-price admin-search-card__note-block">
        <span class="search-hotel-price-label">Note clients</span>
        <span class="search-hotel-price-value">${note.toFixed(1)}<span class="admin-search-card__note-star" aria-hidden="true">★</span></span>
        <span class="search-hotel-price-unit">${nbAvis === 1 ? "1 avis" : `${nbAvis} avis`}</span>
        <span class="admin-search-card__rating-stars admin-search-card__rating-stars--compact">${renderStars(note)}</span>
      </div>`
    : `<div class="search-hotel-price admin-search-card__note-block admin-search-card__note-block--empty">
        <span class="search-hotel-price-label">Note clients</span>
        <span class="search-hotel-price-value">—</span>
        <span class="search-hotel-price-unit">Aucun avis</span>
      </div>`;

  return `
    <article class="ville-hotel-card search-hotel-card admin-search-hotel-card">
      <div class="ville-hotel-card-media">
        <span class="admin-badge ${statutClass(hotel.statut)} admin-search-card__badge">${statutLabel(hotel.statut)}</span>
        <img src="${escapeAttr(cover)}" alt="${escapeAttr(hotel.nom)}" loading="lazy">
      </div>
      <div class="ville-hotel-card-body">
        <h2>${escapeHtml(hotel.nom)}</h2>
        <p class="ville-hotel-adresse">📍 ${escapeHtml(hotel.ville || "Ville non renseignée")}</p>
        ${adresseLine}
        <ul class="admin-search-card__meta">
          <li><span class="admin-search-card__meta-label">Propriétaire</span><span>${escapeHtml(prop || "Non renseigné")}</span></li>
          <li><span class="admin-search-card__meta-label">Chambres</span><span>${ch}</span></li>
        </ul>
      </div>
      <div class="ville-hotel-card-action search-hotel-card-action">
        ${noteBlock}
        <p class="search-hotel-rooms">${ch} enregistrée${nb > 1 ? "s" : ""}</p>
        <div class="search-hotel-card-action__btns">
          <button type="button" class="admin-hotel-card__btn" onclick="voirDetails(${hotel.id})">
            Voir les détails
          </button>
        </div>
      </div>
    </article>`;
}
function voirDetails(id) {
  window.location.href = `hotelDetail.html?id=${id}`;
}
function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    hotel: p.get("nomHotel") || p.get("hotel") || "",
    prenom: p.get("prenom") || "",
    nom: p.get("nom") || "",
    ville: p.get("ville") || ""
  };
}
function fillForm(params) {
  const hotel = document.getElementById("searchHotel");
  const prenom = document.getElementById("searchPrenom");
  const nom = document.getElementById("searchNom");
  const ville = document.getElementById("searchVille");
  if (hotel) hotel.value = params.hotel;
  if (prenom) prenom.value = params.prenom;
  if (nom) nom.value = params.nom;
  if (ville) ville.value = params.ville;
}
function buildUrl(params) {
  const q = new URLSearchParams();
  if (params.hotel) q.set("nomHotel", params.hotel);
  if (params.prenom) q.set("prenom", params.prenom);
  if (params.nom) q.set("nom", params.nom);
  if (params.ville) q.set("ville", params.ville);
  const s = q.toString();
  return s ? `rechercheResultat.html?${s}` : "rechercheResultat.html";
}
function submitAdminSearch() {
  const params = {
    hotel: document.getElementById("searchHotel")?.value.trim() || "",
    prenom: document.getElementById("searchPrenom")?.value.trim() || "",
    nom: document.getElementById("searchNom")?.value.trim() || "",
    ville: document.getElementById("searchVille")?.value.trim() || ""
  };
  if (!params.hotel && !params.prenom && !params.nom && !params.ville) {
    const msg = document.getElementById("searchMessage");
    if (msg) {
      msg.textContent = "Saisissez au moins un critère de recherche.";
      msg.style.color = "#DC2626";
    }
    return;
  }
  window.location.href = buildUrl(params);
}
function applyClientFilters(hotels, params) {
  return hotels.filter(hotel => {
    if (params.hotel) {
      const name = normalizeText(hotel.nom);
      if (!searchTerms(params.hotel).every(term => name.includes(term))) return false;
    }
    if (params.prenom) {
      const prenom = normalizeText(hotel.proprietaire_prenom);
      const full = normalizeText(`${hotel.proprietaire_prenom || ""} ${hotel.proprietaire_nom || ""}`);
      if (!searchTerms(params.prenom).every(term => prenom.includes(term) || full.includes(term))) return false;
    }
    if (params.nom) {
      const nom = normalizeText(hotel.proprietaire_nom);
      const full = normalizeText(`${hotel.proprietaire_prenom || ""} ${hotel.proprietaire_nom || ""}`);
      if (!searchTerms(params.nom).every(term => nom.includes(term) || full.includes(term))) return false;
    }
    if (params.ville) {
      const ville = normalizeText(hotel.ville);
      if (!searchTerms(params.ville).every(term => ville.includes(term))) return false;
    }
    return true;
  });
}
async function runSearch(params) {
  const list = document.getElementById("searchResults");
  const count = document.getElementById("searchCount");
  const msg = document.getElementById("searchMessage");
  if (!list) return;
  list.innerHTML = "<p class='search-results-loading'>Chargement…</p>";
  if (msg) msg.textContent = "";

  const q = new URLSearchParams();
  if (params.hotel) q.set("nomHotel", params.hotel);
  if (params.prenom) q.set("prenom", params.prenom);
  if (params.nom) q.set("nom", params.nom);
  if (params.ville) q.set("ville", params.ville);

  const hasFilter = params.hotel || params.prenom || params.nom || params.ville;
  if (!hasFilter) {
    list.innerHTML = "<div class='admin-empty'><p>Saisissez au moins un critère de recherche.</p></div>";
    if (count) count.textContent = "";
    return;
  }

  try {
    const res = await fetch(`${API}/hotels/admin/list?${q}`, { headers });
    const body = await res.text();
    if (!res.ok) {
      list.innerHTML = "";
      if (msg) { msg.textContent = body || "Erreur de recherche"; msg.style.color = "#DC2626"; }
      return;
    }
    const hotels = applyClientFilters(JSON.parse(body), params);
    if (count) count.textContent = hotels.length ? `${hotels.length} résultat(s)` : "Aucun résultat";
    if (!hotels.length) {
      list.innerHTML = "<div class='admin-empty admin-hotels-empty'><span class='admin-empty-icon'>🔍</span><p>Aucun hôtel ne correspond à votre recherche.</p></div>";
      return;
    }
    list.innerHTML = hotels.map(renderCard).join("");
  } catch (e) {
    list.innerHTML = "";
    if (msg) { msg.textContent = "Serveur inaccessible"; msg.style.color = "#DC2626"; }
  }
}

const params = getParams();
fillForm(params);
runSearch(params);
