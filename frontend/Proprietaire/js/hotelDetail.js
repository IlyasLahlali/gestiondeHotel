const {
  API, token, ownerHeaders, escapeHtml, escapeAttr, statutBadge,
  openModal, closeModal, fetchOwnerHotel, goToHotelsList
} = OwnerCommon;

const params = new URLSearchParams(window.location.search);
const hotelId = params.get("id");
const searchFilters = OwnerCommon.getSearchFiltersFromUrl(params);

let hotel = null;
let editMapPicker = null;

if (!hotelId) {
  window.location.href = "hotel.html";
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "short", year: "numeric"
    });
  } catch {
    return "";
  }
}

function mapsUrl(lat, lng, label) {
  const la = HotelMap?.parseCoord(lat);
  const ln = HotelMap?.parseCoord(lng);
  if (la == null || ln == null) return null;
  if (window.HotelMap?.externalMapsUrl) {
    return HotelMap.externalMapsUrl(la, ln, label);
  }
  return `https://www.google.com/maps?q=${la},${ln}`;
}

async function renderLocationSection() {
  const mapEl = document.getElementById("hotelMapView");
  const mapsLink = document.getElementById("mapsLink");
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
    mapEl.outerHTML = '<p class="owner-muted hotel-map-hint">Carte non disponible — renseignez l\'adresse et la localisation via Modifier.</p>';
    if (mapsLink) mapsLink.style.display = "none";
    return;
  }

  if (mapsLink) {
    mapsLink.href = mapsUrl(lat, lng, hotel.nom);
    mapsLink.style.display = "inline-flex";
  }

  const view = new HotelMap.HotelMapView("hotelMapView", lat, lng, hotel.nom);
  await view.render();
  setTimeout(() => view.map?.invalidateSize(), 400);
}

async function loadGalleryUrls() {
  const res = await fetch(`${API}/hotels/${hotelId}/images`);
  const gallery = res.ok ? await res.json() : [];
  const urls = [];
  const seen = new Set();
  function add(path) {
    if (!path || seen.has(path)) return;
    seen.add(path);
    urls.push(`${API_ORIGIN}${path}`);
  }
  if (hotel?.image_principale) add(hotel.image_principale);
  gallery.forEach(img => add(img.chemin));
  return urls;
}

function bindOwnerHotelGallery(container) {
  container.querySelectorAll("[data-owner-hotel-carousel]").forEach(root => {
    let urls = [];
    try {
      urls = JSON.parse(root.dataset.ownerHotelUrls || "[]");
    } catch {
      return;
    }

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

  container.querySelectorAll("[data-owner-hotel-gallery]").forEach(media => {
    let urls = [];
    try {
      urls = JSON.parse(media.dataset.ownerHotelGallery || "[]");
    } catch {
      return;
    }
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

function renderGalleryVisual(imageUrls, hotelName) {
  const urls = imageUrls.length ? imageUrls : ["../../images/hero.jpg"];
  const alt = escapeAttr(hotelName);
  const urlsJson = escapeAttr(JSON.stringify(urls));

  if (urls.length === 1) {
    return `
      <div class="owner-hotel-carousel owner-hotel-carousel--single chambre-card-media chambre-card-media--clickable" data-owner-hotel-gallery="${urlsJson}" role="button" tabindex="0" aria-label="Voir les photos">
        <img src="${urls[0]}" alt="${alt}" loading="eager">
        <span class="hotel-showcase-zoom">🔍 Voir en grand</span>
      </div>`;
  }

  const slides = urls
    .map(
      (url, i) => `
      <div class="chambre-carousel-slide">
        <img src="${url}" alt="${alt} — photo ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}">
      </div>`
    )
    .join("");

  return `
    <div class="owner-hotel-carousel chambre-card-media chambre-card-carousel" data-owner-hotel-carousel data-owner-hotel-urls="${urlsJson}">
      <div class="chambre-carousel-viewport" data-carousel-viewport role="button" tabindex="0" aria-label="Agrandir les photos">
        <div class="chambre-carousel-track">${slides}</div>
      </div>
      <button type="button" class="chambre-carousel-btn chambre-carousel-prev" data-carousel-prev aria-label="Photo précédente">‹</button>
      <button type="button" class="chambre-carousel-btn chambre-carousel-next" data-carousel-next aria-label="Photo suivante">›</button>
      <span class="chambre-carousel-counter" data-carousel-counter>1 / ${urls.length}</span>
      <span class="hotel-showcase-zoom">🔍 Voir en grand</span>
    </div>`;
}

function canDeleteHotel(h) {
  if (!h) return false;
  if (h.peut_supprimer === true) return true;
  if (h.peut_supprimer === false) return false;
  const statut = String(h.statut || "").trim().toLowerCase();
  return statut === "en_attente" || statut === "refuse";
}

function getDeleteBlockMessage(h) {
  if (h?.message_suppression) return h.message_suppression;
  return "Impossible de supprimer : des clients ont encore des réservations actives sur cet hôtel (aujourd'hui ou prochainement) et des réservations en attente.";
}

function renderHotelShowcase(label, cls, galleryUrls) {
  const imageUrls = galleryUrls.length ? galleryUrls : ["../../images/hero.jpg"];
  const nbChambres = hotel.nb_chambres || 0;
  const roomLabel =
    nbChambres > 1
      ? `${nbChambres} chambres proposées`
      : nbChambres === 1
        ? "1 chambre proposée"
        : "Aucune chambre pour le moment";

  return `
    <article class="hotel-showcase owner-hotel-showcase" data-owner-hotel-gallery-root>
      <div class="hotel-showcase-top">
        <div class="hotel-showcase-visual">
          ${renderGalleryVisual(imageUrls, hotel.nom)}
        </div>

        <aside class="hotel-showcase-book card owner-hotel-side-card">
          <span class="section-tag">Mon établissement</span>
          <div class="owner-hotel-side-head">
            <h2>${escapeHtml(hotel.nom)}</h2>
            <span class="admin-badge ${cls}">${label}</span>
          </div>
          <div class="search-hotel-price">
            <span class="search-hotel-price-label">Chambres</span>
            <span class="search-hotel-price-value">${nbChambres}</span>
            <span class="search-hotel-price-unit">en ligne</span>
          </div>
          <p class="hotel-showcase-book-city">📍 ${escapeHtml(hotel.adresse || "Adresse non renseignée")} — ${escapeHtml(hotel.ville)}</p>
          <p class="hotel-showcase-rooms">${roomLabel}</p>
          <ul class="hotel-showcase-perks">
            <li>✔ ${imageUrls.length} photo(s) publiée(s)</li>
            <li>✔ Visible sur la fiche client</li>
            <li>✔ Modifiable à tout moment</li>
          </ul>
          <button type="button" class="btn-primary home-cta-btn hotel-showcase-cta" onclick="goToChambres()">
            Gérer les chambres
          </button>
          <div class="owner-hotel-side-actions">
            <button type="button" class="owner-hotel-action-btn owner-hotel-action-btn--edit" onclick="openEditHotelModal()">Modifier</button>
            <button type="button" class="owner-hotel-action-btn owner-hotel-action-btn--delete" onclick="handleDeleteHotelClick()" aria-describedby="deleteHotelHint">Supprimer</button>
          </div>
          <p id="deleteHotelHint" class="owner-hotel-delete-hint" role="status" hidden></p>
        </aside>
      </div>
    </article>`;
}

function scrollToFooterContact() {
  document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToOwnerSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function initOwnerHotelDetailHeaderNav() {
  const sectionButtons = document.querySelectorAll("[data-owner-section]");

  sectionButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      scrollToOwnerSection(btn.dataset.ownerSection);
      sectionButtons.forEach(other => other.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });
}

function renderAvisSection(data) {
  if (!data || !data.stats?.total) {
    return `<section id="ownerAvisSection" class="owner-detail-section card owner-avis-section"><h2 class="owner-section-title">Avis clients</h2><p class="owner-muted">Aucun avis pour le moment.</p></section>`;
  }
  const items = data.avis.map(a => `
    <article class="owner-avis-card">
      <div class="owner-avis-card__head">
        <strong>${escapeHtml(a.client?.prenom || "Client")} ${escapeHtml(a.client?.nom || "")}</strong>
        ${AvisStars.renderStarsHtml(a.note, { size: "sm" })}
      </div>
      <p>${escapeHtml(a.commentaire || "")}</p>
      <time class="owner-muted">${formatDate(a.created_at)}</time>
    </article>`).join("");

  return `
    <section id="ownerAvisSection" class="owner-detail-section card owner-avis-section">
      <div class="owner-section-head owner-avis-section-head">
        <h2 class="owner-section-title">Avis clients</h2>
        ${AvisStars.renderRatingSummary(data.stats)}
      </div>
      <div class="owner-avis-list">${items}</div>
    </section>`;
}

function renderDescriptionContent() {
  if (hotel.description?.trim()) {
    return `<p class="owner-establishment-desc">${escapeHtml(hotel.description)}</p>`;
  }
  return `
    <div class="owner-establishment-desc-empty">
      <p>Aucune description — les clients verront « Description à venir ».</p>
      <button type="button" class="owner-btn owner-btn-soft owner-btn-sm" onclick="openEditHotelModal()">Rédiger la description</button>
    </div>`;
}

function renderEstablishmentPanel(label, cls, photoCount) {
  return `
    <section id="ownerEstablishmentSection" class="owner-detail-section card owner-establishment-panel">
      <div class="owner-establishment-head">
        <div>
          <h2 class="owner-section-title">À propos de l'établissement</h2>
          <p class="owner-establishment-sub">Informations visibles par les clients sur votre fiche publique.</p>
        </div>
      </div>

      <div class="owner-establishment-stats">
        <div class="owner-stat-tile">
          <span class="owner-stat-tile__icon" aria-hidden="true">📍</span>
          <div>
            <span class="owner-stat-tile__label">Ville</span>
            <strong class="owner-stat-tile__value">${escapeHtml(hotel.ville)}</strong>
          </div>
        </div>
        <div class="owner-stat-tile">
          <span class="owner-stat-tile__icon" aria-hidden="true">🛏</span>
          <div>
            <span class="owner-stat-tile__label">Chambres</span>
            <strong class="owner-stat-tile__value">${hotel.nb_chambres || 0}</strong>
          </div>
        </div>
        <div class="owner-stat-tile">
          <span class="owner-stat-tile__icon" aria-hidden="true">📷</span>
          <div>
            <span class="owner-stat-tile__label">Photos</span>
            <strong class="owner-stat-tile__value">${photoCount}</strong>
          </div>
        </div>
        <div class="owner-stat-tile owner-stat-tile--statut">
          <span class="owner-stat-tile__icon" aria-hidden="true">✓</span>
          <div>
            <span class="owner-stat-tile__label">Statut</span>
            <strong class="owner-stat-tile__value"><span class="admin-badge ${cls}">${label}</span></strong>
          </div>
        </div>
      </div>

      <div class="owner-establishment-body">
        <article class="owner-establishment-item">
          <h3 class="owner-establishment-item__title">Adresse</h3>
          <p class="owner-establishment-item__text">${escapeHtml(hotel.adresse || "Non renseignée")}</p>
        </article>
        <article class="owner-establishment-item owner-establishment-item--desc">
          <h3 class="owner-establishment-item__title">Description</h3>
          ${renderDescriptionContent()}
        </article>
      </div>
    </section>`;
}

async function renderPage() {
  const main = document.getElementById("hotelDetailMain");
  if (!hotel) {
    main.innerHTML = `<p class="owner-error">Hôtel introuvable.</p>`;
    return;
  }

  const { label, cls } = statutBadge(hotel.statut);
  const galleryUrls = await loadGalleryUrls();
  const photoCount = galleryUrls.length;

  let avisData = null;
  try {
    const avisRes = await fetch(`${API}/hotels/mes-hotels/${hotelId}/avis`, {
      headers: { Authorization: ownerHeaders.Authorization }
    });
    avisData = avisRes.ok ? await avisRes.json() : null;
  } catch {
    avisData = null;
  }

  main.innerHTML = `
    ${renderHotelShowcase(label, cls, galleryUrls)}

    ${renderEstablishmentPanel(label, cls, photoCount)}

    <section id="ownerLocationSection" class="owner-detail-section card owner-location-section">
      <div class="owner-section-head">
        <h2 class="owner-section-title">Localisation</h2>
        <a id="mapsLink" class="owner-btn owner-btn-soft owner-btn-sm" href="#" target="_blank" rel="noopener" style="display:none">
          <span aria-hidden="true">🗺</span> Voir sur Google Maps
        </a>
      </div>
      <p class="owner-location-address">${escapeHtml(hotel.adresse || "Adresse non renseignée")} — ${escapeHtml(hotel.ville)}</p>
      <div id="hotelMapView" class="owner-map-view"></div>
    </section>

    ${renderAvisSection(avisData)}`;

  bindOwnerHotelGallery(main);

  await renderLocationSection();
}

function goToChambres() {
  window.location.href = OwnerCommon.buildChambreDetailUrl(hotelId, searchFilters);
}

async function loadHotel() {
  hotel = await fetchOwnerHotel(hotelId);
  await renderPage();
}

let pendingHotelPhotoUrls = [];

function resetHotelPhotoInput() {
  const input = document.getElementById("editUploadPhotos");
  if (input) input.value = "";
  clearPendingHotelPhotoPreviews();
}

function clearPendingHotelPhotoPreviews() {
  pendingHotelPhotoUrls.forEach(url => URL.revokeObjectURL(url));
  pendingHotelPhotoUrls = [];
  const grid = document.getElementById("editPendingGrid");
  if (grid) grid.innerHTML = "";
}

function renderPendingHotelPhotoPreviews() {
  const input = document.getElementById("editUploadPhotos");
  const grid = document.getElementById("editPendingGrid");
  if (!input || !grid) return;

  clearPendingHotelPhotoPreviews();
  const files = input.files;
  if (!files?.length) return;

  const hasPrincipal = !!hotel?.image_principale;

  grid.innerHTML = Array.from(files).map((file, index) => {
    const url = URL.createObjectURL(file);
    pendingHotelPhotoUrls.push(url);
    const isMain = !hasPrincipal && index === 0;
    return `
      <figure class="owner-chambre-gallery__item owner-chambre-gallery__item--pending">
        <img src="${url}" alt="Nouvelle photo ${index + 1}">
        ${isMain ? '<span class="owner-chambre-gallery__badge">Page principale</span>' : '<span class="owner-chambre-gallery__badge owner-chambre-gallery__badge--new">Nouveau</span>'}
      </figure>`;
  }).join("");
}

function renderHotelGalleryEmptyState(message) {
  return `<div class="owner-chambre-gallery-empty">${escapeHtml(message)}</div>`;
}

function openEditHotelModal() {
  document.getElementById("editNom").value = hotel.nom || "";
  document.getElementById("editVille").value = hotel.ville || "";
  document.getElementById("editAdresse").value = hotel.adresse || "";
  document.getElementById("editDescription").value = hotel.description || "";
  resetHotelPhotoInput();
  openModal("editHotelModal");
  loadEditGallery();
  initEditMap();
}

function closeEditHotelModal() {
  resetHotelPhotoInput();
  closeModal("editHotelModal");
}

async function initEditMap() {
  if (!window.HotelMap) return;
  if (!editMapPicker) {
    editMapPicker = new HotelMap.HotelMapPicker("editMap", {
      addressInputId: "editAdresse",
      villeSelectId: "editVille"
    });
    document.getElementById("editMapLocate")?.addEventListener("click", () => editMapPicker?.locateUser());
    document.getElementById("editVille")?.addEventListener("change", e => editMapPicker?.onVilleChange(e.target.value));
  }
  await editMapPicker.setFromHotel(hotel.latitude, hotel.longitude, hotel.ville);
  setTimeout(() => editMapPicker.invalidateSize(), 250);
}

async function loadEditGallery() {
  const grid = document.getElementById("editGalleryGrid");
  grid.innerHTML = "<p class='owner-loading-inline'>Chargement des photos…</p>";
  const imagesRes = await fetch(`${API}/hotels/${hotelId}/images`);
  const images = imagesRes.ok ? await imagesRes.json() : [];
  const principal = hotel.image_principale;
  const items = [];
  if (principal) items.push({ id: "principal", chemin: principal, isPrincipal: true });
  images.forEach(img => {
    if (img.chemin !== principal) items.push({ ...img, isPrincipal: false });
  });

  if (!items.length) {
    grid.innerHTML = renderHotelGalleryEmptyState(
      "Aucune photo. Ajoutez-en ci-dessus puis enregistrez."
    );
    return;
  }

  grid.innerHTML = items
    .map(
      (img, index) => `
    <figure class="owner-chambre-gallery__item ${index === 0 ? "is-cover" : ""}">
      <img src="${API_ORIGIN}${escapeAttr(img.chemin)}" alt="Photo ${index + 1}">
      ${index === 0 ? '<span class="owner-chambre-gallery__badge">Page principale</span>' : ""}
      <button type="button" class="owner-chambre-gallery__remove" onclick="deleteHotelPhoto('${img.id}')" aria-label="Supprimer cette photo">×</button>
    </figure>`
    )
    .join("");
}

async function saveHotelEdit() {
  const coords = editMapPicker ? editMapPicker.getLatLng() : { latitude: hotel.latitude, longitude: hotel.longitude };
  const body = {
    nom: document.getElementById("editNom").value,
    ville: document.getElementById("editVille").value,
    adresse: document.getElementById("editAdresse").value,
    description: document.getElementById("editDescription").value,
    latitude: coords.latitude,
    longitude: coords.longitude
  };
  const res = await fetch(`${API}/hotels/${hotelId}`, {
    method: "PUT",
    headers: ownerHeaders,
    body: JSON.stringify(body)
  });
  if (!res.ok) { alert("Erreur lors de la modification"); return; }

  const files = document.getElementById("editUploadPhotos")?.files;
  if (files?.length) {
    try {
      await uploadHotelPhotoBatch(hotelId, files, token, {
        hasPrincipal: !!hotel.image_principale
      });
    } catch (e) {
      alert(e.message);
    }
  }

  closeEditHotelModal();
  hotel = await fetchOwnerHotel(hotelId);
  await renderPage();
}

async function setPrincipalImage(imageId) {
  const res = await fetch(`${API}/hotels/${hotelId}/image-principale/${imageId}`, {
    method: "PUT",
    headers: { Authorization: ownerHeaders.Authorization }
  });
  if (!res.ok) throw new Error("Erreur");
}

async function deleteHotelPhoto(imageId) {
  if (!confirm("Supprimer cette photo ?")) return;

  if (String(imageId) === "principal") {
    const res = await fetch(`${API}/hotels/${hotelId}/image-principale`, {
      method: "DELETE",
      headers: { Authorization: ownerHeaders.Authorization }
    });
    if (!res.ok) { alert("Erreur"); return; }

    const imagesRes = await fetch(`${API}/hotels/${hotelId}/images`);
    const images = imagesRes.ok ? await imagesRes.json() : [];
    if (images.length) {
      try {
        await setPrincipalImage(images[0].id);
      } catch {
        alert("Erreur");
        return;
      }
    }
  } else {
    await fetch(`${API}/hotels/images/${imageId}`, {
      method: "DELETE",
      headers: { Authorization: ownerHeaders.Authorization }
    });

    if (hotel.image_principale) {
      const imagesRes = await fetch(`${API}/hotels/${hotelId}/images`);
      const images = imagesRes.ok ? await imagesRes.json() : [];
      const stillHasPrincipal = images.some(img => img.chemin === hotel.image_principale);
      if (!stillHasPrincipal && images.length) {
        try {
          await setPrincipalImage(images[0].id);
        } catch {
          alert("Erreur");
          return;
        }
      }
    }
  }

  hotel = await fetchOwnerHotel(hotelId);
  loadEditGallery();
}

function handleDeleteHotelClick() {
  if (!canDeleteHotel(hotel)) {
    showHotelDeleteHint();
    return;
  }
  hideHotelDeleteHint();
  openDeleteHotelModal();
}

function hideHotelDeleteHint() {
  const hint = document.getElementById("deleteHotelHint");
  if (!hint) return;
  hint.hidden = true;
  hint.textContent = "";
}

function showHotelDeleteHint(messageOverride) {
  const hint = document.getElementById("deleteHotelHint");
  if (!hint) return;

  hint.textContent = messageOverride || getDeleteBlockMessage(hotel);
  hint.hidden = false;
  hint.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function openDeleteHotelModal() {
  const subtitle = document.getElementById("deleteHotelSubtitle");
  const confirmBtn = document.getElementById("deleteHotelConfirmBtn");
  const name = hotel?.nom ? `« ${hotel.nom} »` : "Cet hôtel";
  if (subtitle) {
    subtitle.textContent =
      `Cette action est définitive. ${name}, ses chambres, ses photos et les réservations liées seront supprimés.`;
  }
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Supprimer";
  }
  const overlay = document.getElementById("deleteHotelModal");
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
  }
}

function closeDeleteHotelModal() {
  const overlay = document.getElementById("deleteHotelModal");
  if (overlay) {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  }
}

async function confirmDeleteHotel() {
  const confirmBtn = document.getElementById("deleteHotelConfirmBtn");
  if (confirmBtn?.disabled) return;

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Suppression…";
  }

  try {
    const res = await fetch(`${API}/hotels/${hotelId}`, {
      method: "DELETE",
      headers: { Authorization: ownerHeaders.Authorization }
    });
    if (res.status === 409) {
      let msg = getDeleteBlockMessage(hotel);
      try {
        const data = await res.json();
        if (data?.message) msg = data.message;
      } catch {
        /* ignore */
      }
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Supprimer";
      }
      closeDeleteHotelModal();
      hotel.peut_supprimer = false;
      hotel.message_suppression = msg;
      await renderPage();
      showHotelDeleteHint(msg);
      return;
    }
    if (!res.ok) throw new Error("delete_failed");
    closeDeleteHotelModal();
    goToHotelsList();
  } catch {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Supprimer";
    }
    alert("Impossible de supprimer l'hôtel. Réessayez.");
  }
}

document.getElementById("editUploadPhotos")?.addEventListener("change", renderPendingHotelPhotoPreviews);

document.getElementById("deleteHotelModal")?.addEventListener("click", e => {
  if (e.target.id === "deleteHotelModal") closeDeleteHotelModal();
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const overlay = document.getElementById("deleteHotelModal");
  if (overlay && !overlay.hidden) closeDeleteHotelModal();
});

loadHotel();
initOwnerHotelDetailHeaderNav();
