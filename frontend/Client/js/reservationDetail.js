const API = window.API_BASE || `${window.location.origin}/api`;
const token = localStorage.getItem("token");

let selectedId = null;
let allReservations = [];
let currentFilter = "confirmee";

const listEl = document.getElementById("reservationsList");

const FILTER_LABELS = {
  confirmee: "validée",
  en_attente: "en attente",
  refusee: "refusée",
  annulee: "annulée"
};

const CHAMBRE_LABELS = {
  economique: "Économique",
  standard: "Standard",
  deluxe: "Deluxe",
  suite: "Suite",
  familiale: "Familiale",
  superieur: "Supérieur"
};

const STATUT_LABELS = {
  confirmee: "Confirmée",
  en_attente: "En attente",
  refusee: "Refusée",
  annulee: "Annulée"
};

if (!token) {
  window.location.href = "login.html";
}

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str ?? "";
  return el.innerHTML;
}

function chambreLabel(type) {
  return CHAMBRE_LABELS[type] || type || "Chambre";
}

function belongsToFilter(statut, filter) {
  if (filter === "confirmee") return statut === "confirmee";
  if (filter === "en_attente") return statut === "en_attente";
  if (filter === "refusee") return statut === "refusee";
  if (filter === "annulee") return statut === "annulee";
  return false;
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    const [y, m, d] = match[1].split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toInputDate(dateStr) {
  const date = parseDateOnly(dateStr);
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

function hotelLocation(r) {
  const parts = [];
  if (r.adresse) parts.push(escapeHtml(r.adresse));
  if (r.ville) parts.push(escapeHtml(r.ville));
  return parts.length ? parts.join(" — ") : "Adresse non renseignée";
}

function statutBadgeClass(statut) {
  if (statut === "confirmee") return "reservation-badge--confirmee";
  if (statut === "en_attente") return "reservation-badge--attente";
  if (statut === "annulee") return "reservation-badge--annulee";
  return "reservation-badge--refusee";
}

function cardModifierClass(statut) {
  if (statut === "confirmee") return "reservation-card--confirmee";
  if (statut === "en_attente") return "reservation-card--attente";
  if (statut === "annulee") return "reservation-card--annulee";
  return "reservation-card--refusee";
}

function renderReservationCard(r) {
  const nights = countNights(r.date_debut, r.date_fin);
  const pricePerNight = Number(r.prix) || 0;
  const total = nights > 0 ? pricePerNight * nights : pricePerNight;
  const nightsLabel = nights === 1 ? "1 nuit" : `${nights} nuits`;
  const hotelName = r.hotel_nom || "Hôtel sans nom";
  const canEdit = r.statut === "en_attente";

  const actions = canEdit
    ? `<div class="reservation-card-actions">
        <button type="button" class="btn-modifier" onclick="openEditModal(${r.id})">Modifier</button>
        <button type="button" class="btn-danger" onclick="openCancelModal(${r.id})">Annuler</button>
      </div>`
    : "";

  return `
    <article class="reservation-card ${cardModifierClass(r.statut)}">
      <div class="reservation-card-main">
        <div class="reservation-card-head">
          <div>
            <h2>${escapeHtml(hotelName)}</h2>
            <p class="reservation-card-location">📍 ${hotelLocation(r)}</p>
          </div>
          <span class="reservation-badge ${statutBadgeClass(r.statut)}">${STATUT_LABELS[r.statut] || escapeHtml(r.statut)}</span>
        </div>
        <div class="reservation-card-meta">
          <div class="reservation-meta-item">
            <span>Type de chambre</span>
            <strong>${escapeHtml(chambreLabel(r.chambre_type))}</strong>
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
            <strong>${r.capacite} personnes</strong>
          </div>
          <div class="reservation-meta-item">
            <span>Prix par nuit</span>
            <strong>${pricePerNight} DH</strong>
          </div>
          <div class="reservation-meta-item reservation-meta-item--price">
            <span>Prix total</span>
            <strong>${total} DH</strong>
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
        <p>Vous n'avez pas encore de réservation.</p>
        <a href="Dashboard.html#search" class="btn-primary">Rechercher un hôtel</a>
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
  listEl.innerHTML = '<p class="reservations-loading">Chargement de vos réservations…</p>';

  try {
    const res = await fetch(`${API}/reservations/mes-reservations`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();
    allReservations = Array.isArray(data) ? data : [];

    updateFilterCounts();

    if (!allReservations.length) {
      renderFilteredList();
      return;
    }

    const preferred = ["confirmee", "en_attente", "refusee", "annulee"].find(filter =>
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

function openEditModal(id) {
  selectedId = id;
  const reservation = allReservations.find(r => r.id === id);
  document.getElementById("editStart").value = toInputDate(reservation?.date_debut);
  document.getElementById("editEnd").value = toInputDate(reservation?.date_fin);
  document.getElementById("modalEdit").style.display = "flex";
}

function closeEditModal() {
  document.getElementById("modalEdit").style.display = "none";
}

async function confirmUpdate() {
  const date_debut = document.getElementById("editStart").value;
  const date_fin = document.getElementById("editEnd").value;

  if (!date_debut || !date_fin) {
    alert("Veuillez remplir les dates");
    return;
  }

  if (date_fin <= date_debut) {
    alert("La date de fin doit être après la date de début");
    return;
  }

  try {
    const res = await fetch(`${API}/reservations/${selectedId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ date_debut, date_fin })
    });

    alert(await res.text());
    closeEditModal();
    loadReservations();
  } catch (err) {
    console.error(err);
  }
}

function openCancelModal(id) {
  selectedId = id;
  document.getElementById("modalCancel").style.display = "flex";
}

function closeCancelModal() {
  document.getElementById("modalCancel").style.display = "none";
}

async function confirmCancel() {
  try {
    const res = await fetch(`${API}/reservations/${selectedId}/annuler`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + token }
    });

    alert(await res.text());
    closeCancelModal();
    loadReservations();
  } catch (err) {
    console.error(err);
  }
}

bindFilterButtons();
loadReservations();
