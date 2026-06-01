const {
  API, token, ownerHeaders, escapeHtml, escapeAttr, formatTypeLabel,
  openModal, closeModal, fetchOwnerHotel
} = OwnerCommon;

const params = new URLSearchParams(window.location.search);
const hotelId = params.get("hotelId");
const searchFilters = OwnerCommon.getSearchFiltersFromUrl(params);
const filterType = searchFilters.type;
const filterCapacite = searchFilters.capacite;

let hotel = null;
let chambres = [];
let selectedChambreId = null;
let isAddMode = false;

const CHAMBRE_TYPE_OPTIONS = [
  "economique",
  "standard",
  "superieur",
  "deluxe",
  "suite",
  "familiale",
  "luxe"
];

if (!hotelId) {
  window.location.href = "hotel.html";
}

function scrollToFooterContact() {
  document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const ownerChambreBackBtn = document.getElementById("ownerChambreBackBtn");
if (ownerChambreBackBtn && hotelId) {
  ownerChambreBackBtn.dataset.ownerBackFallback = OwnerCommon.buildHotelDetailUrl(hotelId, searchFilters);
}

function canDeleteChambre(c) {
  if (!c) return false;
  if (c.peut_supprimer === true) return true;
  if (c.peut_supprimer === false) return false;
  const statut = String(hotel?.statut || "").trim().toLowerCase();
  return statut === "en_attente" || statut === "refuse";
}

function getChambreDeleteBlockMessage(c) {
  if (c?.message_suppression) return c.message_suppression;
  return "Impossible de supprimer : des clients ont encore des réservations actives ou en attente sur cette chambre (aujourd'hui ou prochainement).";
}

function findChambreById(id) {
  return chambres.find(c => String(c.id) === String(id)) || null;
}

function renderTypeBadge(c) {
  return `<span class="chambre-card-type-badge">${escapeHtml(formatTypeLabel(c.type))}</span>`;
}

function bindChambreCarousels(container) {
  container.querySelectorAll("[data-chambre-carousel]").forEach(root => {
    let urls = [];
    try {
      urls = JSON.parse(root.dataset.chambreUrls || "[]");
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

  container.querySelectorAll("[data-chambre-gallery]").forEach(media => {
    let urls = [];
    try {
      urls = JSON.parse(media.dataset.chambreGallery || "[]");
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

function renderChambreMedia(c) {
  const urls = getChambreImageUrls(c);
  const typeLabel = escapeHtml(formatTypeLabel(c.type));
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
        <h3>${escapeHtml(formatTypeLabel(c.type))}</h3>
        <div class="chambre-card-price-block">
          <span class="search-hotel-price-label">Prix</span>
          <span class="chambre-card-price-value">${Number.isFinite(prix) ? prix : c.prix} DH</span>
          <span class="search-hotel-price-unit">/ nuit</span>
        </div>
        <p class="chambre-card-cap">👥 Jusqu'à ${c.capacite} personnes</p>
        <div class="owner-chambre-card__actions">
          <button type="button" class="owner-chambre-action-btn owner-chambre-action-btn--edit" onclick="openEditChambreModal(${c.id})">Modifier</button>
          <button type="button" class="owner-chambre-action-btn owner-chambre-action-btn--delete" onclick="handleDeleteChambreClick(${c.id})" aria-describedby="deleteChambreHint-${c.id}">Supprimer</button>
        </div>
        <p id="deleteChambreHint-${c.id}" class="owner-chambre-delete-hint" role="status" hidden></p>
      </div>
    </article>`;
}

function populateTypeFilter() {
  const select = document.getElementById("chFilterType");
  if (!select) return;

  const types = new Set(CHAMBRE_TYPE_OPTIONS);
  chambres.forEach(c => {
    if (c?.type) types.add(c.type);
  });
  if (filterType) types.add(filterType);

  const options = [...types].map(type => {
    return `<option value="${escapeAttr(type)}">${escapeHtml(formatTypeLabel(type))}</option>`;
  }).join("");

  select.innerHTML = `<option value="">Tous</option>${options}`;
}

function applyChambreFiltersFromUrl() {
  const typeSelect = document.getElementById("chFilterType");
  const capInput = document.getElementById("chFilterCapacite");

  if (filterType && typeSelect) {
    typeSelect.value = filterType;
  }
  if (filterCapacite && capInput) {
    capInput.value = filterCapacite;
  }
}

function hasActiveChambreFilters() {
  const typeVal = document.getElementById("chFilterType")?.value || "";
  const capVal = document.getElementById("chFilterCapacite")?.value?.trim();
  return Boolean(typeVal || capVal);
}

function getFilteredChambres() {
  const typeVal = document.getElementById("chFilterType")?.value || "";
  const capRaw = document.getElementById("chFilterCapacite")?.value?.trim();
  const capExact = capRaw ? Number(capRaw) : null;

  return chambres.filter(c => {
    if (typeVal && c.type !== typeVal) return false;
    if (capExact != null && Number(c.capacite) !== capExact) return false;
    return true;
  });
}

function formatHotelAddress(h) {
  const adresse = String(h?.adresse || "").trim();
  const ville = String(h?.ville || "").trim();
  if (adresse && ville) return `📍 ${adresse} — ${ville}`;
  if (adresse) return `📍 ${adresse}`;
  if (ville) return `📍 ${ville}`;
  return "📍 Adresse non renseignée";
}

function updateChambreFilterMeta(filteredCount) {
  const meta = document.getElementById("chFilterMeta");
  const total = chambres.length;
  const hasFilters = hasActiveChambreFilters();

  if (meta) meta.classList.toggle("is-filtered", hasFilters);

  if (!meta) return;

  if (!total) {
    meta.textContent = "";
    return;
  }

  if (hasFilters) {
    meta.textContent =
      filteredCount === total
        ? `${total} chambre${total > 1 ? "s" : ""} (filtres actifs)`
        : `${filteredCount} chambre${filteredCount > 1 ? "s" : ""} sur ${total}`;
    return;
  }

  meta.textContent = `${total} chambre${total > 1 ? "s" : ""}`;
}

function renderEmptyChambresList(message, icon = "🛏") {
  const list = document.getElementById("chambresList");
  if (!list) return;
  list.innerHTML =
    `<div class="admin-empty card"><span class="admin-empty-icon">${icon}</span><p>${escapeHtml(message)}</p></div>`;
}

function renderChambresList() {
  const list = document.getElementById("chambresList");
  const filtersSection = document.getElementById("chambresFiltersSection");
  if (!list) return;

  if (!chambres.length) {
    if (filtersSection) filtersSection.hidden = true;
    renderEmptyChambresList("Aucune chambre. Ajoutez votre première chambre.");
    return;
  }

  if (filtersSection) filtersSection.hidden = false;

  const filtered = getFilteredChambres();
  updateChambreFilterMeta(filtered.length);

  if (!filtered.length) {
    list.innerHTML = `
      <div class="admin-empty card owner-chambres-empty-filter">
        <span class="admin-empty-icon">🔍</span>
        <p>Aucune chambre ne correspond à vos filtres.</p>
        <button type="button" class="owner-btn owner-btn-soft owner-btn-sm" onclick="resetChambreFilters()">Réinitialiser les filtres</button>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(renderChambreCard).join("");
  bindChambreCarousels(list);
}

function resetChambreFilters() {
  const typeSelect = document.getElementById("chFilterType");
  const capInput = document.getElementById("chFilterCapacite");
  if (typeSelect) typeSelect.value = "";
  if (capInput) capInput.value = "";
  renderChambresList();
}

async function loadChambres() {
  const list = document.getElementById("chambresList");
  list.innerHTML = "<p class='owner-loading'>Chargement…</p>";

  const res = await fetch(`${API}/chambres/${hotelId}`, {
    headers: ownerHeaders
  });

  if (!res.ok) {
    const filtersSection = document.getElementById("chambresFiltersSection");
    if (filtersSection) filtersSection.hidden = true;
    list.innerHTML =
      `<div class="admin-empty card"><span class="admin-empty-icon">⚠</span><p>Impossible de charger les chambres. Redémarrez le serveur puis réessayez.</p></div>`;
    return;
  }

  chambres = await res.json();
  if (!Array.isArray(chambres)) chambres = [];

  populateTypeFilter();
  applyChambreFiltersFromUrl();
  renderChambresList();
}

async function loadPage() {
  hotel = await fetchOwnerHotel(hotelId);
  if (!hotel) {
    window.location.href = "hotel.html";
    return;
  }
  document.getElementById("hotelTitle").textContent = hotel.nom;
  document.getElementById("hotelSubtitle").textContent = formatHotelAddress(hotel);
  await loadChambres();
}

let pendingPhotoUrls = [];

function resetChambrePhotoInput() {
  const input = document.getElementById("chUploadPhotos");
  if (input) input.value = "";
  clearPendingPhotoPreviews();
}

function clearPendingPhotoPreviews() {
  pendingPhotoUrls.forEach(url => URL.revokeObjectURL(url));
  pendingPhotoUrls = [];
  const grid = document.getElementById("chPendingGrid");
  if (grid) grid.innerHTML = "";
}

function renderPendingPhotoPreviews() {
  const input = document.getElementById("chUploadPhotos");
  const grid = document.getElementById("chPendingGrid");
  if (!input || !grid) return;

  clearPendingPhotoPreviews();
  const files = input.files;
  if (!files?.length) return;

  grid.innerHTML = Array.from(files).map((file, index) => {
    const url = URL.createObjectURL(file);
    pendingPhotoUrls.push(url);
    return `
      <figure class="owner-chambre-gallery__item owner-chambre-gallery__item--pending">
        <img src="${url}" alt="Nouvelle photo ${index + 1}">
        <span class="owner-chambre-gallery__badge owner-chambre-gallery__badge--new">Nouveau</span>
      </figure>`;
  }).join("");
}

function renderGalleryEmptyState(message) {
  return `<div class="owner-chambre-gallery-empty">${escapeHtml(message)}</div>`;
}

function setChambreSaveLoading(isLoading) {
  const btn = document.getElementById("chambreSaveBtn");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Enregistrement…" : "Enregistrer";
}
function openAddChambreModal() {
  isAddMode = true;
  selectedChambreId = null;
  document.getElementById("chambreModalTitle").textContent = "Ajouter une chambre";
  document.getElementById("chType").value = "standard";
  document.getElementById("chPrix").value = "";
  document.getElementById("chCapacite").value = "";
  resetChambrePhotoInput();
  document.getElementById("chGalleryGrid").innerHTML = renderGalleryEmptyState(
    "Aucune photo pour le moment. Ajoutez-en ci-dessus puis enregistrez."
  );
  setChambreSaveLoading(false);
  openModal("editChambreModal");
}

function openEditChambreModal(id) {
  const c = chambres.find(x => x.id === id);
  if (!c) return;
  isAddMode = false;
  selectedChambreId = id;
  document.getElementById("chambreModalTitle").textContent = "Modifier la chambre";
  document.getElementById("chType").value = c.type;
  document.getElementById("chPrix").value = c.prix;
  document.getElementById("chCapacite").value = c.capacite;
  resetChambrePhotoInput();
  setChambreSaveLoading(false);
  openModal("editChambreModal");
  loadChambreGallery(id);
}

function closeChambreModal() {
  resetChambrePhotoInput();
  closeModal("editChambreModal");
}

async function loadChambreGallery(chambreId) {
  const grid = document.getElementById("chGalleryGrid");
  if (!grid) return;

  grid.innerHTML = "<p class='owner-loading-inline'>Chargement des photos…</p>";
  const res = await fetch(`${API}/chambres/${chambreId}/images`);
  const images = res.ok ? await res.json() : [];

  if (!images.length) {
    grid.innerHTML = renderGalleryEmptyState("Aucune photo. Ajoutez-en ci-dessus puis enregistrez.");
    return;
  }

  grid.innerHTML = images
    .map(
      (img, index) => `
    <figure class="owner-chambre-gallery__item ${index === 0 ? "is-cover" : ""}">
      <img src="${API_ORIGIN}${escapeAttr(img.chemin)}" alt="Photo ${index + 1}">
      ${index === 0 ? '<span class="owner-chambre-gallery__badge">Vignette</span>' : ""}
      <button type="button" class="owner-chambre-gallery__remove" onclick="deleteChambrePhoto(${img.id})" aria-label="Supprimer cette photo">×</button>
    </figure>`
    )
    .join("");
}

async function saveChambre() {
  const type = document.getElementById("chType").value;
  const prix = document.getElementById("chPrix").value;
  const capacite = document.getElementById("chCapacite").value;
  const files = document.getElementById("chUploadPhotos").files;

  if (!prix || !capacite) {
    alert("Prix et capacité requis");
    return;
  }

  setChambreSaveLoading(true);

  try {
    if (isAddMode) {
      const res = await fetch(`${API}/chambres`, {
        method: "POST",
        headers: ownerHeaders,
        body: JSON.stringify({ id_hotel: hotelId, type, prix, capacite })
      });
      if (!res.ok) throw new Error("create_failed");
      const data = await res.json();
      selectedChambreId = data.id;
    } else {
      const res = await fetch(`${API}/chambres/${selectedChambreId}`, {
        method: "PUT",
        headers: ownerHeaders,
        body: JSON.stringify({ type, prix, capacite })
      });
      if (!res.ok) throw new Error("update_failed");
    }

    if (selectedChambreId && files.length) {
      await uploadChambreGalleryImages(selectedChambreId, files, token);
    }

    closeChambreModal();
    await loadChambres();
  } catch (e) {
    alert(e?.message || "Erreur lors de l'enregistrement. Réessayez.");
    setChambreSaveLoading(false);
  }
}

async function deleteChambrePhoto(imageId) {
  if (!confirm("Supprimer cette photo ?")) return;
  await fetch(`${API}/chambres/images/${imageId}`, {
    method: "DELETE",
    headers: { Authorization: ownerHeaders.Authorization }
  });
  loadChambreGallery(selectedChambreId);
  await loadChambres();
}

function handleDeleteChambreClick(id) {
  const chambre = findChambreById(id);
  if (!canDeleteChambre(chambre)) {
    showChambreDeleteHint(id);
    return;
  }
  hideChambreDeleteHints();
  openDeleteChambreModal(id);
}

function hideChambreDeleteHints() {
  document.querySelectorAll(".owner-chambre-delete-hint").forEach(el => {
    el.hidden = true;
    el.textContent = "";
  });
}

function showChambreDeleteHint(id, messageOverride) {
  hideChambreDeleteHints();
  const chambre = findChambreById(id);
  const hint = document.getElementById(`deleteChambreHint-${id}`);
  if (!hint) return;

  hint.textContent = messageOverride || getChambreDeleteBlockMessage(chambre);
  hint.hidden = false;
  hint.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function openDeleteChambreModal(id) {
  selectedChambreId = id;
  const chambre = findChambreById(id);
  const subtitle = document.getElementById("deleteChambreSubtitle");
  const confirmBtn = document.getElementById("deleteChambreConfirmBtn");
  const typeLabel = chambre ? formatTypeLabel(chambre.type) : "Cette chambre";

  if (subtitle) {
    subtitle.textContent =
      `Cette action est définitive. La chambre « ${typeLabel} » et ses photos seront supprimées.`;
  }
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Supprimer";
  }

  const overlay = document.getElementById("deleteChambreModal");
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
}

function closeDeleteChambreModal() {
  const overlay = document.getElementById("deleteChambreModal");
  if (overlay) {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".avis-modal-overlay:not([hidden])")) {
      document.body.style.overflow = "";
    }
  }
}

async function confirmDeleteChambre() {
  const confirmBtn = document.getElementById("deleteChambreConfirmBtn");
  if (confirmBtn?.disabled) return;

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Suppression…";
  }

  try {
    const res = await fetch(`${API}/chambres/${selectedChambreId}`, {
      method: "DELETE",
      headers: { Authorization: ownerHeaders.Authorization }
    });
    if (res.status === 409) {
      let msg = getChambreDeleteBlockMessage(findChambreById(selectedChambreId));
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
      closeDeleteChambreModal();
      const chambre = findChambreById(selectedChambreId);
      if (chambre) {
        chambre.peut_supprimer = false;
        chambre.message_suppression = msg;
      }
      await loadChambres();
      showChambreDeleteHint(selectedChambreId, msg);
      return;
    }
    if (!res.ok) throw new Error("delete_failed");
    closeDeleteChambreModal();
    await loadChambres();
  } catch {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Supprimer";
    }
    alert("Impossible de supprimer la chambre. Réessayez.");
  }
}

document.getElementById("chUploadPhotos")?.addEventListener("change", renderPendingPhotoPreviews);

document.getElementById("chFilterType")?.addEventListener("change", renderChambresList);
document.getElementById("chFilterCapacite")?.addEventListener("input", renderChambresList);

document.getElementById("deleteChambreModal")?.addEventListener("click", e => {
  if (e.target.id === "deleteChambreModal") closeDeleteChambreModal();
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  const overlay = document.getElementById("deleteChambreModal");
  if (overlay && !overlay.hidden) closeDeleteChambreModal();
});

loadPage();
