(function initOwnerBack() {
  function goBack(fallbackUrl) {
    const fallback = fallbackUrl || "Dashboard.html";
    if (window.history.length > 1) {
      history.back();
    } else {
      window.location.href = fallback;
    }
  }

  function bindBackButtons() {
    document.querySelectorAll("[data-owner-back]").forEach(btn => {
      if (btn.dataset.ownerBackBound) return;
      btn.dataset.ownerBackBound = "1";
      btn.addEventListener("click", () => {
        goBack(btn.dataset.ownerBackFallback || "Dashboard.html");
      });
    });
  }

  window.ownerGoBack = goBack;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindBackButtons);
  } else {
    bindBackButtons();
  }
})();
