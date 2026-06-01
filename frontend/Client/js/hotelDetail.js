const API = window.API_BASE || `${window.location.origin}/api`;
const params = new URLSearchParams(window.location.search);
const hotelId = params.get("id");

const AVIS_NOTE_LABELS = {
  1: "Très décevant",
  2: "Décevant",
  3: "Correct",
  4: "Très bien",
  5: "Excellent"
};

function avisStarSvg(filled = false) {
  if (filled) {
    return `<svg class="hotel-avis-star-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }
  return `<svg class="hotel-avis-star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
}

function getToken() {
  return localStorage.getItem("token");
}

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

  if (from === "favoris") {
    return "favoris.html";
  }

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

  return "Dashboard.html";
}

function getBackLabel(from) {
  if (from === "favoris") return "Retour aux favoris";
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

function renderStarsHtml(note, { size = "" } = {}) {
  const n = Math.max(0, Math.min(5, Number(note) || 0));
  const sizeClass = size === "lg" ? " hotel-avis-stars--lg" : "";
  let html = `<span class="hotel-avis-stars${sizeClass}" aria-label="${n} sur 5 étoiles">`;
  for (let i = 1; i <= 5; i += 1) {
    html += `<span class="hotel-avis-star${i <= n ? " is-filled" : ""}">${avisStarSvg(i <= n)}</span>`;
  }
  html += "</span>";
  return html;
}

function formatAvisDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatAuthorName(client) {
  if (!client) return "Client";
  const prenom = String(client.prenom || "").trim();
  const nom = String(client.nom || "").trim();
  if (prenom && nom) return `${prenom} ${nom.charAt(0).toUpperCase()}.`;
  return prenom || nom || "Client";
}

function getCurrentUserName() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) return "Vous";
    const prenom = String(user.prenom || "").trim();
    const nom = String(user.nom || "").trim();
    return [prenom, nom].filter(Boolean).join(" ") || "Vous";
  } catch {
    return "Vous";
  }
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    throw new Error("Non connecté");
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
      ...(options.headers || {})
    }
  });

  if (res.status === 401 || res.status === 403) {
    window.location.href = "login.html";
    throw new Error("Auth");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Erreur serveur");
  }

  return data;
}

async function fetchAvisData(id) {
  try {
    const res = await fetch(`${API}/hotels/${id}/avis`);
    if (!res.ok) return { stats: { moyenne: null, total: 0 }, avis: [] };
    return res.json();
  } catch (err) {
    console.warn("fetchAvisData:", err);
    return { stats: { moyenne: null, total: 0 }, avis: [] };
  }
}

async function fetchMyAvis(id) {
  if (!getToken()) return null;
  try {
    return await apiFetch(`/avis/hotel/${id}/mine`);
  } catch (err) {
    console.warn("fetchMyAvis:", err);
    return null;
  }
}

function showAvisToast(message, isError = false) {
  const existing = document.getElementById("hotelAvisToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "hotelAvisToast";
  toast.className = `hotel-avis-toast${isError ? " is-error" : ""}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3200);
}

let currentMyAvis = null;
let avisModalsInitialized = false;
let editStarPicker = null;
let pendingDeleteAvisId = null;

function renderStarPickerHtml(selectedNote = 0) {
  return [1, 2, 3, 4, 5]
    .map(
      n =>
        `<button type="button" class="hotel-avis-star-btn${selectedNote >= n ? " is-active" : ""}" data-avis-star="${n}" aria-label="${n} étoile${n > 1 ? "s" : ""}">${avisStarSvg(selectedNote >= n)}</button>`
    )
    .join("");
}

function bindStarPicker(root, { initialNote = 0, hintEl } = {}) {
  let selectedNote = initialNote;

  function applyStarVisual(previewNote) {
    const note = previewNote ?? selectedNote;
    root.querySelectorAll("[data-avis-star]").forEach(btn => {
      const n = Number(btn.dataset.avisStar);
      const active = n <= note;
      btn.classList.toggle("is-active", active);
      btn.innerHTML = avisStarSvg(active);
    });
  }

  function setNote(note) {
    selectedNote = note;
    applyStarVisual(selectedNote);
    if (hintEl) {
      hintEl.textContent = note ? AVIS_NOTE_LABELS[note] : "Sélectionnez une note";
    }
  }

  root.querySelectorAll("[data-avis-star]").forEach(btn => {
    btn.addEventListener("click", () => setNote(Number(btn.dataset.avisStar)));
    btn.addEventListener("mouseenter", () => applyStarVisual(Number(btn.dataset.avisStar)));
  });

  root.addEventListener("mouseleave", () => applyStarVisual(selectedNote));

  setNote(initialNote);
  return {
    getNote: () => selectedNote,
    setNote
  };
}

function openModal(overlay) {
  if (!overlay) return;
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(overlay) {
  if (!overlay) return;
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".avis-modal-overlay:not([hidden])")) {
    document.body.style.overflow = "";
  }
}

function closeAllAvisModals() {
  closeModal(document.getElementById("avisEditModal"));
  closeModal(document.getElementById("avisDeleteModal"));
  pendingDeleteAvisId = null;
}

function openAvisEditModal(myAvis) {
  if (!myAvis?.id) return;

  const overlay = document.getElementById("avisEditModal");
  const starsRoot = document.getElementById("avisEditStars");
  const hintEl = document.getElementById("avisEditNoteHint");
  const textarea = document.getElementById("avisEditCommentaire");
  const charCount = document.getElementById("avisEditCharCount");

  if (!overlay || !starsRoot || !textarea) return;

  starsRoot.innerHTML = renderStarPickerHtml(myAvis.note || 0);
  editStarPicker = bindStarPicker(starsRoot, { initialNote: myAvis.note || 0, hintEl });
  textarea.value = myAvis.commentaire || "";
  if (charCount) charCount.textContent = String(textarea.value.length);

  openModal(overlay);
  textarea.focus();
}

function openAvisDeleteModal(avisId) {
  pendingDeleteAvisId = avisId;
  openModal(document.getElementById("avisDeleteModal"));
}

function initAvisModals() {
  if (avisModalsInitialized) return;
  avisModalsInitialized = true;

  const editModal = document.getElementById("avisEditModal");
  const deleteModal = document.getElementById("avisDeleteModal");
  const editTextarea = document.getElementById("avisEditCommentaire");
  const editCharCount = document.getElementById("avisEditCharCount");
  const editSubmit = document.getElementById("avisEditSubmit");
  const deleteConfirm = document.getElementById("avisDeleteConfirm");

  document.querySelectorAll("[data-avis-modal-close]").forEach(btn => {
    btn.addEventListener("click", closeAllAvisModals);
  });

  [editModal, deleteModal].forEach(overlay => {
    overlay?.addEventListener("click", e => {
      if (e.target === overlay) closeAllAvisModals();
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeAllAvisModals();
  });

  editTextarea?.addEventListener("input", () => {
    if (editCharCount) editCharCount.textContent = String(editTextarea.value.length);
  });

  editSubmit?.addEventListener("click", async () => {
    const commentaire = editTextarea?.value.trim() || "";
    const selectedNote = editStarPicker?.getNote() || 0;

    if (!selectedNote) {
      showAvisToast("Choisissez une note entre 1 et 5 étoiles", true);
      return;
    }

    if (commentaire.length < 5) {
      showAvisToast("Le commentaire doit contenir au moins 5 caractères", true);
      return;
    }

    editSubmit.disabled = true;
    editSubmit.textContent = "Enregistrement…";

    try {
      await apiFetch("/avis", {
        method: "POST",
        body: JSON.stringify({
          id_hotel: Number(hotelId),
          note: selectedNote,
          commentaire
        })
      });

      closeAllAvisModals();
      showAvisToast("Avis mis à jour");
      await reloadAvisSection(document.querySelector(".hotel-showcase"));
    } catch (err) {
      showAvisToast(err.message || "Impossible d'enregistrer l'avis", true);
    } finally {
      editSubmit.disabled = false;
      editSubmit.textContent = "Enregistrer";
    }
  });

  deleteConfirm?.addEventListener("click", async () => {
    if (!pendingDeleteAvisId) return;

    deleteConfirm.disabled = true;
    deleteConfirm.textContent = "Suppression…";

    try {
      await apiFetch(`/avis/${pendingDeleteAvisId}`, { method: "DELETE" });
      closeAllAvisModals();
      showAvisToast("Avis supprimé");
      await reloadAvisSection(document.querySelector(".hotel-showcase"));
    } catch (err) {
      showAvisToast(err.message || "Impossible de supprimer l'avis", true);
    } finally {
      deleteConfirm.disabled = false;
      deleteConfirm.textContent = "Supprimer";
      pendingDeleteAvisId = null;
    }
  });
}

function renderAvisAddForm() {
  return `
    <div class="hotel-avis-add" data-avis-add-form>
      <span class="hotel-avis-add-tag">Nouvel avis</span>
      <h4 class="hotel-avis-add-title">Donner votre avis</h4>
      <p class="hotel-avis-add-hint">Partagez votre expérience pour aider les autres voyageurs.</p>

      <div class="hotel-avis-field">
        <label class="hotel-avis-form-label">Votre note</label>
        <div class="hotel-avis-stars-picker">
          <div class="hotel-avis-stars hotel-avis-stars--interactive" data-avis-add-stars role="group" aria-label="Choisir une note">
            ${renderStarPickerHtml(0)}
          </div>
        </div>
        <span class="hotel-avis-note-hint" data-avis-add-note-hint>Sélectionnez une note</span>
      </div>

      <div class="hotel-avis-field">
        <label class="hotel-avis-form-label" for="avisAddCommentaire">Votre commentaire</label>
        <textarea id="avisAddCommentaire" class="hotel-avis-textarea" maxlength="2000" placeholder="Décrivez votre séjour : accueil, confort, emplacement…"></textarea>
        <p class="hotel-avis-char-count"><span data-avis-add-char-count>0</span> / 2000</p>
      </div>

      <button type="button" class="btn-primary home-cta-btn hotel-avis-add-submit" data-avis-add-submit>
        Publier mon avis
      </button>
    </div>`;
}

function sortAvisList(avis, myAvis) {
  return [...avis].sort((a, b) => {
    if (myAvis?.id === a.id) return -1;
    if (myAvis?.id === b.id) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function renderAvisSection(avisData, myAvis) {
  const { stats, avis } = avisData;
  const total = stats?.total || 0;
  const moyenne = stats?.moyenne;
  const loggedIn = Boolean(getToken());
  const hasMyAvis = Boolean(myAvis?.id);
  const sortedAvis = sortAvisList(avis, myAvis);

  const summaryHtml =
    total > 0
      ? `
        <div class="hotel-avis-summary">
          <span class="hotel-avis-score">${moyenne}</span>
          ${renderStarsHtml(Math.round(moyenne), { size: "lg" })}
          <span class="hotel-avis-count">${total} avis</span>
        </div>`
      : `<span class="hotel-avis-count">Aucun avis pour le moment</span>`;

  const formHtml = loggedIn && !hasMyAvis
    ? renderAvisAddForm()
    : !loggedIn
      ? `
        <div class="hotel-avis-login-prompt">
          <a href="login.html">Connectez-vous</a> pour laisser un avis et une note sur cet hôtel.
        </div>`
      : "";

  const listHtml =
    sortedAvis.length > 0
      ? `<div class="hotel-avis-list">
          ${sortedAvis
            .map(item => {
              const isMine = myAvis?.id === item.id;
              return `
                <article class="hotel-avis-item${isMine ? " is-mine" : ""}">
                  <div class="hotel-avis-item-head">
                    <div class="hotel-avis-item-meta">
                      <span class="hotel-avis-author">${escapeHtml(isMine ? getCurrentUserName() : formatAuthorName(item.client))}</span>
                      ${isMine ? `<span class="hotel-avis-you-badge">Vous</span>` : ""}
                    </div>
                    <span class="hotel-avis-date">${formatAvisDate(item.created_at)}</span>
                  </div>
                  ${renderStarsHtml(item.note)}
                  <p>${escapeHtml(item.commentaire)}</p>
                  ${
                    isMine
                      ? `
                  <div class="hotel-avis-item-footer">
                    <button type="button" class="hotel-avis-action-btn" data-avis-edit>Modifier</button>
                    <button type="button" class="hotel-avis-action-btn hotel-avis-action-btn--danger" data-avis-delete>Supprimer</button>
                  </div>`
                      : ""
                  }
                </article>`;
            })
            .join("")}
        </div>`
      : loggedIn && !hasMyAvis
        ? `
        <div class="hotel-avis-empty">
          <strong>Soyez le premier à donner votre avis</strong>
          Partagez votre expérience pour guider les futurs voyageurs.
        </div>`
        : "";

  return `
    <section class="hotel-showcase-block card hotel-avis-section" data-hotel-avis>
      <div class="hotel-avis-head">
        <h3>Avis des clients</h3>
        ${summaryHtml}
      </div>
      ${formHtml}
      ${listHtml}
    </section>`;
}

function bindAvisAddForm(root) {
  const form = root.querySelector("[data-avis-add-form]");
  if (!form) return null;

  const starsRoot = form.querySelector("[data-avis-add-stars]");
  const hintEl = form.querySelector("[data-avis-add-note-hint]");
  const textarea = form.querySelector("#avisAddCommentaire");
  const charCount = form.querySelector("[data-avis-add-char-count]");
  const submitBtn = form.querySelector("[data-avis-add-submit]");
  const starPicker = bindStarPicker(starsRoot, { initialNote: 0, hintEl });

  textarea?.addEventListener("input", () => {
    if (charCount) charCount.textContent = String(textarea.value.length);
  });

  submitBtn?.addEventListener("click", async () => {
    const commentaire = textarea?.value.trim() || "";
    const selectedNote = starPicker.getNote();

    if (!selectedNote) {
      showAvisToast("Choisissez une note entre 1 et 5 étoiles", true);
      return;
    }

    if (commentaire.length < 5) {
      showAvisToast("Le commentaire doit contenir au moins 5 caractères", true);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Publication…";

    try {
      await apiFetch("/avis", {
        method: "POST",
        body: JSON.stringify({
          id_hotel: Number(hotelId),
          note: selectedNote,
          commentaire
        })
      });

      showAvisToast("Merci pour votre avis !");
      await reloadAvisSection(root.closest(".hotel-showcase"));
    } catch (err) {
      showAvisToast(err.message || "Impossible d'enregistrer l'avis", true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publier mon avis";
    }
  });

  return starPicker;
}

function bindAvisSection(root, avisData, myAvis) {
  currentMyAvis = myAvis;
  bindAvisAddForm(root);

  root.addEventListener("click", e => {
    if (e.target.closest("[data-avis-edit]")) {
      openAvisEditModal(currentMyAvis);
      return;
    }

    if (e.target.closest("[data-avis-delete]")) {
      if (currentMyAvis?.id) openAvisDeleteModal(currentMyAvis.id);
    }
  });
}

async function reloadAvisSection(showcaseRoot) {
  const [avisData, myAvis] = await Promise.all([fetchAvisData(hotelId), fetchMyAvis(hotelId)]);
  const oldSection = showcaseRoot?.querySelector("[data-hotel-avis]");
  if (!oldSection || !showcaseRoot) return;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderAvisSection(avisData, myAvis);
  const newSection = wrapper.firstElementChild;
  oldSection.replaceWith(newSection);
  bindAvisSection(newSection, avisData, myAvis);
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

function renderHotelDetail(container, hotel, gallery, pricing, avisData, myAvis) {
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
      <button type="button" class="app-back-btn" onclick="if(window.history.length>1){history.back();}else{window.location.href='Dashboard.html';}">
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
          <div class="hotel-showcase-book-head">
            <h2>${escapeHtml(hotel.nom)}</h2>
            ${FavorisClient.starButtonHtml(hotel.id, FavorisClient.isFavorite(hotel.id), hotel.nom)}
          </div>
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
        ${renderAvisSection(avisData, myAvis)}
      </div>
    </article>
  `;

  bindHotelGallery(container.querySelector("[data-hotel-gallery]"), imageUrls);
  bindAvisSection(container.querySelector("[data-hotel-avis]"), avisData, myAvis);

  document.getElementById("goChambresBtn")?.addEventListener("click", () => {
    window.location.href = buildChambresUrl();
  });

  initHotelLocationMap(hotel);
}

async function loadHotel() {
  initAvisModals();

  const main = document.getElementById("hotelDetailMain");
  if (!hotelId) {
    main.innerHTML = "<p class='hotel-detail-loading'>Hôtel introuvable.</p>";
    return;
  }

  try {
    const [hotelsRes, galleryRes, pricing, avisData, myAvis] = await Promise.all([
      fetch(`${API}/hotels/validated`),
      fetch(`${API}/hotels/${hotelId}/images`),
      fetchChambresPricing(hotelId),
      fetchAvisData(hotelId),
      fetchMyAvis(hotelId)
    ]);

    const hotels = await hotelsRes.json();
    const hotel = hotels.find(h => h.id == hotelId);
    const gallery = await galleryRes.json();

    if (!hotel) {
      main.innerHTML = "<p class='hotel-detail-loading'>Hôtel introuvable ou non validé.</p>";
      return;
    }

    await FavorisClient.loadFavoriteIds();
    renderHotelDetail(main, hotel, gallery, pricing, avisData, myAvis);
    FavorisClient.refreshAllStars();
  } catch (err) {
    console.error(err);
    main.innerHTML = "<p class='hotel-detail-loading'>Erreur de chargement.</p>";
  }
}

loadHotel();
