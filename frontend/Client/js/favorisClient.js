(function initFavorisClient() {
  const API = window.API_BASE || `${window.location.origin}/api`;
  let favoriteIds = null;
  let loadingPromise = null;
  let starsListenerBound = false;
  let toastTimer = null;

  function getToken() {
    return localStorage.getItem("token");
  }

  function ensureToastContainer() {
    let el = document.getElementById("favoriToastHost");
    if (!el) {
      el = document.createElement("div");
      el.id = "favoriToastHost";
      el.className = "favori-toast-host";
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
      document.body.appendChild(el);
    }
    return el;
  }

  function showToast(type, hotelName) {
    const host = ensureToastContainer();
    const isAdd = type === "add";
    const isError = type === "error";
    const safeName = hotelName ? String(hotelName).trim() : "Cet hôtel";

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }

    const title = isError
      ? safeName
      : isAdd
        ? "Ajouté aux favoris"
        : "Retiré des favoris";
    const subtitle = isError ? "" : safeName;
    const toastClass = isError ? "error" : isAdd ? "add" : "remove";

    host.innerHTML = `
      <div class="favori-toast favori-toast--${toastClass}" role="status">
        <span class="favori-toast-icon" aria-hidden="true">
          ${
            isError
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
          }
        </span>
        <div class="favori-toast-text">
          <strong>${escapeHtml(title)}</strong>
          ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
        </div>
      </div>`;

    toastTimer = setTimeout(() => {
      host.innerHTML = "";
      toastTimer = null;
    }, 3200);
  }

  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str ?? "";
    return el.innerHTML;
  }

  function escapeAttr(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
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

    return res;
  }

  async function loadFavoriteIds(force = false) {
    if (!getToken()) {
      favoriteIds = new Set();
      return favoriteIds;
    }

    if (favoriteIds && !force) {
      return favoriteIds;
    }

    if (loadingPromise && !force) {
      await loadingPromise;
      return favoriteIds;
    }

    loadingPromise = (async () => {
      try {
        const res = await apiFetch("/favoris/ids");
        if (!res.ok) throw new Error("load ids");
        const data = await res.json();
        favoriteIds = new Set((data.ids || []).map(Number));
      } catch {
        favoriteIds = new Set();
      } finally {
        loadingPromise = null;
      }
    })();

    await loadingPromise;
    return favoriteIds;
  }

  function isFavorite(hotelId) {
    return favoriteIds ? favoriteIds.has(Number(hotelId)) : false;
  }

  function starIconSvg(active) {
    if (active) {
      return `<svg class="favori-star-icon favori-star-icon--filled" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    return `<svg class="favori-star-icon favori-star-icon--outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }

  function starButtonHtml(hotelId, active, hotelName = "") {
    const label = active ? "Retirer des favoris" : "Ajouter aux favoris";
    const nameAttr = hotelName ? ` data-favori-nom="${escapeAttr(hotelName)}"` : "";
    return `<button type="button" class="favori-star-btn${active ? " is-active" : ""}" data-favori-hotel="${hotelId}"${nameAttr} aria-label="${label}" aria-pressed="${active ? "true" : "false"}" title="${label}">${starIconSvg(active)}</button>`;
  }

  function setStarState(btn, active) {
    if (!btn) return;
    btn.classList.remove("is-active");
    if (active) btn.classList.add("is-active");
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.setAttribute("aria-label", active ? "Retirer des favoris" : "Ajouter aux favoris");
    btn.setAttribute("title", active ? "Retirer des favoris" : "Ajouter aux favoris");
    btn.innerHTML = starIconSvg(active);
    btn.hidden = false;
    btn.style.display = "";
    btn.style.visibility = "visible";
  }

  function syncStarsForHotel(hotelId, active) {
    document.querySelectorAll(`[data-favori-hotel="${hotelId}"]`).forEach(btn => {
      setStarState(btn, active);
    });
  }

  function refreshAllStars() {
    document.querySelectorAll("[data-favori-hotel]").forEach(btn => {
      setStarState(btn, isFavorite(btn.dataset.favoriHotel));
    });
  }

  async function toggleFavorite(hotelId, btn) {
    const id = Number(hotelId);
    if (!id || !btn) return;

    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }

    if (favoriteIds === null) {
      await loadFavoriteIds();
    }

    const wasFavorite = isFavorite(id);
    const hotelName = btn.dataset.favoriNom || "";

    btn.disabled = true;
    setStarState(btn, !wasFavorite);

    try {
      const res = await apiFetch(`/favoris/${id}`, {
        method: wasFavorite ? "DELETE" : "POST"
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Erreur serveur");
      }

      if (!favoriteIds) favoriteIds = new Set();
      if (wasFavorite) favoriteIds.delete(id);
      else favoriteIds.add(id);

      const nowFavorite = !wasFavorite;
      syncStarsForHotel(id, nowFavorite);
      showToast(nowFavorite ? "add" : "remove", hotelName);

      document.dispatchEvent(
        new CustomEvent("favoris:changed", {
          detail: { hotelId: id, isFavorite: nowFavorite, hotelName }
        })
      );
    } catch (err) {
      syncStarsForHotel(id, wasFavorite);
      if (err.message !== "Auth" && err.message !== "Non connecté") {
        showToast(
          "error",
          wasFavorite ? "Impossible de retirer des favoris" : "Impossible d'ajouter aux favoris"
        );
      }
    } finally {
      btn.disabled = false;
    }
  }

  function bindFavoriteStars() {
    if (starsListenerBound) return;
    starsListenerBound = true;

    document.addEventListener(
      "click",
      e => {
        const btn = e.target.closest(".favori-star-btn[data-favori-hotel]");
        if (!btn || btn.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(btn.dataset.favoriHotel, btn);
      },
      true
    );
  }

  window.FavorisClient = {
    loadFavoriteIds,
    isFavorite,
    starButtonHtml,
    setStarState,
    syncStarsForHotel,
    refreshAllStars,
    toggleFavorite,
    bindFavoriteStars,
    showToast,
    invalidate() {
      favoriteIds = null;
    }
  };

  bindFavoriteStars();
})();
