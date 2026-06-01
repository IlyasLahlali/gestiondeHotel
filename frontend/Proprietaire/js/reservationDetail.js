const { API, ownerHeaders, formatTypeLabel } = OwnerCommon;

let selectedReservationId = null;
let allReservations = [];
let currentFilter = "en_attente";

const listEl = document.getElementById("reservationsList");

const FILTER_LABELS = {
  confirmee: "validée",
  en_attente: "en attente",
  refusee: "refusée",
  annulee: "annulée"
};

const STATUT_LABELS = {
  confirmee: "Validée",
  en_attente: "En attente",
  refusee: "Refusée",
  annulee: "Annulée"
};

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str ?? "";
  return el.innerHTML;
}

function normalizeStatut(statut) {
  const value = String(statut || "").trim().toLowerCase();
  if (value === "confirmee" || value === "en_attente" || value === "refusee" || value === "annulee") {
    return value;
  }
  return "en_attente";
}

function scrollToFooterContact() {
  document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function belongsToFilter(statut, filter) {
  return normalizeStatut(statut) === filter;
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const [y, m, d] = match[1].split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return "—";
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function countNights(start, end) {
  const a = parseDateOnly(start);
  const b = parseDateOnly(end);
  if (!a || !b) return 0;
  return Math.max(Math.round((b - a) / (1000 * 60 * 60 * 24)), 0);
}

function statutBadgeClass(statut) {
  const s = normalizeStatut(statut);
  if (s === "confirmee") return "reservation-badge--confirmee";
  if (s === "en_attente") return "reservation-badge--attente";
  if (s === "annulee") return "reservation-badge--annulee";
  return "reservation-badge--refusee";
}

function cardModifierClass(statut) {
  const s = normalizeStatut(statut);
  if (s === "confirmee") return "reservation-card--confirmee";
  if (s === "en_attente") return "reservation-card--attente";
  if (s === "annulee") return "reservation-card--annulee";
  return "reservation-card--refusee";
}

function statutLabel(statut) {
  return STATUT_LABELS[normalizeStatut(statut)] || "Inconnu";
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${Math.round(n)} DH`;
}

function formatCapacite(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "— personnes";
  return n === 1 ? "1 personne" : `${n} personnes`;
}

function renderReservationCard(r) {
  const statut = normalizeStatut(r.statut);
  const nights = countNights(r.date_debut, r.date_fin);
  const pricePerNight = Number(r.chambre_prix ?? r.prix) || 0;
  const total = nights > 0 ? pricePerNight * nights : pricePerNight;
  const nightsLabel = nights === 1 ? "1 nuit" : `${nights} nuits`;
  const clientName = [r.prenom, r.nom].filter(Boolean).join(" ").trim() || "Client";
  const location = [r.adresse, r.ville].filter(Boolean).join(" — ") || "Adresse non renseignée";

  const actions = statut === "en_attente"
    ? `<div class="reservation-card-actions owner-reservation-card-actions">
        <button type="button" class="owner-reservation-btn owner-reservation-btn--validate" onclick="openValiderModal(${r.id})">Valider</button>
        <button type="button" class="owner-reservation-btn owner-reservation-btn--refuse" onclick="openRefuserModal(${r.id})">Refuser</button>
      </div>`
    : "";

  return `
    <article class="reservation-card ${cardModifierClass(statut)} owner-reservation-card">
      <div class="reservation-card-main">
        <div class="reservation-card-head">
          <div>
            <h2>${escapeHtml(r.hotel_nom || "Hôtel")}</h2>
            <p class="reservation-card-location">📍 ${escapeHtml(location)}</p>
            <p class="owner-reservation-client">👤 ${escapeHtml(clientName)} · ${escapeHtml(r.email || "Email non renseigné")}</p>
          </div>
          <span class="reservation-badge ${statutBadgeClass(statut)}">${statutLabel(statut)}</span>
        </div>
        <div class="reservation-card-meta">
          <div class="reservation-meta-item">
            <span>Type de chambre</span>
            <strong>${escapeHtml(formatTypeLabel(r.chambre_type))}</strong>
          </div>
          <div class="reservation-meta-item">
            <span>Date début</span>
            <strong>${formatDate(r.date_debut)}</strong>
          </div>
          <div class="reservation-meta-item">
            <span>Date fin</span>
            <strong>${formatDate(r.date_fin)}</strong>
          </div>
          <div class="reservation-meta-item">
            <span>Durée</span>
            <strong>${nightsLabel}</strong>
          </div>
          <div class="reservation-meta-item">
            <span>Capacité</span>
            <strong>${escapeHtml(formatCapacite(r.chambre_capacite ?? r.capacite))}</strong>
          </div>
          <div class="reservation-meta-item">
            <span>Prix / nuit</span>
            <strong>${formatPrice(pricePerNight)}</strong>
          </div>
          <div class="reservation-meta-item reservation-meta-item--price">
            <span>Prix total</span>
            <strong>${formatPrice(total)}</strong>
          </div>
        </div>
      </div>
      ${actions}
    </article>`;
}

function updateFilterCounts() {
  document.querySelectorAll(".reservations-filter-count").forEach(el => {
    const filter = el.dataset.count;
    const count = allReservations.filter(r => belongsToFilter(r.statut, filter)).length;
    el.textContent = count;
  });
}

function setFilter(btn, filter) {
  currentFilter = filter;
  document.querySelectorAll(".reservations-filter-btn").forEach(b => {
    const active = b === btn;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
  renderFilteredList();
}

function renderFilteredList() {
  const items = allReservations.filter(r => belongsToFilter(r.statut, currentFilter));

  if (!allReservations.length) {
    listEl.innerHTML = `
      <div class="reservations-empty">
        <p>Aucune réservation reçue pour le moment.</p>
      </div>`;
    return;
  }

  if (!items.length) {
    listEl.innerHTML = `
      <div class="reservations-empty">
        <p>Aucune réservation ${FILTER_LABELS[currentFilter]} pour le moment.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = items.map(renderReservationCard).join("");
}

function bindFilterButtons() {
  document.querySelectorAll(".reservations-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => setFilter(btn, btn.dataset.filter));
  });
}

async function loadReservations() {
  listEl.innerHTML = '<p class="reservations-loading">Chargement des réservations…</p>';

  try {
    const res = await fetch(`${API}/reservations/proprietaire/detail`, {
      headers: ownerHeaders
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    allReservations = Array.isArray(data)
      ? data.map(r => ({ ...r, statut: normalizeStatut(r.statut) }))
      : [];

    updateFilterCounts();

    const preferred = ["en_attente", "confirmee", "refusee", "annulee"].find(filter =>
      allReservations.some(r => belongsToFilter(r.statut, filter))
    );

    if (preferred) {
      const btn = document.querySelector(`.reservations-filter-btn[data-filter="${preferred}"]`);
      if (btn) setFilter(btn, preferred);
      else renderFilteredList();
    } else {
      renderFilteredList();
    }
  } catch (err) {
    console.error(err);
    listEl.innerHTML = '<p class="reservations-empty">Erreur lors du chargement des réservations.</p>';
  }
}

function getReservationById(id) {
  return allReservations.find(r => Number(r.id) === Number(id));
}

function buildModalSummaryHtml(r) {
  if (!r) return "";

  const clientName = [r.prenom, r.nom].filter(Boolean).join(" ").trim() || "Client";

  return `
    <div class="owner-reservation-modal__summary-row">
      <span>Hôtel</span>
      <strong>${escapeHtml(r.hotel_nom || "Hôtel")}</strong>
    </div>
    <div class="owner-reservation-modal__summary-row">
      <span>Client</span>
      <strong>${escapeHtml(clientName)}</strong>
    </div>
    <div class="owner-reservation-modal__summary-row">
      <span>Dates</span>
      <strong>${formatDate(r.date_debut)} → ${formatDate(r.date_fin)}</strong>
    </div>`;
}

function openOwnerModal(overlayId, summaryId, reservationId) {
  const overlay = document.getElementById(overlayId);
  const summaryEl = document.getElementById(summaryId);
  const reservation = getReservationById(reservationId);

  selectedReservationId = reservationId;
  if (summaryEl) {
    summaryEl.innerHTML = buildModalSummaryHtml(reservation);
  }

  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("owner-reservation-modal-open");
  overlay.querySelector(".owner-reservation-modal__btn:not(.owner-reservation-modal__btn--cancel)")?.focus();
}

function closeOwnerModal(overlayId) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;

  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");

  if (!document.querySelector(".owner-reservation-modal-overlay:not([hidden])")) {
    document.body.classList.remove("owner-reservation-modal-open");
  }

  selectedReservationId = null;
}

function openValiderModal(id) {
  openOwnerModal("modalValider", "modalValiderSummary", id);
}

function closeValiderModal() {
  closeOwnerModal("modalValider");
}

function openRefuserModal(id) {
  openOwnerModal("modalRefuser", "modalRefuserSummary", id);
}

function closeRefuserModal() {
  closeOwnerModal("modalRefuser");
}

function bindOwnerReservationModals() {
  document.querySelectorAll(".owner-reservation-modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeOwnerModal(overlay.id);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openOverlay = document.querySelector(".owner-reservation-modal-overlay:not([hidden])");
    if (openOverlay) closeOwnerModal(openOverlay.id);
  });
}

async function confirmValider() {
  if (!selectedReservationId) return;

  try {
    const res = await fetch(`${API}/reservations/${selectedReservationId}/valider`, {
      method: "PUT",
      headers: ownerHeaders
    });

    if (!res.ok) {
      alert(await res.text() || "Impossible de valider la réservation.");
      return;
    }

    closeValiderModal();
    await loadReservations();
    const btn = document.querySelector('.reservations-filter-btn[data-filter="confirmee"]');
    if (btn) setFilter(btn, "confirmee");
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la validation.");
  }
}

async function confirmRefuser() {
  if (!selectedReservationId) return;

  try {
    const res = await fetch(`${API}/reservations/${selectedReservationId}/refuser`, {
      method: "PUT",
      headers: ownerHeaders
    });

    if (!res.ok) {
      alert(await res.text() || "Impossible de refuser la réservation.");
      return;
    }

    closeRefuserModal();
    await loadReservations();
    const btn = document.querySelector('.reservations-filter-btn[data-filter="refusee"]');
    if (btn) setFilter(btn, "refusee");
  } catch (err) {
    console.error(err);
    alert("Erreur lors du refus.");
  }
}

window.scrollToFooterContact = scrollToFooterContact;
window.openValiderModal = openValiderModal;
window.closeValiderModal = closeValiderModal;
window.openRefuserModal = openRefuserModal;
window.closeRefuserModal = closeRefuserModal;
window.confirmValider = confirmValider;
window.confirmRefuser = confirmRefuser;

bindFilterButtons();
bindOwnerReservationModals();
loadReservations();
