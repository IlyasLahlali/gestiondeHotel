const API = window.API_BASE || `${window.location.origin}/api`;
const params = new URLSearchParams(window.location.search);
const hotelId = params.get("id");

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str ?? "";
  return el.innerHTML;
}

function buildChambresUrl() {
  const q = new URLSearchParams();
  q.set("id", hotelId);
  ["ville", "personnes", "type", "budget"].forEach(key => {
    const value = params.get(key);
    if (value) q.set(key, value);
  });
  return `chambreDetail.html?${q.toString()}`;
}

function buildBackUrl(hotel) {
  const from = params.get("from");
  const ville = params.get("ville");

  if (from === "ville" && ville) {
    return `HotelVille.html?ville=${encodeURIComponent(ville)}`;
  }

  if (ville) {
    const q = new URLSearchParams();
    q.set("ville", ville);
    ["personnes", "type", "budget"].forEach(key => {
      const value = params.get(key);
      if (value) q.set(key, value);
    });
    return `rechercheResultat.html?${q.toString()}`;
  }

  if (hotel?.ville) {
    return `HotelVille.html?ville=${encodeURIComponent(hotel.ville)}`;
  }

  return "index.html";
}

function getBackLabel(from) {
  if (from === "ville") return "Retour aux hôtels de la ville";
  if (params.get("ville")) return "Retour aux résultats";
  return "Retour";
}

async function fetchChambresPricing(id) {
  try {
    const res = await fetch(`${API}/chambres/${id}`);
    if (!res.ok) return null;

    const chambres = await res.json();
    if (!Array.isArray(chambres) || !chambres.length) return null;

    const prices = chambres
      .map(c => parseFloat(String(c.prix).replace(",", ".")))
      .filter(n => Number.isFinite(n) && n > 0);

    return {
      nb_chambres: chambres.length,
      prix_min: prices.length ? Math.min(...prices) : null
    };
  } catch (err) {
    console.warn("fetchChambresPricing:", err);
    return null;
  }
}

function renderPriceBlock(pricing) {
  const prixMin = pricing?.prix_min;
  if (!Number.isFinite(prixMin) || prixMin <= 0) {
    return `
      <div class="search-hotel-price hotel-showcase-book-price">
        <span class="search-hotel-price-label">Tarif</span>
        <span class="search-hotel-price-value search-hotel-price-value--muted">Sur demande</span>
      </div>`;
  }

  return `
    <div class="search-hotel-price hotel-showcase-book-price">
      <span class="search-hotel-price-label">À partir de</span>
      <span class="search-hotel-price-value">${prixMin} DH</span>
      <span class="search-hotel-price-unit">/ nuit</span>
    </div>`;
}

function getHotelImageUrls(hotel, gallery) {
  const urls = [];
  const seen = new Set();

  function add(url) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  }

  (gallery || []).forEach(img => add(`${API_ORIGIN}${img.chemin}`));

  if (hotel?.image_principale) {
    add(`${API_ORIGIN}${hotel.image_principale}`);
  }

  if (!urls.length) {
    add(hotelCoverSrc(hotel, "../../images/"));
  }

  return urls;
}

function bindHotelGallery(root, urls) {
  if (!root || !urls.length) return;

  const mainImg = root.querySelector("[data-hotel-main-img]");
  const thumbs = root.querySelectorAll("[data-hotel-thumb]");
  let current = 0;

  function setMain(i) {
    current = i;
    if (mainImg) mainImg.src = urls[i];
    thumbs.forEach((t, idx) => t.classList.toggle("is-active", idx === i));
    const counter = root.querySelector("[data-hotel-counter]");
    if (counter) counter.textContent = `${i + 1} / ${urls.length}`;
  }

  thumbs.forEach((thumb, i) => {
    thumb.addEventListener("click", () => setMain(i));
  });

  root.querySelector("[data-hotel-prev]")?.addEventListener("click", () => {
    setMain((current - 1 + urls.length) % urls.length);
  });

  root.querySelector("[data-hotel-next]")?.addEventListener("click", () => {
    setMain((current + 1) % urls.length);
  });

  root.querySelector("[data-hotel-open-lightbox]")?.addEventListener("click", () => {
    openImageGallery(urls, current);
  });

  setMain(0);
}

async function initHotelLocationMap(hotel) {
  const mapEl = document.getElementById("hotelLocationMap");
  const linkEl = document.getElementById("hotelMapsLink");
  if (!mapEl || !window.HotelMap) return;

  let lat = HotelMap.parseCoord(hotel.latitude);
  let lng = HotelMap.parseCoord(hotel.longitude);

  if (lat == null || lng == null) {
    const coords = await HotelMap.geocodeAddress(hotel.adresse, hotel.ville);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  if (lat == null || lng == null) {
    mapEl.outerHTML =
      '<p class="hotel-map-hint">Carte non disponible pour cette adresse.</p>';
    if (linkEl) linkEl.style.display = "none";
    return;
  }

  if (linkEl) {
    linkEl.href = HotelMap.externalMapsUrl(lat, lng, hotel.nom);
    linkEl.style.display = "inline-flex";
  }

  const view = new HotelMap.HotelMapView("hotelLocationMap", lat, lng, hotel.nom);
  await view.render();
}

function renderHotelDetail(container, hotel, gallery, pricing) {
  const imageUrls = getHotelImageUrls(hotel, gallery);
  const hasMultiple = imageUrls.length > 1;
  const backUrl = buildBackUrl(hotel);
  const backLabel = getBackLabel(params.get("from"));
  const nbChambres = pricing?.nb_chambres || 0;
  const roomLabel =
    nbChambres > 1 ? `${nbChambres} chambres proposées` : nbChambres === 1 ? "1 chambre proposée" : "";

  const thumbsHtml = imageUrls
    .slice(0, 5)
    .map(
      (url, i) =>
        `<button type="button" class="hotel-showcase-thumb ${i === 0 ? "is-active" : ""}" data-hotel-thumb aria-label="Photo ${i + 1}">
          <img src="${url}" alt="">
        </button>`
    )
    .join("");

  const extraCount =
    imageUrls.length > 5
      ? `<span class="hotel-showcase-more">+${imageUrls.length - 5}</span>`
      : "";

  container.innerHTML = `
    <div class="app-back-bar app-back-bar--in-main">
      <button type="button" class="app-back-btn" onclick="if(window.history.length>1){history.back();}else{window.location.href='index.html';}">
        <span class="app-back-btn-icon" aria-hidden="true">←</span>
        Retour
      </button>
    </div>
    <article class="hotel-showcase" data-hotel-gallery>
      <div class="hotel-showcase-top">
        <div class="hotel-showcase-visual">
          <button type="button" class="hotel-showcase-main" data-hotel-open-lightbox aria-label="Agrandir les photos">
            <img data-hotel-main-img src="${imageUrls[0]}" alt="${escapeHtml(hotel.nom)}">
            ${hasMultiple ? `<span class="hotel-showcase-zoom">🔍 Voir en grand</span>` : ""}
            ${hasMultiple ? `<span class="hotel-showcase-counter" data-hotel-counter>1 / ${imageUrls.length}</span>` : ""}
          </button>
          ${
            hasMultiple
              ? `<div class="hotel-showcase-nav">
                  <button type="button" data-hotel-prev aria-label="Précédent">‹</button>
                  <button type="button" data-hotel-next aria-label="Suivant">›</button>
                </div>`
              : ""
          }
          ${
            imageUrls.length > 1
              ? `<div class="hotel-showcase-thumbs">${thumbsHtml}${extraCount}</div>`
              : ""
          }
        </div>

        <aside class="hotel-showcase-book card">
          <span class="section-tag">Réservation</span>
          <h2>${escapeHtml(hotel.nom)}</h2>
          ${renderPriceBlock(pricing)}
          <p class="hotel-showcase-book-city">📍 ${escapeHtml(hotel.adresse || "Adresse non renseignée")} — ${escapeHtml(hotel.ville)}</p>
          ${roomLabel ? `<p class="hotel-showcase-rooms">${roomLabel}</p>` : ""}
          <ul class="hotel-showcase-perks">
            <li>✔ Chambres vérifiées</li>
            <li>✔ Annulation flexible</li>
            <li>✔ Paiement sécurisé</li>
          </ul>
          <button type="button" class="btn-primary home-cta-btn hotel-showcase-cta" id="goChambresBtn">
            Voir les disponibilités
          </button>
        </aside>
      </div>

      <div class="hotel-showcase-details">
        <section class="hotel-showcase-block card">
          <h3>À propos de l'établissement</h3>
          <p class="hotel-showcase-address"><strong>Adresse :</strong> ${escapeHtml(hotel.adresse || "Non renseignée")} — ${escapeHtml(hotel.ville)}</p>
          ${
            hotel.description
              ? `<p class="hotel-showcase-desc">${escapeHtml(hotel.description)}</p>`
              : `<p class="hotel-showcase-desc hotel-showcase-desc--muted">Description à venir.</p>`
          }
        </section>
        <section class="hotel-showcase-block card">
          <h3>Localisation</h3>
          <p class="hotel-showcase-address">${escapeHtml(hotel.adresse || "Non renseignée")} — ${escapeHtml(hotel.ville)}</p>
          <div id="hotelLocationMap" class="hotel-map-view" aria-label="Carte de localisation"></div>
          <a id="hotelMapsLink" class="hotel-map-external-link" href="#" target="_blank" rel="noopener noreferrer" style="display:none">
            🗺 Ouvrir dans Google Maps
          </a>
        </section>
      </div>
    </article>
  `;

  bindHotelGallery(container.querySelector("[data-hotel-gallery]"), imageUrls);

  document.getElementById("goChambresBtn")?.addEventListener("click", () => {
    window.location.href = buildChambresUrl();
  });

  initHotelLocationMap(hotel);
}

async function loadHotel() {
  const main = document.getElementById("hotelDetailMain");
  if (!hotelId) {
    main.innerHTML = "<p class='hotel-detail-loading'>Hôtel introuvable.</p>";
    return;
  }

  try {
    const [hotelsRes, galleryRes, pricing] = await Promise.all([
      fetch(`${API}/hotels/validated`),
      fetch(`${API}/hotels/${hotelId}/images`),
      fetchChambresPricing(hotelId)
    ]);

    const hotels = await hotelsRes.json();
    const hotel = hotels.find(h => h.id == hotelId);
    const gallery = await galleryRes.json();

    if (!hotel) {
      main.innerHTML = "<p class='hotel-detail-loading'>Hôtel introuvable ou non validé.</p>";
      return;
    }

    renderHotelDetail(main, hotel, gallery, pricing);
  } catch (err) {
    console.error(err);
    main.innerHTML = "<p class='hotel-detail-loading'>Erreur de chargement.</p>";
  }
}

loadHotel();
