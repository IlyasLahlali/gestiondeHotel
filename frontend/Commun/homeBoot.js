(function () {
  try {
    var scrollKey = "homeScrollY";
    var y = parseInt(sessionStorage.getItem(scrollKey) || "0", 10) || 0;
    var isReload = true;

    if (performance.getEntriesByType) {
      var nav = performance.getEntriesByType("navigation")[0];
      if (nav) {
        isReload = nav.type === "reload" || nav.type === "back_forward";
      }
    } else if (performance.navigation) {
      isReload = performance.navigation.type === 1;
    }

    if (y > 0 || isReload) {
      history.scrollRestoration = "manual";
      if (y > 0) window.scrollTo(0, y);
    }

    if (!isReload && y <= 80) {
      document.documentElement.classList.add("hf-scroll-intro");
    }
  } catch (e) {
    /* ignore */
  }
})();
