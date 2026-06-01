(function initProfileMenu() {
  const API = window.API_BASE || `${window.location.origin}/api`;
  const ROLE_LABELS = {
    client: "Client",
    proprietaire: "Propriétaire",
    admin: "Administrateur"
  };

  let profileUser = null;
  let dropdownOpen = false;

  function getToken() {
    return localStorage.getItem("token");
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }

  function saveUser(user) {
    localStorage.setItem("user", JSON.stringify(user));
  }

  function getInitials(user) {
    const p = (user?.prenom || "?").charAt(0).toUpperCase();
    const n = (user?.nom || "?").charAt(0).toUpperCase();
    return `${p}${n}`;
  }

  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str ?? "";
    return el.innerHTML;
  }

  function showMessage(el, text, isError = false) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "profile-form-message" + (isError ? " profile-form-message--error" : " profile-form-message--success");
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = false;
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.hidden = true;
  }

  function closeDropdown() {
    dropdownOpen = false;
    const dropdown = document.querySelector(".profile-dropdown");
    const btn = document.querySelector(".profile-avatar-btn");
    if (dropdown) dropdown.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function toggleDropdown() {
    dropdownOpen = !dropdownOpen;
    const dropdown = document.querySelector(".profile-dropdown");
    const btn = document.querySelector(".profile-avatar-btn");
    if (dropdown) dropdown.hidden = !dropdownOpen;
    if (btn) btn.setAttribute("aria-expanded", dropdownOpen ? "true" : "false");
  }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: "Bearer " + token }),
        ...(options.headers || {})
      }
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    return { res, data };
  }

  async function loadProfile() {
    const { res, data } = await apiFetch("/profil");
    if (!res.ok) throw new Error(data.message || "Impossible de charger le profil.");
    profileUser = data.user;
    saveUser(profileUser);
    updateUI();
    return profileUser;
  }

  function updateUI() {
    const user = profileUser || getStoredUser();
    if (!user) return;

    const initialsEl = document.querySelector(".profile-avatar-initials");
    const nameEl = document.querySelector(".profile-dropdown-name");
    const emailEl = document.querySelector(".profile-dropdown-email");
    const roleEl = document.querySelector(".profile-dropdown-role");

    if (initialsEl) initialsEl.textContent = getInitials(user);
    if (nameEl) nameEl.textContent = `${user.prenom || ""} ${user.nom || ""}`.trim();
    if (emailEl) emailEl.textContent = user.email || "";
    if (roleEl) roleEl.textContent = ROLE_LABELS[user.role] || user.role || "";
  }

  function fillProfileForm() {
    const user = profileUser || getStoredUser();
    if (!user) return;

    const nom = document.getElementById("profileNom");
    const prenom = document.getElementById("profilePrenom");
    const email = document.getElementById("profileEmail");
    const role = document.getElementById("profileRoleDisplay");
    const googleNote = document.getElementById("profileGoogleNote");

    if (nom) nom.value = user.nom || "";
    if (prenom) prenom.value = user.prenom || "";
    if (email) email.value = user.email || "";
    if (role) role.textContent = ROLE_LABELS[user.role] || user.role || "";

    if (googleNote) {
      googleNote.hidden = !user.isGoogle;
    }

    const currentPwdField = document.getElementById("profileCurrentPasswordWrap");
    const currentPwd = document.getElementById("profileCurrentPassword");
    if (currentPwdField && currentPwd) {
      if (user.hasPassword) {
        currentPwdField.hidden = false;
        currentPwd.required = true;
      } else {
        currentPwdField.hidden = true;
        currentPwd.required = false;
        currentPwd.value = "";
      }
    }

    const deletePwdWrap = document.getElementById("profileDeletePasswordWrap");
    const deletePwd = document.getElementById("profileDeletePassword");
    if (deletePwdWrap && deletePwd) {
      deletePwdWrap.hidden = !user.hasPassword;
      deletePwd.required = user.hasPassword;
      if (!user.hasPassword) deletePwd.value = "";
    }
  }

  function logout() {
    localStorage.clear();
    window.location.href =
      window.APP_PATHS?.publicHome || "../../Public/html/index.html";
  }

  async function saveProfile(e) {
    e.preventDefault();
    const msgEl = document.getElementById("profileFormMessage");

    const body = {
      nom: document.getElementById("profileNom")?.value.trim(),
      prenom: document.getElementById("profilePrenom")?.value.trim(),
      email: document.getElementById("profileEmail")?.value.trim()
    };

    try {
      const { res, data } = await apiFetch("/profil", {
        method: "PUT",
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        showMessage(msgEl, data.message || "Erreur.", true);
        return;
      }

      profileUser = data.user;
      saveUser(profileUser);
      updateUI();
      showMessage(msgEl, data.message || "Profil enregistré.");
    } catch (err) {
      console.error(err);
      showMessage(msgEl, "Erreur serveur.", true);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    const msgEl = document.getElementById("profilePasswordMessage");

    const body = {
      mot_de_passe_actuel: document.getElementById("profileCurrentPassword")?.value,
      mot_de_passe_nouveau: document.getElementById("profileNewPassword")?.value
    };

    const confirm = document.getElementById("profileConfirmPassword")?.value;
    if (body.mot_de_passe_nouveau !== confirm) {
      showMessage(msgEl, "Les mots de passe ne correspondent pas.", true);
      return;
    }

    try {
      const { res, data } = await apiFetch("/profil/password", {
        method: "PUT",
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        showMessage(msgEl, data.message || "Erreur.", true);
        return;
      }

      showMessage(msgEl, data.message || "Mot de passe modifié.");
      document.getElementById("profilePasswordForm")?.reset();
      await loadProfile();
      fillProfileForm();
    } catch (err) {
      console.error(err);
      showMessage(msgEl, "Erreur serveur.", true);
    }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    const msgEl = document.getElementById("profileDeleteMessage");

    const body = {
      confirmation: document.getElementById("profileDeleteConfirm")?.value.trim(),
      mot_de_passe: document.getElementById("profileDeletePassword")?.value
    };

    try {
      const { res, data } = await apiFetch("/profil", {
        method: "DELETE",
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        showMessage(msgEl, data.message || "Erreur.", true);
        return;
      }

      alert(data.message || "Compte supprimé.");
      logout();
    } catch (err) {
      console.error(err);
      showMessage(msgEl, "Erreur serveur.", true);
    }
  }

  function buildModals() {
    if (document.getElementById("profileModalOverlay")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="profileModalOverlay" class="profile-modal-overlay" hidden>
        <div class="profile-modal" role="dialog" aria-labelledby="profileModalTitle">
          <div class="profile-modal-header">
            <h2 id="profileModalTitle">Mon profil</h2>
            <button type="button" class="profile-modal-close" data-close="profileModalOverlay" aria-label="Fermer">×</button>
          </div>
          <div class="profile-modal-tabs">
            <button type="button" class="profile-tab active" data-tab="info">Informations</button>
            <button type="button" class="profile-tab" data-tab="password">Mot de passe</button>
            <button type="button" class="profile-tab profile-tab--danger" data-tab="delete">Supprimer</button>
          </div>
          <div class="profile-modal-body">
            <section class="profile-tab-panel active" data-panel="info">
              <p class="profile-role-badge">Rôle : <span id="profileRoleDisplay"></span></p>
              <p id="profileGoogleNote" class="profile-google-note" hidden>
                Ce compte est lié à Google. Vous pouvez aussi définir un mot de passe ci-dessous.
              </p>
              <form id="profileInfoForm" class="profile-form">
                <div class="profile-form-row">
                  <div class="auth-field">
                    <label for="profilePrenom">Prénom</label>
                    <input type="text" id="profilePrenom" required autocomplete="given-name">
                  </div>
                  <div class="auth-field">
                    <label for="profileNom">Nom</label>
                    <input type="text" id="profileNom" required autocomplete="family-name">
                  </div>
                </div>
                <div class="auth-field">
                  <label for="profileEmail">Email</label>
                  <input type="email" id="profileEmail" required autocomplete="email">
                </div>
                <p id="profileFormMessage" class="profile-form-message"></p>
                <button type="submit" class="btn-primary">Enregistrer</button>
              </form>
            </section>
            <section class="profile-tab-panel" data-panel="password" hidden>
              <form id="profilePasswordForm" class="profile-form">
                <div id="profileCurrentPasswordWrap" class="auth-field">
                  <label for="profileCurrentPassword">Mot de passe actuel</label>
                  <input type="password" id="profileCurrentPassword" autocomplete="current-password">
                </div>
                <div class="auth-field">
                  <label for="profileNewPassword">Nouveau mot de passe</label>
                  <input type="password" id="profileNewPassword" required minlength="6" autocomplete="new-password">
                </div>
                <div class="auth-field">
                  <label for="profileConfirmPassword">Confirmer le mot de passe</label>
                  <input type="password" id="profileConfirmPassword" required minlength="6" autocomplete="new-password">
                </div>
                <p id="profilePasswordMessage" class="profile-form-message"></p>
                <button type="submit" class="btn-primary">Modifier le mot de passe</button>
              </form>
            </section>
            <section class="profile-tab-panel" data-panel="delete" hidden>
              <div class="profile-delete-warning">
                <p><strong>Attention :</strong> cette action est définitive.</p>
                <ul>
                  <li>Toutes vos données de compte seront supprimées.</li>
                  <li>Vous devrez créer un nouveau compte pour revenir.</li>
                </ul>
              </div>
              <form id="profileDeleteForm" class="profile-form">
                <div class="auth-field">
                  <label for="profileDeleteConfirm">Tapez SUPPRIMER pour confirmer</label>
                  <input type="text" id="profileDeleteConfirm" required placeholder="SUPPRIMER" autocomplete="off">
                </div>
                <div id="profileDeletePasswordWrap" class="auth-field">
                  <label for="profileDeletePassword">Mot de passe</label>
                  <input type="password" id="profileDeletePassword" autocomplete="current-password">
                </div>
                <p id="profileDeleteMessage" class="profile-form-message"></p>
                <button type="submit" class="btn-danger">Supprimer mon compte</button>
              </form>
            </section>
          </div>
        </div>
      </div>
    `
    );

    document.getElementById("profileInfoForm")?.addEventListener("submit", saveProfile);
    document.getElementById("profilePasswordForm")?.addEventListener("submit", savePassword);
    document.getElementById("profileDeleteForm")?.addEventListener("submit", deleteAccount);

    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });

    document.getElementById("profileModalOverlay")?.addEventListener("click", e => {
      if (e.target.id === "profileModalOverlay") closeModal("profileModalOverlay");
    });

    document.querySelectorAll(".profile-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const name = tab.dataset.tab;
        document.querySelectorAll(".profile-tab").forEach(t => t.classList.toggle("active", t === tab));
        document.querySelectorAll(".profile-tab-panel").forEach(panel => {
          const active = panel.dataset.panel === name;
          panel.classList.toggle("active", active);
          panel.hidden = !active;
        });
      });
    });
  }

  function getClientFavorisUrl() {
    const path = window.location.pathname.replace(/\\/g, "/");
    if (path.includes("/Client/html/")) {
      return "favoris.html";
    }
    return "../../Client/html/favoris.html";
  }

  function mountMenu(container) {
    const user = getStoredUser();
    const initials = getInitials(user);

    container.innerHTML = `
      <div class="profile-menu">
        <button type="button" class="profile-avatar-btn" aria-label="Mon compte" aria-expanded="false" aria-haspopup="true">
          <span class="profile-avatar-initials">${escapeHtml(initials)}</span>
        </button>
        <div class="profile-dropdown" hidden>
          <div class="profile-dropdown-header">
            <span class="profile-dropdown-name">${escapeHtml(`${user?.prenom || ""} ${user?.nom || ""}`.trim() || "Mon compte")}</span>
            <span class="profile-dropdown-email">${escapeHtml(user?.email || "")}</span>
            <span class="profile-dropdown-role">${escapeHtml(ROLE_LABELS[user?.role] || user?.role || "")}</span>
          </div>
          <button type="button" class="profile-dropdown-item" data-action="profile">
            <span aria-hidden="true">👤</span> Mon profil
          </button>
          ${
            user?.role === "client"
              ? `<button type="button" class="profile-dropdown-item profile-dropdown-item--favoris" data-action="favoris">
            <span class="profile-favori-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </span>
            Mes favoris
          </button>`
              : ""
          }
          <button type="button" class="profile-dropdown-item" data-action="password">
            <span aria-hidden="true">🔒</span> Mot de passe
          </button>
          <button type="button" class="profile-dropdown-item profile-dropdown-item--logout" data-action="logout">
            <span aria-hidden="true">⎋</span> Déconnexion
          </button>
          <button type="button" class="profile-dropdown-item profile-dropdown-item--danger" data-action="delete">
            <span aria-hidden="true">🗑</span> Supprimer mon compte
          </button>
        </div>
      </div>
    `;

    container.querySelector(".profile-avatar-btn")?.addEventListener("click", e => {
      e.stopPropagation();
      toggleDropdown();
    });

    container.querySelectorAll(".profile-dropdown-item").forEach(item => {
      item.addEventListener("click", async () => {
        closeDropdown();
        const action = item.dataset.action;

        if (action === "logout") {
          logout();
          return;
        }

        if (action === "favoris") {
          window.location.href = getClientFavorisUrl();
          return;
        }

        try {
          await loadProfile();
          fillProfileForm();
        } catch (err) {
          console.error(err);
        }

        if (action === "profile") {
          document.querySelectorAll(".profile-tab").forEach(t =>
            t.classList.toggle("active", t.dataset.tab === "info")
          );
          document.querySelectorAll(".profile-tab-panel").forEach(p => {
            const active = p.dataset.panel === "info";
            p.classList.toggle("active", active);
            p.hidden = !active;
          });
          openModal("profileModalOverlay");
        }

        if (action === "password") {
          document.querySelectorAll(".profile-tab").forEach(t =>
            t.classList.toggle("active", t.dataset.tab === "password")
          );
          document.querySelectorAll(".profile-tab-panel").forEach(p => {
            const active = p.dataset.panel === "password";
            p.classList.toggle("active", active);
            p.hidden = !active;
          });
          openModal("profileModalOverlay");
        }

        if (action === "delete") {
          document.querySelectorAll(".profile-tab").forEach(t =>
            t.classList.toggle("active", t.dataset.tab === "delete")
          );
          document.querySelectorAll(".profile-tab-panel").forEach(p => {
            const active = p.dataset.panel === "delete";
            p.classList.toggle("active", active);
            p.hidden = !active;
          });
          openModal("profileModalOverlay");
        }
      });
    });
  }

  function init() {
    if (!getToken()) return;

    buildModals();

    document.querySelectorAll("[data-profile-menu]").forEach(mountMenu);

    document.addEventListener("click", e => {
      if (!e.target.closest(".profile-menu")) closeDropdown();
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeDropdown();
        closeModal("profileModalOverlay");
      }
    });

    loadProfile().catch(() => updateUI());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
