const API = window.API_BASE || `${window.location.origin}/api`;
const params = new URLSearchParams(window.location.search);
const villeParam = params.get("ville");

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str ?? "";
  return el.innerHTML;
}

function goHotelDetail(hotelId) {
  const q = new URLSearchParams({ id: hotelId, from: "ville" });
  if (villeParam) q.set("ville", villeParam);
  window.location.href = `hotelDetail.html?${q.toString()}`;
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

function parseMinPrice(hotel) {
  const raw = hotel?.prix_min;
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRoomCount(hotel) {
  const n = Number(hotel?.nb_chambres);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function buildRoomChips(types) {
  if (!types?.length) return "";
  return `<div class="search-hotel-chips">${types
    .slice(0, 4)
    .map(t => `<span class="search-hotel-chip">${escapeHtml(formatChambreType(t))}</span>`)
    .join("")}</div>`;
}

function renderPriceBlock(hotel) {
  const prixMin = parseMinPrice(hotel);
  if (prixMin == null) {
    return `
      <div class="search-hotel-price">
        <span class="search-hotel-price-label">Tarif</span>
        <span class="search-hotel-price-value search-hotel-price-value--muted">Sur demande</span>
      </div>`;
  }

  return `
    <div class="search-hotel-price">
      <span class="search-hotel-price-label">À partir de</span>
      <span class="search-hotel-price-value">${prixMin} DH</span>
      <span class="search-hotel-price-unit">/ nuit</span>
    </div>`;
}

async function enrichHotelWithChambres(hotel) {
  try {
    const res = await fetch(`${API}/chambres/${hotel.id}`);
    if (!res.ok) return hotel;

    const chambres = await res.json();
    if (!Array.isArray(chambres) || !chambres.length) return hotel;

    hotel.nb_chambres = chambres.length;
    hotel.chambre_types = [...new Set(chambres.map(c => c.type).filter(Boolean))];

    const prices = chambres
      .map(c => parseFloat(String(c.prix).replace(",", ".")))
      .filter(n => Number.isFinite(n) && n > 0);

    if (prices.length) {
      hotel.prix_min = Math.min(...prices);
    }
  } catch (err) {
    console.warn("enrichHotelWithChambres:", err);
  }

  return hotel;
}

function renderHotelCard(h) {
  const cover = hotelCoverSrc(h, "../../images/");
  const desc = h.description
    ? `<p class="ville-hotel-desc">${escapeHtml(h.description)}</p>`
    : "";
  const nbChambres = parseRoomCount(h);
  const roomLabel =
    nbChambres > 1 ? `${nbChambres} chambres proposées` : nbChambres === 1 ? "1 chambre proposée" : "Aucune chambre";

  return `
    <article class="ville-hotel-card search-hotel-card">
      <div class="ville-hotel-card-media">
        <img src="${cover}" alt="${escapeHtml(h.nom)}" loading="lazy">
      </div>
      <div class="ville-hotel-card-body">
        <h2>${escapeHtml(h.nom)}</h2>
        <p class="ville-hotel-adresse">📍 ${escapeHtml(h.ville)}</p>
        ${buildRoomChips(h.chambre_types)}
        ${desc}
      </div>
      <div class="ville-hotel-card-action search-hotel-card-action">
        ${renderPriceBlock(h)}
        <p class="search-hotel-rooms">${roomLabel}</p>
        <button type="button" class="btn-primary ville-hotel-btn search-hotel-btn" onclick="goHotelDetail(${h.id})">
          Voir détails
        </button>
      </div>
    </article>`;
}

async function loadHotelsVille() {
  const titleEl = document.getElementById("villeTitle");
  const subtitleEl = document.getElementById("villeSubtitle");
  const list = document.getElementById("hotelsVilleList");

  if (!villeParam) {
    titleEl.textContent = "Ville introuvable";
    list.innerHTML = "<p class='home-empty'>Aucune ville sélectionnée.</p>";
    return;
  }

  const villeDecoded = decodeURIComponent(villeParam);
  titleEl.textContent = `Hôtels à ${villeDecoded}`;

  const dest = getVilleDestination(villeDecoded, "../../images/");
  if (subtitleEl) {
    subtitleEl.textContent = `📍 ${dest.landmark} — Découvrez les établissements disponibles.`;
  }

  try {
    const res = await fetch(`${API}/hotels/validated`);
    const hotels = (await res.json()).filter(
      h => h.ville?.toLowerCase() === villeDecoded.toLowerCase()
    );

    if (!hotels.length) {
      list.innerHTML = `<p class="home-empty">Aucun hôtel disponible à ${escapeHtml(villeDecoded)} pour le moment.</p>`;
      return;
    }

    await Promise.all(hotels.map(enrichHotelWithChambres));

    const countLabel = hotels.length > 1 ? "hôtels disponibles" : "hôtel disponible";
    list.innerHTML = `
      <p class="search-results-count">${hotels.length} ${countLabel} à ${escapeHtml(villeDecoded)}</p>
      ${hotels.map(renderHotelCard).join("")}
    `;
  } catch (err) {
    console.error(err);
    list.innerHTML = "<p class='home-empty'>Erreur de chargement.</p>";
  }
}

loadHotelsVille();
