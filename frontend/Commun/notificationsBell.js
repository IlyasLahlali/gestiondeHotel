(function initNotificationsBell() {
  const API = window.API_BASE || `${window.location.origin}/api`;
  let open = false;
  let items = [];
  let pollTimer = null;

  function getToken() {
    return localStorage.getItem("token");
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

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function iconForType(type) {
    const map = {
      bienvenue_proprietaire: "👋",
      bienvenue_client: "👋",
      bienvenue_admin: "👋",
      hotel_en_attente: "⏳",
      hotel_valide: "✅",
      hotel_refuse: "❌",
      hotel_valide_admin: "✅",
      hotel_refuse_admin: "❌",
      proprietaire_inscrit: "🏢",
      reservation_nouvelle: "📩",
      reservation_en_attente: "⏳",
      reservation_confirmee: "✅",
      reservation_refusee: "❌",
      reservation_annulee: "🚫",
      avis_nouveau: "⭐"
    };
    return map[type] || "🔔";
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    if (!token) return null;

    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(options.headers || {})
      }
    });

    if (res.status === 401 || res.status === 403) return null;
    return res;
  }

  async function fetchUnreadCount() {
    const res = await apiFetch("/notifications/unread-count");
    if (!res?.ok) return 0;
    const data = await res.json();
    return Number(data.count) || 0;
  }

  async function fetchNotifications() {
    const res = await apiFetch("/notifications?limit=25");
    if (!res?.ok) return [];
    return res.json();
  }

  function updateBadge(count) {
    document.querySelectorAll("[data-notif-badge]").forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : String(count);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    });
  }

  function renderList() {
    document.querySelectorAll("[data-notif-list]").forEach(list => {
      if (!items.length) {
        list.innerHTML = '<p class="notif-empty">Aucune notification</p>';
        return;
      }

      list.innerHTML = items
        .map(n => {
          const unread = Number(n.lue) === 0;
          return `
          <button type="button" class="notif-item${unread ? " notif-item--unread" : ""}" data-notif-id="${n.id}" data-notif-lien="${escapeAttr(n.lien || "")}">
            <span class="notif-item-icon" aria-hidden="true">${iconForType(n.type)}</span>
            <span class="notif-item-body">
              <strong>${escapeHtml(n.titre)}</strong>
              <span>${escapeHtml(n.message)}</span>
              <time>${formatDate(n.created_at)}</time>
            </span>
            ${unread ? '<span class="notif-dot" aria-hidden="true"></span>' : ""}
          </button>`;
        })
        .join("");
    });
  }

  async function refresh(silent = false) {
    if (!getToken()) return;

    const [count, list] = await Promise.all([
      fetchUnreadCount(),
      open || !silent ? fetchNotifications() : Promise.resolve(items)
    ]);

    updateBadge(count);
    if (open || !silent) {
      items = list;
      renderList();
    }
  }

  async function markRead(id) {
    await apiFetch(`/notifications/${id}/lire`, { method: "PUT" });
  }

  async function markAllRead() {
    await apiFetch("/notifications/lire-tout", { method: "PUT" });
    await refresh();
  }

  function closeDropdown() {
    open = false;
    document.querySelectorAll(".notif-dropdown").forEach(el => {
      el.hidden = true;
    });
    document.querySelectorAll(".notif-bell-btn").forEach(btn => {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  async function openDropdown() {
    open = true;
    document.querySelectorAll(".notif-dropdown").forEach(el => {
      el.hidden = false;
    });
    document.querySelectorAll(".notif-bell-btn").forEach(btn => {
      btn.setAttribute("aria-expanded", "true");
    });
    items = await fetchNotifications();
    renderList();
    await refresh(true);
  }

  async function toggleDropdown() {
    if (open) closeDropdown();
    else await openDropdown();
  }

  async function onItemClick(btn) {
    const id = btn.dataset.notifId;
    const lien = btn.dataset.notifLien;
    if (id) await markRead(id);
    closeDropdown();
    await refresh(true);
    if (lien) window.location.href = lien;
  }

  function mount(container) {
    if (container.dataset.notifMounted) return;
    if (!getToken()) return;

    container.dataset.notifMounted = "1";
    container.innerHTML = `
      <div class="notif-bell-wrap">
        <button type="button" class="notif-bell-btn" aria-label="Notifications" aria-expanded="false" aria-haspopup="true">
          <svg class="notif-bell-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span class="notif-badge" data-notif-badge hidden>0</span>
        </button>
        <div class="notif-dropdown" hidden>
          <div class="notif-dropdown-head">
            <strong>Notifications</strong>
            <button type="button" class="notif-mark-all">Tout marquer lu</button>
          </div>
          <div class="notif-dropdown-list" data-notif-list></div>
        </div>
      </div>`;

    container.querySelector(".notif-bell-btn")?.addEventListener("click", e => {
      e.stopPropagation();
      toggleDropdown();
    });

    container.querySelector(".notif-mark-all")?.addEventListener("click", e => {
      e.stopPropagation();
      markAllRead();
    });

    container.querySelector("[data-notif-list]")?.addEventListener("click", e => {
      const item = e.target.closest(".notif-item");
      if (!item) return;
      e.stopPropagation();
      onItemClick(item);
    });
  }

  function init() {
    if (!getToken()) return;

    document.querySelectorAll("[data-notifications-bell]").forEach(mount);
    refresh(true);

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => refresh(true), 45000);

    document.addEventListener("click", e => {
      if (!e.target.closest(".notif-bell-wrap")) closeDropdown();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeDropdown();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.NotificationsBell = { refresh, closeDropdown };
})();
