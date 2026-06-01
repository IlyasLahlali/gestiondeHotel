const API = window.API_BASE || `${window.location.origin}/api`; 
const token = localStorage.getItem("token"); 
if (!token) { 
window.location.href = "login.html"; 
} 
const headers = { 
Authorization: "Bearer " + token 
}; 

let dashboardNavScrollLockUntil = 0;

function formatTypeLabel(type) {
  const map = {
    economique: "Économique",
    standard: "Standard",
    superieur: "Supérieur",
    deluxe: "Deluxe",
    suite: "Suite",
    familiale: "Familiale"
  };
  return map[type] || type;
}

function formatCapaciteLabel(label) {
  return String(label || "")
    .replace(/personnes/gi, "Personnes")
    .replace(/personne/gi, "Personne");
}

function getDashboardScrollOffset() {
  const header = document.querySelector(".dashboard-header");
  const nav = document.querySelector(".dashboard-section-nav");
  return (header?.offsetHeight || 76) + (nav?.offsetHeight || 52) + 16;
}

function setActiveDashboardSection(id) {
  if (!id) return;
  document.querySelectorAll(".dashboard-section-nav__btn").forEach(btn => {
    const isActive = btn.dataset.section === id;
    btn.classList.toggle("is-active", isActive);
    btn.toggleAttribute("aria-current", isActive);
  });
}

function updateActiveDashboardSectionFromScroll() {
  if (Date.now() < dashboardNavScrollLockUntil) return;

  const items = [...document.querySelectorAll(".dashboard-section-nav__btn")]
    .map(btn => ({
      id: btn.dataset.section,
      el: document.getElementById(btn.dataset.section)
    }))
    .filter(item => item.el);

  if (!items.length) return;

  const anchor = getDashboardScrollOffset();

  for (const item of items) {
    const rect = item.el.getBoundingClientRect();
    if (rect.top <= anchor && rect.bottom > anchor) {
      setActiveDashboardSection(item.id);
      return;
    }
  }

  let passedId = items[0].id;
  for (const item of items) {
    if (item.el.getBoundingClientRect().top <= anchor) {
      passedId = item.id;
    }
  }
  setActiveDashboardSection(passedId);
}

function scrollToFooterContact() {
  document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToDashboardStats() {
  const nav = document.getElementById("dashboardSectionNav");
  if (!nav) return;
  const headerH = document.querySelector(".dashboard-header")?.offsetHeight || 76;
  const top = nav.getBoundingClientRect().top + window.scrollY - headerH - 8;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const isDashboardSection = document.querySelector(`.dashboard-section-nav__btn[data-section="${id}"]`);
  if (isDashboardSection) {
    dashboardNavScrollLockUntil = Date.now() + 2000;
    setActiveDashboardSection(id);
    const offset = getDashboardScrollOffset();
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleDashboardNavClick(event) {
  const btn = event.target.closest(".dashboard-section-nav__btn");
  if (!btn?.dataset.section) return;
  event.preventDefault();
  scrollToSection(btn.dataset.section);
}

function initDashboardSectionNav() {
  updateActiveDashboardSectionFromScroll();
  window.addEventListener("scroll", updateActiveDashboardSectionFromScroll, { passive: true });
  window.addEventListener("resize", updateActiveDashboardSectionFromScroll);
}

window.scrollToSection = scrollToSection;
window.handleDashboardNavClick = handleDashboardNavClick;
window.scrollToFooterContact = scrollToFooterContact;
window.scrollToDashboardStats = scrollToDashboardStats;

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

function renderPopularHotelCard(h) {
  const cover = typeof hotelCoverSrc === "function"
    ? hotelCoverSrc(h)
    : (h.image_principale ? `${window.API_ORIGIN || window.location.origin}${h.image_principale}` : "../../images/hero.jpg");
  const reservations = Number(h.total_reservations) || 0;
  const resLabel = reservations === 1 ? "1 réservation" : `${reservations} réservations`;
  const ville = String(h.ville || "").trim();

  return `
    <article class="owner-hotel-card owner-popular-hotel-card">
      <div class="owner-hotel-card__media">
        <img src="${escapeAttr(cover)}" alt="${escapeAttr(h.nom)}" loading="lazy">
      </div>
      <div class="owner-hotel-card__body">
        <h3 class="owner-hotel-card__title">${escapeHtml(h.nom)}</h3>
        <p class="owner-hotel-card__ville">📍 ${escapeHtml(ville || "Ville non renseignée")}</p>
        <div class="owner-hotel-card__stats">
          <span class="owner-hotel-card__stat">🔥 ${resLabel}</span>
        </div>
        <div class="owner-hotel-card__actions owner-popular-hotel-card__actions">
          <button type="button" class="owner-hotel-card__btn owner-hotel-card__btn--primary" onclick="goToHotelDetail(${h.id})">Voir détails</button>
        </div>
      </div>
    </article>`;
}
// ===================== 
// WELCOME USER 
// ===================== 
function setWelcome() { 
const user = JSON.parse(localStorage.getItem("user") || "{}"); 
if (user.nom) { 
const el = document.getElementById("welcomeText"); 
if (el) el.innerText = `Bonjour ${user.nom} 👋`; 
} 
} 
// ===================== 
// OVERVIEW STATS 
// ===================== 
async function loadOverview() { 
try { 
const res = await fetch(`${API}/proprietaire/stats`, { headers }); 
const data = await res.json(); 
document.getElementById("totalHotels").innerText = data.totalHotels ?? 0; 
document.getElementById("totalReservations").innerText = data.totalReservations ?? 0; 
document.getElementById("totalChambres").innerText = data.totalChambres ?? 0; 
document.getElementById("totalRevenus").innerText = data.totalRevenus ?? 0; 
} catch (err) { 
console.log("overview error:", err); 
} 
} 
// ===================== 
// HOTELS LIST 
// ===================== 
async function loadHotels() { 
try { 
const res = await fetch(`${API}/hotels/mes-hotels`, { headers }); 
const data = await res.json(); 
const container = document.getElementById("hotels"); 
if (!container) return; 
container.innerHTML = ""; 
data.forEach(h => { 
const div = document.createElement("div"); 
div.classList.add("card"); 
div.innerHTML = ` 
<h3>${h.nom}</h3> 
<p>${h.ville}</p> 
<button onclick="goToHotelDetail(${h.id})">Gérer</button> 
`; 
container.appendChild(div); 
}); 
} catch (err) { 
console.log("hotels error:", err); 
} 
} 
// ===================== 
// POPULAR HOTELS 
// ===================== 
async function loadPopularHotels() { 
try { 
const [popularRes, hotelsRes] = await Promise.all([
  fetch(`${API}/proprietaire/hotels/popular`, { headers }),
  fetch(`${API}/hotels/mes-hotels`, { headers })
]);
const data = await popularRes.json(); 
const hotels = await hotelsRes.json();
const hotelsMap = new Map(
  (Array.isArray(hotels) ? hotels : []).map(h => [Number(h.id), h])
);
const container = document.getElementById("popularHotels"); 
if (!container) return; 
if (!Array.isArray(data) || data.length === 0) {
  container.innerHTML = `<p class="owner-popular-hotels-empty">Aucun hôtel avec des réservations pour le moment.</p>`;
  return;
}
const enriched = data.map(h => {
  const full = hotelsMap.get(Number(h.id)) || {};
  return {
    ...full,
    ...h,
    ville: String(h.ville || full.ville || "").trim(),
    image_principale: h.image_principale || full.image_principale || null
  };
});
container.innerHTML = enriched.map(renderPopularHotelCard).join(""); 
} catch (err) { 
console.log(err); 
} 
} 
// ===================== 
// CHAMBRE STATS 
// ===================== 
async function loadChambreStats() { 
try { 
const res = await fetch(`${API}/proprietaire/chambres/stats`, { headers }); 
const data = await res.json(); 
document.getElementById("chambresParType").innerHTML = 
(data.byType || []) 
.map(t => `<p>${formatTypeLabel(t.type)} : ${t.total}</p>`) 
.join(""); 
document.getElementById("chambresParCapacite").innerHTML = 
(data.byCapacite || []) 
.map(c => `<p>${formatCapaciteLabel(c.capacite)} : ${c.total}</p>`) 
.join(""); 
} catch (err) { 
console.log(err); 
} 
} 
// ===================== 
// RESERVATION STATS 
// ===================== 
async function loadReservationStats() { 
try { 
const res = await fetch(`${API}/proprietaire/reservations/stats`, { headers }); 
const data = await res.json(); 
document.getElementById("resConfirmee").innerText = data.confirmee ?? 0; 
document.getElementById("resAttente").innerText = data.en_attente ?? 0; 
document.getElementById("resAnnulee").innerText = data.annulee ?? 0; 
} catch (err) { 
console.log(err); 
} 
} 
// ===================== 
// HOTEL STATS (FIX IMPORTANT) 
// ===================== 
async function loadHotelStats() { 
try { 
const res = await fetch(`${API}/hotels/mes-hotels`, { headers }); 
const data = await res.json(); 
const valide = data.filter(h => h.statut === "valide").length; 
const attente = data.filter(h => h.statut === "en_attente").length; 
const refuse = data.filter(h => h.statut === "refuse").length; 
document.getElementById("hotelValide").innerText = valide; 
document.getElementById("hotelAttente").innerText = attente; 
document.getElementById("hotelRefuse").innerText = refuse; 
} catch (err) { 
console.log(err); 
} 
} 
// ===================== 
// NAVIGATION 
// ===================== 
function goToHotelDetail(id) {
  if (id) {
    window.location.href = `hotelDetail.html?id=${id}`;
  } else {
    window.location.href = "hotel.html";
  }
} 
function goToAddHotel() { 
window.location.href = "hotelAjouter.html"; 
} 
// logout géré par profileMenu.js 
function goToReservations() { 
window.location.href = "reservationDetail.html"; 
} 
// ===================== 
// INIT 
// ===================== 
setWelcome(); 
initDashboardSectionNav();
loadOverview(); 
loadHotels(); 
loadPopularHotels(); 
loadChambreStats(); 
loadReservationStats(); 
loadHotelStats();
