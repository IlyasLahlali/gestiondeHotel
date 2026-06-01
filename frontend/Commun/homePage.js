(function () {
  const SCROLL_KEY = "homeScrollY";
  let restoringScroll = true;

  function saveScrollPosition() {
    try {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    } catch {
      /* ignore */
    }
  }

  function finishScrollRestore() {
    window.setTimeout(() => {
      restoringScroll = false;
      updateHintPlacement();
    }, 120);
  }

  function updateHintPlacement() {
    if (!document.documentElement.classList.contains("hf-scroll-intro")) return;
    document.documentElement.classList.toggle(
      "hf-scroll-hint-fixed",
      window.scrollY >= 100
    );
  }

  function initQuickVilles() {
    document.querySelectorAll(".hero-quick-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const ville = chip.dataset.ville;
        if (!ville) return;

        const select = document.getElementById("ville");
        if (select) select.value = ville;

        document.querySelectorAll(".hero-quick-chip").forEach((c) => {
          c.classList.toggle("is-active", c === chip);
        });

        select?.focus({ preventScroll: true });
      });
    });
  }

  function initScrollHint() {
    const hint = document.getElementById("heroScrollHint");
    if (!hint || !document.documentElement.classList.contains("hf-scroll-intro")) return;

    let dismissed = false;
    const cleanups = [];

    function dismiss() {
      if (dismissed || restoringScroll) return;
      dismissed = true;
      document.documentElement.classList.remove("hf-scroll-intro", "hf-scroll-hint-fixed");
      hint.classList.add("is-hidden");
      hint.setAttribute("aria-hidden", "true");
      cleanups.forEach((off) => off());
      cleanups.length = 0;
    }

    function on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    }

    on(window, "scroll", () => {
      updateHintPlacement();
      dismiss();
    }, { passive: true });

    on(window, "wheel", dismiss, { passive: true });
    on(window, "touchstart", dismiss, { passive: true });
    on(document, "keydown", dismiss, { passive: true });
    on(document, "pointerdown", dismiss, { passive: true });

    const hero = document.querySelector(".home-hero");
    if (hero) {
      on(hero, "input", dismiss, { passive: true });
      on(hero, "change", dismiss, { passive: true });
    }

    window.addEventListener("beforeunload", saveScrollPosition);
    cleanups.push(() => window.removeEventListener("beforeunload", saveScrollPosition));

    finishScrollRestore();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initQuickVilles();
    initScrollHint();
  });
})();
