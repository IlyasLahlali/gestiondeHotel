const API_URL = window.API_BASE || `${window.location.origin}/api`;

async function getData(endpoint) {
  const res = await fetch(`${API_URL}${endpoint}`);
  return await res.json();
}

async function postData(endpoint, data, token = null) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: "Bearer " + token })
    },
    body: JSON.stringify(data)
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function requireAuth(role) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token) {
    const loginPath =
      window.APP_PATHS?.login?.[role] ||
      `../../${role.charAt(0).toUpperCase() + role.slice(1)}/html/login.html`;
    window.location.href = loginPath;
    return null;
  }

  if (role && user?.role !== role) {
    alert("Accès non autorisé pour ce compte.");
    window.location.href = window.APP_PATHS?.publicHome || "../../Public/html/index.html";
    return null;
  }

  return token;
}

function logoutToHome() {
  localStorage.clear();
  window.location.href = window.APP_PATHS?.publicHome || "../../Public/html/index.html";
}

window.getData = getData;
window.postData = postData;
window.requireAuth = requireAuth;
window.logoutToHome = logoutToHome;
