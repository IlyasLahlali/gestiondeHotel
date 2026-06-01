const { API, ownerHeaders, escapeHtml, escapeAttr, statutBadge, formatTypeLabel } = OwnerCommon;

const urlParams = new URLSearchParams(window.location.search);
const searchNom = urlParams.get("nom") || "";
const searchType = urlParams.get("type") || "";
const searchCapacite = urlParams.get("capacite") || "";

const CHAMBRE_TYPES = [
  "economique",
  "standard",
  "superieur",
  "deluxe",
  "suite",
  "familiale"
];

function scrollToFooterContact() {
  document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function goToHotelDetail(id) {
  window.location.href = OwnerCommon.buildHotelDetailUrl(id, {
    type: searchType,
    capacite: searchCapacite
  });
}

function goToHotelChambres(id) {
  window.location.href = OwnerCommon.buildChambreDetailUrl(id, {
    type: searchType,
    capacite: searchCapacite
  });
}

function formatCapaciteLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return String(value || "");
  return n === 1 ? "1 personne" : `${n} personnes`;
}

function buildSearchContextLabel() {
  const parts = [];

  if (searchNom) {
    parts.push(`« ${searchNom} »`);
  } else {
    parts.push("tous vos hôtels");
  }

  if (searchType) {
    parts.push(formatTypeLabel(searchType).toLowerCase());
  }

  if (searchCapacite) {
    parts.push(formatCapaciteLabel(searchCapacite));
  }

  return parts.join(" · ");
}

function buildRoomChips(chambres) {
  const types = [...new Set((chambres || []).map(c => c.type).filter(Boolean))];
  if (!types.length) return "";

  return `<div class="search-hotel-chips">${types
    .slice(0, 4)
    .map(t => `<span class="search-hotel-chip">${escapeHtml(formatTypeLabel(t))}</span>`)
    .join("")}</div>`;
}

function getMinPrix(chambres) {
  const prices = (chambres || [])
    .map(c => Number(c.prix))
    .filter(n => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
}

function renderSearchHotelCard(hotel) {
  const { label, cls } = statutBadge(hotel.statut);
  const cover = typeof hotelCoverSrc === "function"
    ? hotelCoverSrc(hotel, "../../images/")
    : (hotel.image_principale ? `${window.API_ORIGIN || window.location.origin}${hotel.image_principale}` : "../../images/hero.jpg");

  const chambres = hotel.chambres || [];
  const nbChambres = Number(hotel.nb_chambres) || chambres.length || 0;
  const roomLabel = nbChambres > 1 ? "chambres correspondantes" : "chambre correspondante";
  const adresse = String(hotel.adresse || "").trim();
  const villeLine = adresse
    ? `📍 ${escapeHtml(adresse)} — ${escapeHtml(hotel.ville || "")}`
    : `📍 ${escapeHtml(hotel.ville || "Ville non renseignée")}`;

  const desc = hotel.description
    ? `<p class="ville-hotel-desc">${escapeHtml(hotel.description)}</p>`
    : "";

  const minPrix = getMinPrix(chambres);
  const priceBlock = minPrix != null
    ? `<div class="search-hotel-price">
        <span class="search-hotel-price-label">À partir de</span>
        <span class="search-hotel-price-value">${minPrix} DH</span>
        <span class="search-hotel-price-unit">/ nuit</span>
      </div>`
    : "";

  return `
    <article class="ville-hotel-card search-hotel-card owner-search-hotel-card">
      <div class="ville-hotel-card-media">
        <span class="admin-badge ${cls} owner-search-card__badge">${label}</span>
        <img src="${escapeAttr(cover)}" alt="${escapeAttr(hotel.nom)}" loading="lazy">
      </div>
      <div class="ville-hotel-card-body">
        <h2>${escapeHtml(hotel.nom)}</h2>
        <p class="ville-hotel-adresse">${villeLine}</p>
        ${buildRoomChips(chambres)}
        ${desc}
      </div>
      <div class="ville-hotel-card-action search-hotel-card-action owner-search-card-action">
        ${priceBlock}
        <p class="search-hotel-rooms">${nbChambres} ${roomLabel}</p>
        <div class="owner-search-card-action__btns">
          <button type="button" class="btn-primary ville-hotel-btn search-hotel-btn" onclick="goToHotelDetail(${hotel.id})">
            Voir détails
          </button>
          <button type="button" class="owner-search-card-btn owner-search-card-btn--soft" onclick="goToHotelChambres(${hotel.id})">
            Gérer les chambres
          </button>
        </div>
      </div>
    </article>`;
}

function renderEmptyState() {
  const context = buildSearchContextLabel();
  return `<p class="home-empty">Aucun hôtel ne correspond à votre recherche (${escapeHtml(context)}). Modifiez les filtres et réessayez.</p>`;
}

function aggregateSearchRows(rows) {
  const hotels = {};

  rows.forEach(row => {
    if (!hotels[row.hotel_id]) {
      hotels[row.hotel_id] = {
        id: row.hotel_id,
        nom: row.nom,
        ville: row.ville,
        adresse: row.adresse,
        description: row.description,
        statut: row.statut,
        image_principale: row.image_principale,
        chambres: []
      };
    }

    if (row.id_chambre) {
      hotels[row.hotel_id].chambres.push({
        id: row.id_chambre,
        type: row.type,
        prix: row.prix,
        capacite: row.capacite
      });
    }
  });

  return Object.values(hotels);
}

async function enrichHotelsFromList(hotels) {
  try {
    const res = await fetch(`${API}/hotels/mes-hotels`, { headers: ownerHeaders });
    if (!res.ok) return hotels;

    const list = await res.json();
    const map = new Map((Array.isArray(list) ? list : []).map(h => [Number(h.id), h]));

    return hotels.map(h => {
      const full = map.get(Number(h.id)) || {};
      return {
        ...full,
        ...h,
        statut: h.statut || full.statut,
        image_principale: h.image_principale || full.image_principale || null,
        description: h.description || full.description || "",
        nb_chambres: searchType || searchCapacite
          ? h.chambres.length
          : (Number(full.nb_chambres) || h.chambres.length)
      };
    });
  } catch {
    return hotels;
  }
}

async function loadHotelsSelect() {
  const select = document.getElementById("searchNom");
  if (!select) return;

  try {
    const res = await fetch(`${API}/hotels/mes-hotels`, { headers: ownerHeaders });
    const hotels = await res.json();

    select.innerHTML = `<option value="">Tous les hôtels</option>`;
    (Array.isArray(hotels) ? hotels : []).forEach(h => {
      const opt = document.createElement("option");
      opt.value = h.nom;
      opt.textContent = h.nom;
      if (searchNom && h.nom === searchNom) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  } catch (err) {
    console.log(err);
  }
}

function loadTypesChambres() {
  const select = document.getElementById("searchType");
  if (!select) return;

  select.innerHTML = `<option value="">Tous les types</option>`;
  CHAMBRE_TYPES.forEach(type => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = formatTypeLabel(type);
    if (searchType === type) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function prefillSearchForm() {
  const capaciteInput = document.getElementById("searchCapacite");
  if (capaciteInput && searchCapacite) {
    capaciteInput.value = searchCapacite;
  }
}

function rechercherHotel() {
  const nom = document.getElementById("searchNom")?.value?.trim() || "";
  const type = document.getElementById("searchType")?.value || "";
  const capacite = document.getElementById("searchCapacite")?.value || "";

  if (capacite && Number(capacite) < 1) {
    alert("La capacité doit être >= 1");
    return;
  }

  const params = new URLSearchParams();
  if (nom) params.append("nom", nom);
  if (type) params.append("type", type);
  if (capacite) params.append("capacite", capacite);

  window.location.href = `rechercheResultat.html?${params.toString()}`;
}

async function loadResults() {
  const container = document.getElementById("resultats");
  if (!container) return;

  prefillSearchForm();

  const qs = new URLSearchParams();
  if (searchNom) qs.append("nom", searchNom);
  if (searchType) qs.append("type", searchType);
  if (searchCapacite) qs.append("capacite", searchCapacite);

  try {
    const res = await fetch(`${API}/hotels/searchProprietaire?${qs.toString()}`, {
      headers: ownerHeaders
    });

    const raw = await res.text();
    let data;

    try {
      data = raw ? JSON.parse(raw) : [];
    } catch {
      throw new Error(raw || `Erreur serveur (${res.status})`);
    }

    if (!res.ok) {
      throw new Error(
        typeof data === "string"
          ? data
          : data?.message || `Erreur serveur (${res.status})`
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = renderEmptyState();
      return;
    }

    let hotels = aggregateSearchRows(data);
    hotels = await enrichHotelsFromList(hotels);

    const countLabel = hotels.length > 1 ? "hôtels trouvés" : "hôtel trouvé";
    const context = buildSearchContextLabel();

    container.innerHTML = `
      <p class="search-results-count">${hotels.length} ${countLabel} — ${escapeHtml(context)}</p>
      ${hotels.map(renderSearchHotelCard).join("")}
    `;
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p class="home-empty">${escapeHtml(err.message || "Erreur de chargement. Réessayez plus tard.")}</p>`;
  }
}

window.scrollToFooterContact = scrollToFooterContact;
window.rechercherHotel = rechercherHotel;
window.goToHotelDetail = goToHotelDetail;
window.goToHotelChambres = goToHotelChambres;

loadHotelsSelect();
loadTypesChambres();
loadResults();
