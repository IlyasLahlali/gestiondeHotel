const AUTH_API = window.API_BASE || `${window.location.origin}/api`;

function setAuthMessage(el, message, isError = false) {
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("auth-message-error", Boolean(isError));
  el.classList.toggle("auth-message-success", Boolean(message && !isError));
}

function saveAuthSession(data) {
  if (!data || !data.token || !data.user) return;
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  localStorage.setItem("role", data.user.role);
}

async function parseAuthResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function authPost(endpoint, body) {
  const res = await fetch(`${AUTH_API}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await parseAuthResponse(res);
  return { res, data };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function bindLoginForm({ formId, endpoint, messageId, redirectUrl }) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = normalizeEmail(document.getElementById("loginEmail")?.value);
    const mot_de_passe = document.getElementById("loginPassword")?.value;
    const messageEl = document.getElementById(messageId);

    if (!email || !mot_de_passe) {
      setAuthMessage(messageEl, "Email et mot de passe requis.", true);
      return;
    }

    try {
      const { res, data } = await authPost(endpoint, { email, mot_de_passe });

      if (!res.ok) {
        let msg = data.message || "Connexion impossible.";
        if (msg === "Utilisateur introuvable") {
          msg =
            "Aucun compte avec cet email. Vérifiez l'email ou créez un compte.";
        }
        setAuthMessage(messageEl, msg, true);
        return;
      }

      saveAuthSession(data);
      const target =
        typeof redirectUrl === "function" ? redirectUrl() : redirectUrl;
      window.location.href = target;
    } catch (err) {
      console.error(err);
      setAuthMessage(messageEl, "Erreur serveur.", true);
    }
  });
}

function bindRegisterForm({
  formId,
  endpoint,
  messageId,
  redirectUrl,
  passwordFieldId = "mot_de_passe"
}) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nom = document.getElementById("nom")?.value.trim();
    const prenom = document.getElementById("prenom")?.value.trim();
    const email = normalizeEmail(document.getElementById("email")?.value);
    const mot_de_passe = document.getElementById(passwordFieldId)?.value;
    const messageEl = document.getElementById(messageId);

    if (!nom || !prenom || !email || !mot_de_passe) {
      setAuthMessage(messageEl, "Tous les champs sont obligatoires.", true);
      return;
    }

    try {
      const { res, data } = await authPost(endpoint, {
        nom,
        prenom,
        email,
        mot_de_passe
      });

      setAuthMessage(messageEl, data.message || "Inscription terminée.", !res.ok);

      if (res.ok) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1000);
      }
    } catch (err) {
      console.error(err);
      setAuthMessage(messageEl, "Erreur serveur.", true);
    }
  });
}

function resolveAuthReturnUrl(fallback) {
  const ret = new URLSearchParams(window.location.search).get("return");
  if (ret && ret.startsWith("/") && !ret.startsWith("//")) {
    return ret;
  }
  return fallback;
}

window.setAuthMessage = setAuthMessage;
window.saveAuthSession = saveAuthSession;
window.bindLoginForm = bindLoginForm;
window.bindRegisterForm = bindRegisterForm;
window.resolveAuthReturnUrl = resolveAuthReturnUrl;
