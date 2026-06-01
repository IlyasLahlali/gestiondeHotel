(function (global) {
  const CACHE_HOTELS = "hf_home_hotels_html";
  const CACHE_DEST = "hf_home_dest_html";

  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str ?? "";
    return el.innerHTML;
  }

  function restoreFromCache() {
    try {
      const hotels = sessionStorage.getItem(CACHE_HOTELS);
      const dest = sessionStorage.getItem(CACHE_DEST);
      const hotelList = document.getElementById("hotelList");
      const destList = document.getElementById("destinationsList");
      if (hotels && hotelList) hotelList.innerHTML = hotels;
      if (dest && destList) destList.innerHTML = dest;
    } catch {
      /* ignore */
    }
  }

  function saveHtml(cacheKey, html) {
    try {
      sessionStorage.setItem(cacheKey, html);
    } catch {
      /* ignore */
    }
  }

  function renderHotels(data, imagesBase) {
    return data
      .map((h) => {
        const cover = hotelCoverSrc(h, imagesBase);
        return `
      <article class="home-card">
        <div class="home-card-media home-card-media--hotel">
          <img src="${cover}" alt="${escapeHtml(h.nom)}" loading="lazy">
          <span class="home-card-badge">${h.total_reservations} ${h.total_reservations > 1 ? "réservations" : "réservation"}</span>
        </div>
        <div class="home-card-body">
          <h3>${escapeHtml(h.nom)}</h3>
          <div class="home-card-meta">
            <span>📍 ${escapeHtml(h.ville)}</span>
          </div>
          <button type="button" class="home-card-btn" onclick="openHotel(${h.id})">
            Voir les détails
          </button>
        </div>
      </article>`;
      })
      .join("");
  }

  function renderDestinations(data, imagesBase) {
    return data
      .map((v) => {
        const ville = escapeHtml(v.ville);
        const { image } = getVilleDestination(v.ville, imagesBase);
        return `
        <article class="home-card home-card--destination">
          <div class="home-card-media">
            <img src="${image}" alt="${ville}" loading="lazy">
            <span class="home-card-badge">${v.total_reservations} réservations</span>
          </div>
          <div class="home-card-body">
            <h3>${ville}</h3>
            <button type="button" class="home-card-btn js-explore-ville" data-ville="${escapeHtml(v.ville)}">
              Explorer les hôtels
            </button>
          </div>
        </article>`;
      })
      .join("");
  }

  function bindDestinationButtons(container, goToVille) {
    if (!container) return;
    container.querySelectorAll(".js-explore-ville").forEach((btn) => {
      btn.addEventListener("click", () => goToVille(btn.dataset.ville));
    });
  }

  async function loadPopularHotels(api, imagesBase) {
    const container = document.getElementById("hotelList");
    if (!container) return;

    try {
      const res = await fetch(`${api}/hotels/popular`);
      const data = await res.json();

      if (!data.length) {
        const empty = '<p class="home-empty">Aucun hôtel disponible pour le moment.</p>';
        container.innerHTML = empty;
        saveHtml(CACHE_HOTELS, empty);
        return;
      }

      const html = renderHotels(data, imagesBase);
      container.innerHTML = html;
      saveHtml(CACHE_HOTELS, html);
    } catch (err) {
      console.log("Erreur popular hotels:", err);
    }
  }

  async function loadDestinations(api, imagesBase, goToVille) {
    const container = document.getElementById("destinationsList");
    if (!container) return;

    try {
      const res = await fetch(`${api}/villes/popular`);
      const data = await res.json();

      if (!data.length) {
        const empty = '<p class="home-empty">Aucune destination disponible.</p>';
        container.innerHTML = empty;
        saveHtml(CACHE_DEST, empty);
        return;
      }

      const html = renderDestinations(data, imagesBase);
      container.innerHTML = html;
      saveHtml(CACHE_DEST, html);
      bindDestinationButtons(container, goToVille);
    } catch (err) {
      console.log("Erreur destinations:", err);
    }
  }

  function bindCachedDestinations(goToVille) {
    bindDestinationButtons(document.getElementById("destinationsList"), goToVille);
  }

  global.HomeData = {
    restoreFromCache,
    loadPopularHotels,
    loadDestinations,
    bindCachedDestinations,
  };
})(window);
