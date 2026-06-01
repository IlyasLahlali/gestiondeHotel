(function initOwnerHotelsPage() {
  const listEl = document.getElementById("hotelsList");

  if (!window.OwnerCommon) {
    if (listEl) {
      listEl.innerHTML = "<p class='owner-error'>Session expirée. <a href='login.html'>Reconnectez-vous</a>.</p>";
    }
    return;
  }

  const { API, ownerHeaders, escapeHtml, escapeAttr, statutBadge } = OwnerCommon;
  const API_ORIGIN = window.API_ORIGIN || window.location.origin;

  let allHotels = [];
  let currentFilter = "valide";

  const FILTER_LABELS = {
    valide: "validés",
    en_attente: "en attente",
    refuse: "refusés"
  };

  const ROOM_TYPES = [
    "economique",
    "standard",
    "superieur",
    "deluxe",
    "suite",
    "familiale"
  ];

  function scrollToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (nom) params.set("nom", nom);
    if (type) params.set("type", type);
    if (capacite) params.set("capacite", capacite);

    window.location.href = params.toString()
      ? `rechercheResultat.html?${params}`
      : "rechercheResultat.html";
  }

  async function loadHotelsSelect() {
    const select = document.getElementById("searchNom");
    if (!select) return;

    try {
      const res = await fetch(`${API}/hotels/mes-hotels`, {
        headers: { Authorization: ownerHeaders.Authorization }
      });
      if (!res.ok) return;

      const hotels = await res.json();
      select.innerHTML = `<option value="">Tous les hôtels</option>`;
      hotels.forEach(h => {
        select.innerHTML += `<option value="${escapeAttr(h.nom)}">${escapeHtml(h.nom)}</option>`;
      });
    } catch (err) {
      console.error(err);
    }
  }

  function loadTypesChambres() {
    const select = document.getElementById("searchType");
    if (!select) return;

    select.innerHTML = `<option value="">Tous les types</option>`;
    ROOM_TYPES.forEach(type => {
      select.innerHTML += `<option value="${escapeAttr(type)}">${escapeHtml(OwnerCommon.formatTypeLabel(type))}</option>`;
    });
  }

  function scrollToFooterContact() {
    document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setWelcome() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const el = document.getElementById("welcomeText");
    if (el && user.prenom) {
      el.textContent = `Bonjour ${user.prenom} — Vos hôtels`;
    }
  }

  function setFilter(btn, statut) {
    currentFilter = statut;
    document.querySelectorAll(".admin-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderHotels();
  }

  function goToHotelDetail(id) {
    window.location.href = `hotelDetail.html?id=${id}`;
  }

  function goToHotelChambres(id) {
    window.location.href = `chambreDetail.html?hotelId=${id}`;
  }

  function toRatingNumber(value) {
    if (value == null || value === "") return null;
    const raw = typeof value === "object" && typeof value.toString === "function"
      ? value.toString()
      : value;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeHotel(h) {
    return {
      ...h,
      nb_avis: Number(h.nb_avis ?? 0),
      note_moyenne: toRatingNumber(h.note_moyenne)
    };
  }

  function renderHotelCardStars(noteMoyenne) {
    const note = toRatingNumber(noteMoyenne);
    if (note == null || note <= 0) return "";

    const filled = Math.max(1, Math.min(5, Math.round(note)));
    const stars = Array.from({ length: 5 }, (_, index) => {
      const isFilled = index < filled;
      return `<span class="owner-hotel-card__star${isFilled ? " is-filled" : ""}" aria-hidden="true">${isFilled ? "★" : "☆"}</span>`;
    }).join("");

    return `<div class="owner-hotel-card__rating owner-hotel-card__rating--overlay" role="img" aria-label="Note moyenne ${note} sur 5">${stars}</div>`;
  }

  function renderHotelCard(h) {
    const { label, cls } = statutBadge(h.statut);
    const cover = h.image_principale
      ? `${API_ORIGIN}${h.image_principale}`
      : "../../images/hero.jpg";
    const nbChambres = Number(h.nb_chambres) || 0;
    const chambreLabel = nbChambres === 1 ? "1 chambre" : `${nbChambres} chambres`;
    const adresse = h.adresse?.trim() || "Adresse non renseignée";

    return `
      <article class="owner-hotel-card">
        <div
          class="owner-hotel-card__media owner-hotel-card__media--clickable"
          role="link"
          tabindex="0"
          aria-label="Voir détails de ${escapeAttr(h.nom)}"
          onclick="goToHotelDetail(${h.id})"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();goToHotelDetail(${h.id})}"
        >
          <img src="${escapeAttr(cover)}" alt="${escapeAttr(h.nom)}" loading="lazy">
          <span class="admin-badge ${cls} owner-hotel-card__badge">${label}</span>
          ${renderHotelCardStars(h.note_moyenne)}
        </div>
        <div class="owner-hotel-card__body">
          <h3 class="owner-hotel-card__title">${escapeHtml(h.nom)}</h3>
          <p class="owner-hotel-card__ville">📍 ${escapeHtml(h.ville)}</p>
          <p class="owner-hotel-card__adresse">${escapeHtml(adresse)}</p>
          <div class="owner-hotel-card__stats">
            <span class="owner-hotel-card__stat">🛏 ${chambreLabel}</span>
          </div>
          <div class="owner-hotel-card__actions">
            <button type="button" class="owner-hotel-card__btn owner-hotel-card__btn--primary" onclick="goToHotelDetail(${h.id})">Voir détails</button>
            <button type="button" class="owner-hotel-card__btn owner-hotel-card__btn--soft" onclick="goToHotelChambres(${h.id})">Gérer les chambres</button>
          </div>
        </div>
      </article>`;
  }

  function renderEmptyState(label) {
    return `
      <div class="admin-empty owner-hotels-empty">
        <span class="admin-empty-icon" aria-hidden="true">🏨</span>
        <p>Aucun hôtel ${label} pour le moment.</p>
      </div>`;
  }

  function renderHotels() {
    const list = document.getElementById("hotelsList");
    const count = document.getElementById("hotelsCount");
    if (!list) return;

    const hotels = allHotels.filter(h => h.statut === currentFilter);
    const label = FILTER_LABELS[currentFilter] || "";

    if (count) {
      count.textContent = hotels.length
        ? `${hotels.length} hôtel${hotels.length > 1 ? "s" : ""} ${label}`
        : `Aucun hôtel ${label}`;
      count.classList.toggle("is-empty", !hotels.length);
    }

    if (!hotels.length) {
      list.innerHTML = renderEmptyState(label);
      return;
    }

    list.innerHTML = hotels.map(renderHotelCard).join("");
  }

  async function loadHotels() {
    const list = document.getElementById("hotelsList");
    if (list) list.innerHTML = "<p class='owner-loading'>Chargement…</p>";

    try {
      const res = await fetch(`${API}/hotels/mes-hotels`, {
        headers: { Authorization: ownerHeaders.Authorization }
      });

      if (res.status === 401 || res.status === 403) {
        if (list) {
          list.innerHTML = "<p class='owner-error'>Session expirée. <a href='login.html'>Reconnectez-vous</a>.</p>";
        }
        return;
      }

      if (!res.ok) {
        if (list) list.innerHTML = "<p class='owner-error'>Erreur de chargement des hôtels.</p>";
        return;
      }

      const hotels = await res.json();
      if (!Array.isArray(hotels)) {
        if (list) list.innerHTML = "<p class='owner-error'>Réponse serveur invalide.</p>";
        return;
      }

      allHotels = hotels.map(normalizeHotel);
      renderHotels();
    } catch (err) {
      console.error(err);
      if (list) {
        list.innerHTML = "<p class='owner-error'>Serveur inaccessible. Lancez le backend : <code>cd backend && node server.js</code></p>";
      }
    }
  }

  window.setFilter = setFilter;
  window.goToHotelDetail = goToHotelDetail;
  window.goToHotelChambres = goToHotelChambres;
  window.rechercherHotel = rechercherHotel;
  window.scrollToFooterContact = scrollToFooterContact;

  setWelcome();
  loadHotelsSelect();
  loadTypesChambres();
  loadHotels();

  if (window.location.hash) {
    const targetId = window.location.hash.slice(1);
    window.setTimeout(() => scrollToSection(targetId), 120);
  }
})();
