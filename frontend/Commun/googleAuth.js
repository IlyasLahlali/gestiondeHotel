(function initGoogleAuth() {
  const role = document.body?.dataset?.authRole;
  if (!role || role === "admin") return;

  const btnWrap = document.getElementById("googleSignInBtn");
  if (!btnWrap) return;

  const redirectMap = {
    client: "Dashboard.html",
    proprietaire: "Dashboard.html"
  };

  async function handleCredential(response) {
    const messageEl =
      document.getElementById("loginMessage") ||
      document.getElementById("message");

    try {
      const res = await fetch(`${window.API_BASE || window.location.origin + "/api"}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: response.credential,
          role
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }

      if (!res.ok) {
        window.setAuthMessage?.(messageEl, data.message || "Connexion Google échouée.", true);
        return;
      }

      window.saveAuthSession?.(data);
      window.location.href = redirectMap[role] || "Dashboard.html";
    } catch (err) {
      console.error(err);
      window.setAuthMessage?.(messageEl, "Erreur serveur.", true);
    }
  }

  function renderButton(clientId) {
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential
    });

    window.google.accounts.id.renderButton(btnWrap, {
      theme: "outline",
      size: "large",
      width: 320,
      text: "continue_with",
      locale: "fr"
    });
  }

  async function bootstrap() {
    let clientId = window.GOOGLE_CLIENT_ID || "";

    if (!clientId) {
      try {
        const res = await fetch(`${window.API_BASE || window.location.origin + "/api"}/config`);
        const cfg = await res.json();
        clientId = cfg.googleClientId || "";
      } catch {
        /* ignore */
      }
    }

    if (!clientId) {
      btnWrap.innerHTML =
        '<p class="auth-message">Connexion Google non configurée.</p>';
      return;
    }

    if (window.google?.accounts?.id) {
      renderButton(clientId);
      return;
    }

    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        renderButton(clientId);
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
