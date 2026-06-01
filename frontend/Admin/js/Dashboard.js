const API = window.API_BASE || `${window.location.origin}/api`;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

const headers = {
  Authorization: "Bearer " + token
};

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

function setWelcome() {
  const el = document.getElementById("welcomeText");
  if (!el) return;
  if (user.nom) {
    el.textContent = `Bonjour ${user.prenom || ""} ${user.nom}`.trim();
  } else {
    el.textContent = "Bonjour";
  }
}

function renderActionsBlock(stats) {
  const container = document.getElementById("adminActionsContent");
  const section = document.getElementById("adminModeration");
  const sub = document.getElementById("adminModerationSub");
  if (!container) return;

  const pending = Number(stats.hotelsEnAttente) || 0;

  if (section) {
    section.classList.toggle("admin-moderation-block--pending", pending > 0);
    section.classList.toggle("admin-moderation-block--ok", pending === 0);
  }

  if (sub) {
    sub.textContent = pending > 0
      ? "Des hôtels soumis par les propriétaires attendent votre décision"
      : "Aucun hôtel en attente — la file de modération est vide";
  }

  if (pending > 0) {
    const label = pending === 1 ? "1 hôtel" : `${pending} hôtels`;
    container.innerHTML = `
      <div class="admin-moderation-card admin-moderation-card--pending">
        <div class="admin-moderation-card__top">
          <div class="admin-moderation-card__icon" aria-hidden="true">⏳</div>
          <div class="admin-moderation-card__content">
            <p class="admin-moderation-card__count">${label} en attente</p>
            <p class="admin-moderation-card__text">Validez ou refusez ces établissements pour les rendre visibles ou les rejeter.</p>
          </div>
        </div>
        <button type="button" class="admin-moderation-card__btn" onclick="goToHotels('en_attente')">
          Modérer maintenant →
        </button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-moderation-card admin-moderation-card--ok">
      <div class="admin-moderation-card__top">
        <div class="admin-moderation-card__icon" aria-hidden="true">✅</div>
        <div class="admin-moderation-card__content">
          <p class="admin-moderation-card__count">Modération à jour</p>
          <p class="admin-moderation-card__text">Tous les hôtels soumis ont été traités. Consultez la liste complète si besoin.</p>
        </div>
      </div>
      <button type="button" class="admin-moderation-card__btn admin-moderation-card__btn--soft" onclick="goToHotels('')">
        Voir tous les hôtels
      </button>
    </div>`;
}

function formatOwnerName(hotel) {
  const name = [hotel.proprietaire_prenom, hotel.proprietaire_nom].filter(Boolean).join(" ");
  return name || hotel.proprietaire || "Propriétaire inconnu";
}

function hotelCover(hotel) {
  const origin = window.API_ORIGIN || window.location.origin;
  const image = hotel?.image_principale?.trim();
  if (image) {
    return `${origin}${image}`;
  }
  return "../../images/default.jpg";
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function renderRecentHotelCard(hotel) {
  const cover = hotelCover(hotel);
  const owner = formatOwnerName(hotel);

  return `
    <article class="admin-recent-card">
      <div class="admin-recent-card__media">
        <img src="${escapeAttr(cover)}" alt="${escapeAttr(hotel.nom)}" loading="lazy">
        <span class="admin-recent-card__status admin-recent-card__status--${hotel.statut || "en_attente"}">${statutLabel(hotel.statut)}</span>
      </div>
      <div class="admin-recent-card__body">
        <h3 class="admin-recent-card__title">${escapeHtml(hotel.nom)}</h3>
        <p class="admin-recent-card__ville">📍 ${escapeHtml(hotel.ville || "—")}</p>
        <p class="admin-recent-card__owner">👤 ${escapeHtml(owner)}</p>
        <button type="button" class="admin-recent-card__btn" onclick="goToHotelDetail(${hotel.id})">
          Voir les détails
        </button>
      </div>
    </article>`;
}

function renderRecentHotels(hotels) {
  const container = document.getElementById("adminRecentList");
  if (!container) return;

  if (!hotels?.length) {
    container.innerHTML = `
      <div class="admin-empty admin-recent-empty">
        <span class="admin-empty-icon">🏨</span>
        <p>Aucun hôtel enregistré pour le moment.</p>
      </div>`;
    return;
  }

  container.innerHTML = hotels.map(renderRecentHotelCard).join("");
}

async function loadAdminStats() {
  try {
    const res = await fetch(`${API}/admin/stats`, { headers });
    const body = await res.text();

    if (!res.ok) {
      console.error(body);
      return;
    }

    const stats = JSON.parse(body);

    document.getElementById("statClients").textContent = stats.totalClients ?? 0;
    document.getElementById("statProprietaires").textContent = stats.totalProprietaires ?? 0;
    document.getElementById("statTotalHotels").textContent = stats.totalHotels ?? 0;
    document.getElementById("statReservations").textContent = Number(stats.reservationsConfirmees ?? 0);
    document.getElementById("statHotelsValides").textContent = stats.hotelsValides ?? 0;
    document.getElementById("statHotelsAttente").textContent = stats.hotelsEnAttente ?? 0;
    document.getElementById("statHotelsRefuses").textContent = stats.hotelsRefuses ?? 0;

    renderActionsBlock(stats);
    renderRecentHotels(stats.recentHotels || []);
  } catch (err) {
    console.error(err);
  }
}

function refreshAdmin() {
  loadAdminStats();
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function goToHotels(statut = "") {
  const url = statut ? `hotel.html?statut=${encodeURIComponent(statut)}` : "hotel.html";
  window.location.href = url;
}

function goToHotelDetail(id) {
  window.location.href = `hotelDetail.html?id=${id}`;
}

setWelcome();
loadAdminStats();

if (window.location.hash) {
  const targetId = window.location.hash.slice(1);
  window.setTimeout(() => scrollToSection(targetId), 120);
}
