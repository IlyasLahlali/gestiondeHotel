(function () {
  try {
    var build = window.__HF_BUILD || "";
    if (!build) return;

    var url = new URL(window.location.href);
    if (url.searchParams.get("_fresh") === build) {
      sessionStorage.setItem("hf_public_build", build);
      return;
    }

    if (sessionStorage.getItem("hf_public_build") === build) return;

    sessionStorage.setItem("hf_public_build", build);
    url.searchParams.set("_fresh", build);
    window.location.replace(url.toString());
  } catch (e) {
    /* ignore */
  }
})();
