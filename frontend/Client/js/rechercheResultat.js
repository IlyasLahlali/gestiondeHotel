const API = window.API_BASE || `${window.location.origin}/api`;
const params = new URLSearchParams(window.location.search);

const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

let ville = params.get("ville");
let personnes = params.get("personnes");
let type = params.get("type");
let budget = params.get("budget");

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str ?? "";
  return el.innerHTML;
}

function goReservations() {
  window.location.href = "reservationDetail.html";
}

function goFavoris() {
  window.location.href = "favoris.html";
}

function prefillSearchForm() {
  if (ville) document.getElementById("ville").value = ville;
  if (personnes) document.getElementById("personnes").value = personnes;
  if (type) document.getElementById("type").value = type;
  if (budget) document.getElementById("budget").value = budget;
}

function buildHotelDetailUrl(hotelId) {
  const q = new URLSearchParams();
  q.set("id", hotelId);
  if (ville) q.set("ville", ville);
  if (personnes) q.set("personnes", personnes);
  if (type && type !== "tous") q.set("type", type);
  if (budget) q.set("budget", budget);
  return `hotelDetail.html?${q.toString()}`;
}

function buildChambresUrl(hotelId) {
  const q = new URLSearchParams();
  q.set("id", hotelId);
  if (ville) q.set("ville", ville);
  if (personnes) q.set("personnes", personnes);
  if (type && type !== "tous") q.set("type", type);
  if (budget) q.set("budget", budget);
  return `chambreDetail.html?${q.toString()}`;
}

function goHotelDetail(hotelId) {
  window.location.href = buildHotelDetailUrl(hotelId);
}

function goHotelChambres(hotelId) {
  window.location.href = buildChambresUrl(hotelId);
}

function rechercher() {
  const v = document.getElementById("ville").value;
  const p = document.getElementById("personnes").value;
  const t = document.getElementById("type").value;
  const b = document.getElementById("budget").value;

  if (!v) {
    alert("Veuillez sélectionner une ville.");
    return;
  }

  let url = `rechercheResultat.html?ville=${encodeURIComponent(v)}`;
  if (p) url += `&personnes=${encodeURIComponent(p)}`;
  if (t && t !== "tous") url += `&type=${encodeURIComponent(t)}`;
  if (b) url += `&budget=${encodeURIComponent(b)}`;

  window.location.href = url;
}

function formatChambreType(type) {
  const map = {
    economique: "Économique",
    standard: "Standard",
    superieur: "Supérieur",
    deluxe: "Deluxe",
    suite: "Suite",
    familiale: "Familiale",
    luxe: "Luxe"
  };
  return map[type] || type;
}

function buildRoomChips(chambres) {
  const types = [...new Set(chambres.map(c => c.type).filter(Boolean))];
  if (!types.length) return "";
  return `<div class="search-hotel-chips">${types
    .slice(0, 4)
    .map(t => `<span class="search-hotel-chip">${escapeHtml(formatChambreType(t))}</span>`)
    .join("")}</div>`;
}

function renderSearchHotelCard(h) {
  const hotelForImage = {
    nom: h.nom,
    ville: h.ville,
    image_principale: h.image_principale
  };
  const cover = hotelCoverSrc(hotelForImage, "../../images/");
  const minPrix = Math.min(...h.chambres.map(c => Number(c.prix)));
  const desc = h.description
    ? `<p class="ville-hotel-desc">${escapeHtml(h.description)}</p>`
    : "";
  const roomLabel = h.chambres.length > 1 ? "chambres disponibles" : "chambre disponible";
  const favoriBtn = FavorisClient.starButtonHtml(h.id, FavorisClient.isFavorite(h.id), h.nom);

  return `
    <article class="ville-hotel-card search-hotel-card">
      <div class="ville-hotel-card-media">
        ${favoriBtn}
        <img src="${cover}" alt="${escapeHtml(h.nom)}" loading="lazy">
      </div>
      <div class="ville-hotel-card-body">
        <h2>${escapeHtml(h.nom)}</h2>
        <p class="ville-hotel-adresse">📍 ${escapeHtml(h.ville)}</p>
        ${buildRoomChips(h.chambres)}
        ${desc}
      </div>
      <div class="ville-hotel-card-action search-hotel-card-action">
        <div class="search-hotel-price">
          <span class="search-hotel-price-label">À partir de</span>
          <span class="search-hotel-price-value">${minPrix} DH</span>
          <span class="search-hotel-price-unit">/ nuit</span>
        </div>
        <p class="search-hotel-rooms">${h.chambres.length} ${roomLabel}</p>
        <div class="search-hotel-card-action__btns">
          <button type="button" class="btn-primary ville-hotel-btn search-hotel-btn" onclick="goHotelDetail(${h.id})">
            Voir détails
          </button>
          <button type="button" class="search-avail-btn" onclick="goHotelChambres(${h.id})">
            Voir les disponibilités
          </button>
        </div>
      </div>
    </article>`;
}

async function loadResults() {
  const container = document.getElementById("resultats");
  prefillSearchForm();

  if (!ville) {
    container.innerHTML = '<p class="home-empty">Utilisez le formulaire ci-dessus pour rechercher un hôtel.</p>';
    return;
  }

  try {
    let url = `${API}/hotels/search?ville=${encodeURIComponent(ville)}`;
    if (personnes) url += `&personnes=${encodeURIComponent(personnes)}`;
    if (type && type !== "tous") url += `&type=${encodeURIComponent(type)}`;
    if (budget) url += `&budget=${encodeURIComponent(budget)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.length) {
      container.innerHTML = `<p class="home-empty">Aucun hôtel ne correspond à votre recherche à ${escapeHtml(ville)}. Modifiez les filtres et réessayez.</p>`;
      return;
    }

    const hotels = {};

    data.forEach(row => {
      if (!hotels[row.hotel_id]) {
        hotels[row.hotel_id] = {
          id: row.hotel_id,
          nom: row.nom,
          ville: row.ville,
          adresse: row.adresse,
          description: row.description,
          image_principale: row.image_principale,
          chambres: []
        };
      }
      hotels[row.hotel_id].chambres.push({
        id: row.chambre_id,
        type: row.type,
        prix: row.prix,
        capacite: row.capacite
      });
    });

    const list = Object.values(hotels);
    const countLabel = list.length > 1 ? "hôtels trouvés" : "hôtel trouvé";

    await FavorisClient.loadFavoriteIds();

    container.innerHTML = `
      <p class="search-results-count">${list.length} ${countLabel} à ${escapeHtml(ville)}</p>
      ${list.map(renderSearchHotelCard).join("")}
    `;

    FavorisClient.refreshAllStars();
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="home-empty">Erreur de chargement. Réessayez plus tard.</p>';
  }
}

loadResults();
