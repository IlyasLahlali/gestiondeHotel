const API = window.API_BASE || `${window.location.origin}/api`;
const params = new URLSearchParams(window.location.search);
const hotelId = params.get("id");

let selectedChambreId = null;
let selectedChambrePrix = null;
let selectedChambreLabel = "";

function escapeHtml(str) {
  const el = document.createElement("div");
  el.textContent = str ?? "";
  return el.innerHTML;
}

function formatType(type) {
  const labels = {
    economique: "Économique",
    standard: "Standard",
    superieur: "Supérieur",
    deluxe: "Deluxe",
    suite: "Suite",
    familiale: "Familiale",
    luxe: "Luxe"
  };
  return labels[type] || type;
}

function buildHotelDetailUrl() {
  const q = new URLSearchParams();
  q.set("id", hotelId);
  ["ville", "personnes", "type", "budget", "from"].forEach(key => {
    const value = params.get(key);
    if (value) q.set(key, value);
  });
  return `hotelDetail.html?${q.toString()}`;
}

function filterChambres(chambres) {
  const personnes = params.get("personnes");
  const type = params.get("type");
  const budget = params.get("budget");

  return chambres.filter(c => {
    if (personnes && Number(c.capacite) < Number(personnes)) return false;
    if (type && type !== "tous" && c.type !== type) return false;
    if (budget && Number(c.prix) > Number(budget)) return false;
    return true;
  });
}

function hasActiveFilters() {
  return Boolean(
    params.get("personnes") ||
    (params.get("type") && params.get("type") !== "tous") ||
    params.get("budget")
  );
}

function getFilterNote() {
  const parts = [];
  const personnes = params.get("personnes");
  const type = params.get("type");
  const budget = params.get("budget");

  if (personnes) parts.push(`${personnes} voyageur(s) minimum`);
  if (type && type !== "tous") parts.push(`type ${formatType(type)}`);
  if (budget) parts.push(`budget max ${budget} DH`);

  return parts.length ? `Filtres actifs : ${parts.join(" · ")}` : "";
}

function renderHotelSummary(hotel) {
  const thumb = hotelCoverSrc(hotel, "../../images/");
  const detailUrl = buildHotelDetailUrl();
  const filterNote = getFilterNote();

  return `
    <div class="chambre-hotel-summary-card">
      <a href="${detailUrl}" class="chambre-summary-link">
        <img src="${thumb}" alt="" class="chambre-summary-thumb">
        <div class="chambre-summary-text">
          <h1>${escapeHtml(hotel.nom)}</h1>
          <p class="chambre-summary-address">📍 ${escapeHtml(hotel.adresse || "Adresse non renseignée")} — ${escapeHtml(hotel.ville)}</p>
          ${filterNote ? `<p class="chambre-filter-note">${escapeHtml(filterNote)}</p>` : ""}
        </div>
      </a>
    </div>
  `;
}

function renderTypeBadge(c) {
  return `<span class="chambre-card-type-badge">${escapeHtml(formatType(c.type))}</span>`;
}

function bindChambreCarousels(container) {
  container.querySelectorAll("[data-chambre-carousel]").forEach(root => {
    const urls = JSON.parse(root.dataset.chambreUrls || "[]");
    const track = root.querySelector(".chambre-carousel-track");
    const viewport = root.querySelector("[data-carousel-viewport]");
    const prev = root.querySelector("[data-carousel-prev]");
    const next = root.querySelector("[data-carousel-next]");
    const counter = root.querySelector("[data-carousel-counter]");
    if (!track || urls.length < 2) return;

    let index = 0;

    function getStep() {
      const slide = track.querySelector(".chambre-carousel-slide");
      if (!slide) return 0;
      const gap = parseFloat(getComputedStyle(track).gap) || 12;
      return slide.offsetWidth + gap;
    }

    function update() {
      track.style.transform = `translateX(-${index * getStep()}px)`;
      if (counter) counter.textContent = `${index + 1} / ${urls.length}`;
      if (prev) {
        prev.disabled = index === 0;
        prev.classList.toggle("is-disabled", index === 0);
      }
      if (next) {
        next.disabled = index === urls.length - 1;
        next.classList.toggle("is-disabled", index === urls.length - 1);
      }
    }

    prev?.addEventListener("click", e => {
      e.stopPropagation();
      if (index > 0) {
        index -= 1;
        update();
      }
    });

    next?.addEventListener("click", e => {
      e.stopPropagation();
      if (index < urls.length - 1) {
        index += 1;
        update();
      }
    });

    viewport?.addEventListener("click", () => openImageGallery(urls, index));
    viewport?.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openImageGallery(urls, index);
      }
    });

    window.addEventListener("resize", update);
    update();
  });

  container.querySelectorAll("[data-chambre-gallery]").forEach(media => {
    const urls = JSON.parse(media.dataset.chambreGallery || "[]");
    if (!urls.length) return;

    media.addEventListener("click", () => openImageGallery(urls, 0));
    media.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openImageGallery(urls, 0);
      }
    });
  });
}

function renderChambreMedia(c) {
  const urls = getChambreImageUrls(c);
  const typeLabel = escapeHtml(formatType(c.type));
  const badge = renderTypeBadge(c);

  if (!urls.length) {
    return `<div class="chambre-card-media">${badge}<div class="chambre-card-placeholder" aria-hidden="true">🛏</div></div>`;
  }

  if (urls.length === 1) {
    return `
      <div class="chambre-card-media chambre-card-media--clickable" data-chambre-gallery='${JSON.stringify(urls)}' role="button" tabindex="0" aria-label="Voir la photo de la chambre">
        ${badge}
        <img src="${urls[0]}" alt="Chambre ${typeLabel}" loading="lazy">
      </div>`;
  }

  const slides = urls
    .map(
      (url, i) => `
      <div class="chambre-carousel-slide">
        <img src="${url}" alt="Chambre ${typeLabel} — photo ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}">
      </div>`
    )
    .join("");

  return `
    <div class="chambre-card-media chambre-card-carousel" data-chambre-carousel data-chambre-urls='${JSON.stringify(urls)}'>
      ${badge}
      <div class="chambre-carousel-viewport" data-carousel-viewport role="button" tabindex="0" aria-label="Agrandir les photos">
        <div class="chambre-carousel-track">${slides}</div>
      </div>
      <button type="button" class="chambre-carousel-btn chambre-carousel-prev" data-carousel-prev aria-label="Photo précédente">‹</button>
      <button type="button" class="chambre-carousel-btn chambre-carousel-next" data-carousel-next aria-label="Photo suivante">›</button>
      <span class="chambre-carousel-counter" data-carousel-counter>1 / ${urls.length}</span>
    </div>`;
}

function renderChambreCard(c) {
  const prix = parseFloat(String(c.prix).replace(",", "."));

  return `
    <article class="chambre-card">
      ${renderChambreMedia(c)}
      <div class="chambre-card-body">
        <h3>${escapeHtml(formatType(c.type))}</h3>
        <div class="chambre-card-price-block">
          <span class="search-hotel-price-label">Prix</span>
          <span class="chambre-card-price-value">${Number.isFinite(prix) ? prix : c.prix} DH</span>
          <span class="search-hotel-price-unit">/ nuit</span>
        </div>
        <p class="chambre-card-cap">👥 Jusqu'à ${c.capacite} personnes</p>
        <button type="button" class="btn-primary chambre-reserve-btn" data-chambre-id="${c.id}" data-chambre-prix="${c.prix}" data-chambre-type="${escapeHtml(c.type)}">
          Réserver
        </button>
      </div>
    </article>
  `;
}

function countNights(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end) - new Date(start);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function updateReservationSummary() {
  const summaryEl = document.getElementById("reservationSummary");
  if (!summaryEl) return;

  const dateDebut = document.getElementById("resStart")?.value;
  const dateFin = document.getElementById("resEnd")?.value;
  const nights = countNights(dateDebut, dateFin);
  const prix = parseFloat(String(selectedChambrePrix).replace(",", "."));

  if (!selectedChambreLabel) {
    summaryEl.textContent = "";
    return;
  }

  let html = `<strong>${escapeHtml(selectedChambreLabel)}</strong>`;
  if (Number.isFinite(prix) && prix > 0) {
    html += ` — ${prix} DH / nuit`;
  }

  if (nights > 0 && Number.isFinite(prix) && prix > 0) {
    html += `<br>Total estimé : <strong>${nights * prix} DH</strong> (${nights} nuit${nights > 1 ? "s" : ""})`;
  }

  summaryEl.innerHTML = html;
}

async function loadPage() {
  if (!hotelId) {
    document.getElementById("chambresList").innerHTML = "<p>Hôtel introuvable.</p>";
    return;
  }

  try {
    const [hotelsRes, chambresRes] = await Promise.all([
      fetch(`${API}/hotels/validated`),
      fetch(`${API}/chambres/${hotelId}`)
    ]);

    const hotels = await hotelsRes.json();
    const hotel = hotels.find(h => h.id == hotelId);
    const allChambres = await chambresRes.json();
    const chambres = filterChambres(allChambres);

    const summary = document.getElementById("hotelSummary");
    if (hotel && summary) {
      summary.innerHTML = renderHotelSummary(hotel);
    }

    const list = document.getElementById("chambresList");
    const countEl = document.getElementById("chambresCount");

    if (!allChambres.length) {
      if (countEl) countEl.textContent = "Aucune chambre publiée pour le moment.";
      list.innerHTML = '<p class="home-empty">Revenez plus tard.</p>';
      return;
    }

    if (!chambres.length) {
      if (countEl) {
        countEl.textContent = hasActiveFilters()
          ? "Aucune chambre ne correspond à vos critères."
          : "Aucune chambre disponible.";
      }
      list.innerHTML = '<p class="home-empty">Modifiez vos filtres ou retournez à la fiche hôtel.</p>';
      return;
    }

    if (countEl) {
      const label = chambres.length > 1 ? "chambres correspondent" : "chambre correspond";
      countEl.textContent = hasActiveFilters()
        ? `${chambres.length} ${label} à votre recherche`
        : `${chambres.length} chambre${chambres.length > 1 ? "s" : ""} disponible${chambres.length > 1 ? "s" : ""}`;
    }

    list.innerHTML = chambres.map(renderChambreCard).join("");
    bindChambreCarousels(list);

    list.querySelectorAll(".chambre-reserve-btn").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        openReservation(Number(btn.dataset.chambreId), {
          prix: btn.dataset.chambrePrix,
          type: btn.dataset.chambreType
        });
      });
    });
  } catch (err) {
    console.error(err);
    document.getElementById("chambresList").innerHTML = "<p>Erreur de chargement.</p>";
  }
}

function openReservation(chambreId, chambreMeta = {}) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  selectedChambreId = chambreId;
  selectedChambrePrix = chambreMeta.prix ?? null;
  selectedChambreLabel = formatType(chambreMeta.type || "");

  document.getElementById("modalReservation").style.display = "flex";
  updateReservationSummary();
}

function closeReservationModal() {
  document.getElementById("modalReservation").style.display = "none";
}

async function confirmReservation() {
  const token = localStorage.getItem("token");
  const date_debut = document.getElementById("resStart")?.value;
  const date_fin = document.getElementById("resEnd")?.value;

  if (!date_debut || !date_fin) {
    alert("Veuillez choisir les dates.");
    return;
  }

  if (date_debut >= date_fin) {
    alert("Dates invalides.");
    return;
  }

  try {
    const res = await fetch(`${API}/reservations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        id_chambre: selectedChambreId,
        date_debut,
        date_fin
      })
    });

    alert(await res.text());
    closeReservationModal();
  } catch (err) {
    console.error(err);
    alert("Erreur serveur.");
  }
}

document.getElementById("resStart")?.addEventListener("change", updateReservationSummary);
document.getElementById("resEnd")?.addEventListener("change", updateReservationSummary);

loadPage();

if (params.get("chambre")) {
  selectedChambreId = Number(params.get("chambre"));
  setTimeout(() => openReservation(selectedChambreId), 300);
}
