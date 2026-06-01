(function (global) {
  function avisStarSvg(filled = false) {
    if (filled) {
      return `<svg class="hotel-avis-star-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
    }
    return `<svg class="hotel-avis-star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }

  function renderStarsHtml(note, { size = "" } = {}) {
    const n = Math.max(0, Math.min(5, Number(note) || 0));
    const sizeClass = size === "lg" ? " hotel-avis-stars--lg" : size === "sm" ? " hotel-avis-stars--sm" : "";
    let html = `<span class="hotel-avis-stars${sizeClass}" aria-label="${n} sur 5 étoiles">`;
    for (let i = 1; i <= 5; i += 1) {
      html += `<span class="hotel-avis-star${i <= n ? " is-filled" : ""}">${avisStarSvg(i <= n)}</span>`;
    }
    html += "</span>";
    return html;
  }

  function renderRatingSummary(stats, options = {}) {
    const {
      size = "lg",
      linkToSection = false,
      emptyLabel = "Pas encore d'avis"
    } = options;
    const total = Number(stats?.total) || 0;

    if (total <= 0) {
      return `<span class="hotel-avis-count owner-hotel-rating-empty">${emptyLabel}</span>`;
    }

    const moyenne = stats.moyenne;
    const starSize = size === "sm" ? "sm" : "lg";
    const inner = `
      <span class="hotel-avis-score">${moyenne}</span>
      ${renderStarsHtml(Math.round(Number(moyenne)), { size: starSize })}
      <span class="hotel-avis-count">${total} avis</span>`;

    if (linkToSection) {
      return `<button type="button" class="owner-hotel-rating-link hotel-avis-summary" onclick="scrollToOwnerSection('ownerAvisSection')" aria-label="Voir les ${total} avis clients">${inner}</button>`;
    }

    return `<div class="hotel-avis-summary">${inner}</div>`;
  }

  function renderCardStars(noteMoyenne, nbAvis) {
    const note = Number(noteMoyenne);
    if (!Number.isFinite(note) || note <= 0) return "";

    const moyenne = Math.max(1, Math.min(5, Math.round(note)));
    return `<span class="owner-hotel-card__rating-stars" title="Note moyenne ${note}/5">${renderStarsHtml(moyenne, { size: "sm" })}</span>`;
  }

  global.AvisStars = {
    avisStarSvg,
    renderStarsHtml,
    renderRatingSummary,
    renderCardStars
  };
})(window);
