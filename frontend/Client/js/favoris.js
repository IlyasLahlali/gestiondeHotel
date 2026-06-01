const API = window.API_BASE || `${window.location.origin}/api`;

const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str ?? "";
  return el.innerHTML;
}

function goHotelDetail(hotelId) {
  window.location.href = `hotelDetail.html?id=${hotelId}&from=favoris`;
}

function formatFavoriDate(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function parseMinPrice(hotel) {
  const raw = hotel?.prix_min ?? hotel?.prixMin;
  if (raw == null || raw === "") return null;
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRoomCount(hotel) {
  const raw = hotel?.nb_chambres ?? hotel?.nbChambres;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function enrichHotelPricing(hotel) {
  if (parseMinPrice(hotel) != null && parseRoomCount(hotel) > 0) {
    return hotel;
  }

  try {
    const res = await fetch(`${API}/chambres/${hotel.id}`);
    if (!res.ok) return hotel;

    const chambres = await res.json();
    if (!Array.isArray(chambres) || !chambres.length) return hotel;

    hotel.nb_chambres = chambres.length;
    const prices = chambres
      .map(c => parseFloat(String(c.prix).replace(",", ".")))
      .filter(n => Number.isFinite(n) && n > 0);

    if (prices.length) {
      hotel.prix_min = Math.min(...prices);
    }
  } catch (err) {
    console.warn("enrichHotelPricing:", err);
  }

  return hotel;
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

function renderFavoriCard(hotel) {
  const cover = hotelCoverSrc(hotel, "../../images/");
  const desc = hotel.description
    ? `<p class="ville-hotel-desc">${escapeHtml(hotel.description)}</p>`
    : "";
  const favoriDate = formatFavoriDate(hotel.favori_le);
  const favoriDateHtml = favoriDate
    ? `<p class="favori-card-date">★ Ajouté le ${escapeHtml(favoriDate)}</p>`
    : "";
  const nbChambres = parseRoomCount(hotel);
  const roomLabel =
    nbChambres > 1 ? `${nbChambres} chambres proposées` : nbChambres === 1 ? "1 chambre proposée" : "Aucune chambre";

  return `
    <article class="ville-hotel-card search-hotel-card favori-card" data-favori-card="${hotel.id}">
      <div class="ville-hotel-card-media">
        ${FavorisClient.starButtonHtml(hotel.id, true, hotel.nom)}
        <img src="${cover}" alt="${escapeHtml(hotel.nom)}" loading="lazy">
      </div>
      <div class="ville-hotel-card-body">
        <h2>${escapeHtml(hotel.nom)}</h2>
        ${favoriDateHtml}
        <p class="ville-hotel-adresse">📍 ${escapeHtml(hotel.adresse || "Adresse non renseignée")} — ${escapeHtml(hotel.ville)}</p>
        ${desc}
      </div>
      <div class="ville-hotel-card-action search-hotel-card-action">
        ${renderPriceBlock(hotel)}
        <p class="search-hotel-rooms">${roomLabel}</p>
        <button type="button" class="btn-primary ville-hotel-btn search-hotel-btn" onclick="goHotelDetail(${hotel.id})">
          Voir détails
        </button>
      </div>
    </article>`;
}

async function loadFavoris() {
  const list = document.getElementById("favorisList");

  try {
    const res = await fetch(`${API}/favoris`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401 || res.status === 403) {
      window.location.href = "login.html";
      return;
    }

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const hotels = await res.json();

    if (!hotels.length) {
      list.innerHTML =
        '<p class="home-empty">Vous n\'avez pas encore d\'hôtel favori. Explorez les destinations et cliquez sur ☆ pour en ajouter.</p>';
      return;
    }

    await Promise.all(hotels.map(enrichHotelPricing));
    await FavorisClient.loadFavoriteIds(true);

    const countLabel = hotels.length > 1 ? "hôtels en favoris" : "hôtel en favori";
    list.innerHTML = `
      <p class="search-results-count">${hotels.length} ${countLabel}</p>
      ${hotels.map(renderFavoriCard).join("")}
    `;
  } catch (err) {
    console.error(err);
    list.innerHTML = '<p class="home-empty">Erreur de chargement des favoris.</p>';
  }
}

document.addEventListener("favoris:changed", e => {
  const { hotelId, isFavorite } = e.detail || {};
  if (!document.getElementById("favorisList")) return;
  if (isFavorite) return;

  const card = document.querySelector(`[data-favori-card="${hotelId}"]`);
  if (card) card.remove();

  const list = document.getElementById("favorisList");
  if (!list) return;

  const remaining = list.querySelectorAll("[data-favori-card]").length;
  const countEl = list.querySelector(".search-results-count");

  if (remaining === 0) {
    list.innerHTML =
      '<p class="home-empty">Vous n\'avez pas encore d\'hôtel favori. Explorez les destinations et cliquez sur ☆ pour en ajouter.</p>';
    return;
  }

  if (countEl) {
    const countLabel = remaining > 1 ? "hôtels en favoris" : "hôtel en favori";
    countEl.textContent = `${remaining} ${countLabel}`;
  }
});

loadFavoris();
