(function initRuntimeConfig() {
  if (typeof window === "undefined") return;

  const origin = window.location.origin;
  window.API_ORIGIN = origin;
  window.API_BASE = `${origin}/api`;
})();
