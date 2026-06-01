const API = window.API_BASE || `${window.location.origin}/api`;

const token = localStorage.getItem("token");const user = JSON.parse(localStorage.getItem("user") || "{}");

const headers = {
  Authorization: "Bearer " + token
};

let currentFilter = "";

if (!token) {
  window.location.href = "login.html";
} else if (user.role !== "admin") {
  alert("Accès réservé aux administrateurs");
  window.location.href = "../../Public/html/index.html";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function statutLabel(statut) {
  if (statut === "valide") return "Validé";
  if (statut === "refuse") return "Refusé";
  return "En attente";
}

function statutClass(statut) {
  if (statut === "valide") return "badge-valide";
  if (statut === "refuse") return "badge-refuse";
  return "badge-attente";
}

function statutCardClass(statut) {
  if (statut === "valide") return "admin-hotel-card--valide";
  if (statut === "refuse") return "admin-hotel-card--refuse";
  return "admin-hotel-card--attente";
}

function toRatingNumber(value) {
  const note = Number(value);
  return Number.isFinite(note) && note > 0 ? note : null;
}

function renderOverlayStars(hotel) {
  const note = toRatingNumber(hotel.note_moyenne);
  const nbAvis = Number(hotel.nb_avis) || 0;
  if (note == null || !nbAvis) return "";

  const filled = Math.max(1, Math.min(5, Math.round(note)));
  const stars = Array.from({ length: 5 }, (_, index) => {
    const isFilled = index < filled;
    return `<span class="admin-hotel-card__star${isFilled ? " is-filled" : ""}" aria-hidden="true">${isFilled ? "★" : "☆"}</span>`;
  }).join("");

  const avisLabel = nbAvis === 1 ? "1 avis" : `${nbAvis} avis`;

  return `
    <div class="admin-hotel-card__rating-overlay" role="img" aria-label="Note moyenne ${note} sur 5, ${avisLabel}">
      <span class="admin-hotel-card__rating-score">${note.toFixed(1)}</span>
      <span class="admin-hotel-card__rating-stars">${stars}</span>
      <span class="admin-hotel-card__rating-count">${avisLabel}</span>
    </div>`;
}

function hotelCover(hotel) {
  if (typeof hotelCoverSrc === "function") {
    return hotelCoverSrc(hotel, "../../images/");
  }
  const origin = window.API_ORIGIN || window.location.origin;
  if (hotel?.image_principale) {
    return `${origin}${hotel.image_principale}`;
  }
  return "../../images/hero.jpg";
}
function refreshHotels() {
  loadHotels(currentFilter);
}

function setFilter(btn, statut) {
  currentFilter = statut;

  document.querySelectorAll(".admin-filter-btn").forEach(b => {
    b.classList.remove("active");
  });
  btn.classList.add("active");

  loadHotels(statut);
}

async function loadHotels(statut = "") {
  const list = document.getElementById("hotelsList");
  const count = document.getElementById("hotelsCount");

  if (!list) return;

  list.innerHTML = "<p class='admin-hotels-loading'>Chargement…</p>";
  showFeedback("");

  const url = statut
    ? `${API}/hotels/admin/list?statut=${encodeURIComponent(statut)}`
    : `${API}/hotels/admin/list`;

  try {
    const res = await fetch(url, { headers });
    const body = await res.text();

    if (!res.ok) {
      list.innerHTML = "";
      showFeedback(body || "Erreur de chargement", true);
      return;
    }

    const hotels = JSON.parse(body);

    const labels = {
      "": "tous les hôtels",
      en_attente: "en attente",
      valide: "validés",
      refuse: "refusés"
    };

    if (count) {
      count.textContent =
        hotels.length === 0
          ? `Aucun hôtel ${labels[statut] || ""}`
          : `${hotels.length} hôtel(s) ${labels[statut] || ""}`;
    }

    if (!hotels.length) {
      list.innerHTML = `
        <div class="admin-empty admin-hotels-empty">
          <span class="admin-empty-icon">🏨</span>
          <p>Aucun hôtel à afficher pour ce filtre.</p>
        </div>`;
      return;
    }

    list.innerHTML = hotels.map(renderHotelCard).join("");
  } catch (err) {
    console.error(err);
    list.innerHTML = "";
    showFeedback("Serveur inaccessible", true);
  }
}

function renderHotelCard(hotel) {
  const proprietaire = [hotel.proprietaire_prenom, hotel.proprietaire_nom]
    .filter(Boolean)
    .join(" ");
  const nbChambres = Number(hotel.nb_chambres) || 0;
  const chambreLabel = nbChambres === 1 ? "1 chambre" : `${nbChambres} chambres`;
  const cover = hotelCover(hotel);
  const cardClass = statutCardClass(hotel.statut);

  return `
    <article class="admin-hotel-card ${cardClass}">
      <div
        class="admin-hotel-card__media"
        role="link"
        tabindex="0"
        aria-label="Voir détails de ${escapeAttr(hotel.nom)}"
        onclick="voirDetails(${hotel.id})"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();voirDetails(${hotel.id})}"
      >
        <img src="${escapeAttr(cover)}" alt="${escapeAttr(hotel.nom)}" loading="lazy">
        <span class="admin-badge ${statutClass(hotel.statut)} admin-hotel-card__badge">${statutLabel(hotel.statut)}</span>
        ${renderOverlayStars(hotel)}
      </div>
      <div class="admin-hotel-card__body">
        <div class="admin-hotel-card__head">
          <h3 class="admin-hotel-card__title">${escapeHtml(hotel.nom)}</h3>
          <p class="admin-hotel-card__ville">📍 ${escapeHtml(hotel.ville || "—")}</p>
        </div>
        <p class="admin-hotel-card__adresse">${escapeHtml(hotel.adresse?.trim() || "Adresse non renseignée")}</p>
        <div class="admin-hotel-card__footer">
          <div class="admin-hotel-card__owner">
            <span class="admin-hotel-card__owner-icon" aria-hidden="true">👤</span>
            <span class="admin-hotel-card__owner-name">${escapeHtml(proprietaire || "Propriétaire inconnu")}</span>
          </div>
          <span class="admin-hotel-card__meta-item">🛏 ${chambreLabel}</span>
        </div>
        <div class="admin-hotel-card__actions">
          <button type="button" class="admin-hotel-card__btn" onclick="voirDetails(${hotel.id})">
            Voir les détails
          </button>
        </div>
      </div>
    </article>`;
}

function showFeedback(text, error = false) {
  const el = document.getElementById("adminMessage");
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? "#DC2626" : "#059669";
}

function voirDetails(id) {
  window.location.href = `hotelDetail.html?id=${id}`;
}

function submitAdminSearch() {
  const params = new URLSearchParams();
  const hotel = document.getElementById("searchHotel")?.value.trim() || "";
  const prenom = document.getElementById("searchPrenom")?.value.trim() || "";
  const nom = document.getElementById("searchNom")?.value.trim() || "";
  const ville = document.getElementById("searchVille")?.value.trim() || "";

  if (hotel) params.set("nomHotel", hotel);
  if (prenom) params.set("prenom", prenom);
  if (nom) params.set("nom", nom);
  if (ville) params.set("ville", ville);

  if (!params.toString()) {
    showFeedback("Saisissez au moins un critère de recherche.", true);
    return;
  }

  window.location.href = `rechercheResultat.html?${params}`;
}

function applyFilterFromUrl() {
  const statut = new URLSearchParams(window.location.search).get("statut") || "";
  const allowed = ["", "en_attente", "valide", "refuse"];
  if (!allowed.includes(statut)) return;

  currentFilter = statut;
  const btn = document.querySelector(`.admin-filter-btn[data-statut="${statut}"]`);
  if (btn) {
    document.querySelectorAll(".admin-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

applyFilterFromUrl();
loadHotels(currentFilter);

if (window.location.hash) {
  const targetId = window.location.hash.slice(1);
  window.setTimeout(() => scrollToSection(targetId), 120);
}
