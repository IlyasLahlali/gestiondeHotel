const API = window.API_BASE || `${window.location.origin}/api`;

const token = localStorage.getItem("token");
const user = JSON.parse(localStorage.getItem("user") || "{}");

const headers = {
  Authorization: "Bearer " + token
};

const params = new URLSearchParams(window.location.search);
const hotelId = params.get("id");

let hotelData = null;

if (!token) {
  window.location.href = "login.html";
} else if (user.role !== "admin") {
  alert("Accès réservé aux administrateurs");
  window.location.href = "../../Public/html/index.html";
} else if (!hotelId) {
  window.location.href = "hotel.html";
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

function showMessage(text, error = false) {
  const el = document.getElementById("detailMessage");
  if (!el) return;
  el.textContent = text;
  el.style.color = error ? "#DC2626" : "#059669";
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
  if (statut === "valide") return "admin-hotel-detail--valide";
  if (statut === "refuse") return "admin-hotel-detail--refuse";
  return "admin-hotel-detail--attente";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatAuthorName(client) {
  return [client?.prenom, client?.nom].filter(Boolean).join(" ") || "Client";
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

function chambresLabel(count) {
  const n = Number(count) || 0;
  if (n === 0) return "Aucune chambre";
  if (n === 1) return "1 chambre";
  return `${n} chambres`;
}

function renderModalSummary(containerId) {
  const container = document.getElementById(containerId);
  if (!container || !hotelData) return;

  const proprietaire = [hotelData.proprietaire_prenom, hotelData.proprietaire_nom]
    .filter(Boolean)
    .join(" ");

  container.innerHTML = `
    <div class="admin-hotel-modal__summary-row">
      <span>Hôtel</span>
      <strong>${escapeHtml(hotelData.nom)}</strong>
    </div>
    <div class="admin-hotel-modal__summary-row">
      <span>Ville</span>
      <strong>${escapeHtml(hotelData.ville || "—")}</strong>
    </div>
    <div class="admin-hotel-modal__summary-row">
      <span>Propriétaire</span>
      <strong>${escapeHtml(proprietaire || "—")}</strong>
    </div>
    <div class="admin-hotel-modal__summary-row">
      <span>Chambres</span>
      <strong>${escapeHtml(chambresLabel(hotelData.nb_chambres))}</strong>
    </div>`;
}

function setBodyModalOpen(isOpen) {
  document.body.classList.toggle("admin-hotel-modal-open", isOpen);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  setBodyModalOpen(false);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  if (id === "modalValider") {
    renderModalSummary("modalValiderSummary");
  } else if (id === "modalRefuser") {
    renderModalSummary("modalRefuserSummary");
  }

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  setBodyModalOpen(true);
}

function renderHotelDetail(hotel) {
  const proprietaire = [hotel.proprietaire_prenom, hotel.proprietaire_nom]
    .filter(Boolean)
    .join(" ");
  const cover = hotelCover(hotel);
  const nbChambres = Number(hotel.nb_chambres) || 0;
  const description = hotel.description?.trim()
    ? escapeHtml(hotel.description)
    : `<span class="admin-hotel-detail__empty">Description non renseignée</span>`;

  return `
    <article class="admin-hotel-detail ${statutCardClass(hotel.statut)}">
      <div class="admin-hotel-detail__hero">
        <img src="${escapeAttr(cover)}" alt="${escapeAttr(hotel.nom)}" loading="lazy">
        <div class="admin-hotel-detail__hero-overlay">
          <div class="admin-hotel-detail__hero-top">
            <span class="admin-badge ${statutClass(hotel.statut)}">${statutLabel(hotel.statut)}</span>
          </div>
          <div class="admin-hotel-detail__hero-bottom">
            <h1 class="admin-hotel-detail__title">${escapeHtml(hotel.nom)}</h1>
            <p class="admin-hotel-detail__ville">📍 ${escapeHtml(hotel.ville || "—")}</p>
          </div>
        </div>
      </div>

      <div class="admin-hotel-detail__stats">
        <div class="admin-hotel-detail__stat">
          <span class="admin-hotel-detail__stat-icon" aria-hidden="true">🛏</span>
          <div>
            <span class="admin-hotel-detail__stat-label">Chambres</span>
            <strong class="admin-hotel-detail__stat-value">${chambresLabel(nbChambres)}</strong>
          </div>
        </div>
        <div class="admin-hotel-detail__stat">
          <span class="admin-hotel-detail__stat-icon" aria-hidden="true">👤</span>
          <div>
            <span class="admin-hotel-detail__stat-label">Propriétaire</span>
            <strong class="admin-hotel-detail__stat-value">${escapeHtml(proprietaire || "—")}</strong>
          </div>
        </div>
        <div class="admin-hotel-detail__stat admin-hotel-detail__stat--wide">
          <span class="admin-hotel-detail__stat-icon" aria-hidden="true">✉️</span>
          <div>
            <span class="admin-hotel-detail__stat-label">Email</span>
            <strong class="admin-hotel-detail__stat-value">${escapeHtml(hotel.proprietaire_email || "—")}</strong>
          </div>
        </div>
      </div>

      <div class="admin-hotel-detail__content">
        <section class="admin-hotel-detail__block">
          <h2 class="admin-hotel-detail__block-title">Adresse</h2>
          <p class="admin-hotel-detail__text">${escapeHtml(hotel.adresse || "Non renseignée")}</p>
        </section>
        <section class="admin-hotel-detail__block">
          <h2 class="admin-hotel-detail__block-title">Description</h2>
          <p class="admin-hotel-detail__text admin-hotel-detail__desc">${description}</p>
        </section>
      </div>
    </article>`;
}

function renderAvisSection(data) {
  const container = document.getElementById("avisSection");
  if (!container) return;

  if (!data?.stats?.total) {
    container.innerHTML = `
      <section class="admin-hotel-avis card">
        <div class="admin-hotel-avis__head">
          <h2 class="admin-hotel-avis__title">Avis clients</h2>
        </div>
        <p class="admin-hotel-avis__empty">Aucun avis client pour cet hôtel.</p>
      </section>`;
    return;
  }

  const summary = window.AvisStars?.renderRatingSummary
    ? AvisStars.renderRatingSummary(data.stats, { size: "lg" })
    : `<div class="hotel-avis-summary"><span class="hotel-avis-score">${data.stats.moyenne}</span><span class="hotel-avis-count">${data.stats.total} avis</span></div>`;

  const items = data.avis.map(item => `
    <article class="admin-hotel-avis__item">
      <div class="admin-hotel-avis__item-head">
        <strong class="admin-hotel-avis__author">${escapeHtml(formatAuthorName(item.client))}</strong>
        ${window.AvisStars?.renderStarsHtml ? AvisStars.renderStarsHtml(item.note, { size: "sm" }) : `<span>${item.note}/5</span>`}
      </div>
      ${item.commentaire?.trim()
        ? `<p class="admin-hotel-avis__comment">${escapeHtml(item.commentaire)}</p>`
        : `<p class="admin-hotel-avis__comment admin-hotel-avis__comment--empty">Sans commentaire</p>`}
      <time class="admin-hotel-avis__date" datetime="${escapeAttr(item.created_at)}">${formatDate(item.created_at)}</time>
    </article>`).join("");

  container.innerHTML = `
    <section class="admin-hotel-avis card">
      <div class="admin-hotel-avis__head">
        <h2 class="admin-hotel-avis__title">Avis clients</h2>
        ${summary}
      </div>
      <div class="admin-hotel-avis__list">${items}</div>
    </section>`;
}

function renderActions(statut, container) {
  if (!container) return;

  if (statut === "en_attente") {
    container.innerHTML = `
      <div class="admin-hotel-detail__actions">
        <button type="button" class="admin-hotel-detail__btn admin-hotel-detail__btn--validate" onclick="openModal('modalValider')">Valider l'hôtel</button>
        <button type="button" class="admin-hotel-detail__btn admin-hotel-detail__btn--refuse" onclick="openModal('modalRefuser')">Refuser l'hôtel</button>
      </div>`;
    return;
  }

  if (statut === "valide") {
    container.innerHTML = `
      <div class="admin-status-banner banner-valide">
        ✔ Cet hôtel est validé et visible pour les clients.
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="admin-status-banner banner-refuse">
      ✖ Cet hôtel a été refusé. Aucune action possible.
    </div>`;
}

async function loadAvisSection() {
  const container = document.getElementById("avisSection");
  if (!container) return;

  container.innerHTML = `<p class="admin-loading">Chargement des avis…</p>`;

  try {
    const res = await fetch(`${API}/hotels/${hotelId}/avis`);
    const body = await res.text();

    if (!res.ok) {
      container.innerHTML = `<p class="admin-hotel-avis__empty">Impossible de charger les avis.</p>`;
      return;
    }

    renderAvisSection(JSON.parse(body));
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="admin-hotel-avis__empty">Erreur lors du chargement des avis.</p>`;
  }
}

async function loadHotelDetail() {
  const detail = document.getElementById("hotelDetail");
  const actionsBox = document.getElementById("actionsSection");
  const avisBox = document.getElementById("avisSection");

  try {
    const res = await fetch(`${API}/hotels/admin/${hotelId}`, { headers });
    const body = await res.text();

    if (!res.ok) {
      detail.innerHTML = `<p class="admin-error">${escapeHtml(body || "Hôtel introuvable")}</p>`;
      if (avisBox) avisBox.innerHTML = "";
      return;
    }

    hotelData = JSON.parse(body);
    detail.innerHTML = renderHotelDetail(hotelData);
    renderActions(hotelData.statut, actionsBox);

    if (avisBox) {
      if (hotelData.statut === "valide") {
        loadAvisSection();
      } else {
        avisBox.innerHTML = "";
      }
    }
  } catch (err) {
    console.error(err);
    detail.innerHTML = "<p class='admin-error'>Erreur de chargement.</p>";
  }
}

async function confirmValider() {
  closeModal("modalValider");

  try {
    const res = await fetch(`${API}/hotels/${hotelId}/valider`, {
      method: "PUT",
      headers
    });

    const msg = await res.text();
    if (!res.ok) {
      showMessage(msg, true);
      return;
    }

    showMessage(msg);
    setTimeout(() => {
      window.location.href = "hotel.html";
    }, 800);
  } catch (err) {
    console.error(err);
    showMessage("Erreur réseau", true);
  }
}

async function confirmRefuser() {
  closeModal("modalRefuser");

  try {
    const res = await fetch(`${API}/hotels/${hotelId}/refuser`, {
      method: "PUT",
      headers
    });

    const msg = await res.text();
    if (!res.ok) {
      showMessage(msg, true);
      return;
    }

    showMessage(msg);
    setTimeout(() => {
      window.location.href = "hotel.html";
    }, 800);
  } catch (err) {
    console.error(err);
    showMessage("Erreur réseau", true);
  }
}

loadHotelDetail();
