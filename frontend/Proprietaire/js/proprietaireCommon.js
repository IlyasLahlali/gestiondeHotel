(function () {
  const API = window.API_BASE || `${window.location.origin}/api`;
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const ownerHeaders = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };

  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str ?? "";
    return el.innerHTML;
  }

  function escapeAttr(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function goToAddHotel() {
    window.location.href = "hotelAjouter.html";
  }

  function goToReservations() {
    window.location.href = "reservationDetail.html";
  }

  function goToHotelsList() {
    window.location.href = "hotel.html";
  }

  function goBack(fallbackUrl) {
    if (typeof window.ownerGoBack === "function") {
      window.ownerGoBack(fallbackUrl || "Dashboard.html");
      return;
    }
    const fallback = fallbackUrl || "Dashboard.html";
    if (window.history.length > 1) window.history.back();
    else window.location.href = fallback;
  }

  function statutBadge(statut) {
    if (statut === "valide") return { label: "Validé", cls: "badge-valide" };
    if (statut === "refuse") return { label: "Refusé", cls: "badge-refuse" };
    return { label: "En attente", cls: "badge-attente" };
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add("show");
      el.style.display = "flex";
    }
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("show");
      el.style.display = "none";
    }
  }

  function formatTypeLabel(type) {
    const map = {
      economique: "Économique",
      standard: "Standard",
      superieur: "Supérieur",
      deluxe: "Deluxe",
      suite: "Suite",
      familiale: "Familiale",
      luxe: "Luxe"
    };
    return map[type] || type;
  }

  function getSearchFiltersFromUrl(searchParams) {
    const sp = searchParams instanceof URLSearchParams
      ? searchParams
      : new URLSearchParams(searchParams || "");
    return {
      type: sp.get("type") || "",
      capacite: sp.get("capacite") || ""
    };
  }

  function appendSearchFilters(params, filters = {}) {
    if (!params) return params;
    if (filters.type) params.set("type", filters.type);
    if (filters.capacite) params.set("capacite", String(filters.capacite));
    return params;
  }

  function buildHotelDetailUrl(hotelId, filters = {}) {
    const params = new URLSearchParams({ id: String(hotelId) });
    appendSearchFilters(params, filters);
    return `hotelDetail.html?${params.toString()}`;
  }

  function buildChambreDetailUrl(hotelId, filters = {}) {
    const params = new URLSearchParams({ hotelId: String(hotelId) });
    appendSearchFilters(params, filters);
    return `chambreDetail.html?${params.toString()}`;
  }

  async function fetchOwnerHotel(hotelId) {
    if (!hotelId) return null;

    try {
      const res = await fetch(`${API}/hotels/mes-hotels/${hotelId}`, {
        headers: { Authorization: "Bearer " + token }
      });
      if (res.ok) return res.json();
    } catch (_) {
      /* fallback ci-dessous */
    }

    try {
      const listRes = await fetch(`${API}/hotels/mes-hotels`, {
        headers: { Authorization: "Bearer " + token }
      });
      if (!listRes.ok) return null;
      const list = await listRes.json();
      return list.find(h => String(h.id) === String(hotelId)) || null;
    } catch (_) {
      return null;
    }
  }

  window.OwnerCommon = {
    API,
    token,
    ownerHeaders,
    escapeHtml,
    escapeAttr,
    goToAddHotel,
    goToReservations,
    goToHotelsList,
    goBack,
    statutBadge,
    openModal,
    closeModal,
    formatTypeLabel,
    fetchOwnerHotel,
    getSearchFiltersFromUrl,
    appendSearchFilters,
    buildHotelDetailUrl,
    buildChambreDetailUrl
  };
})();
