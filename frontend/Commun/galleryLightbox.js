(function initGalleryLightbox() {
  let urls = [];
  let index = 0;

  function ensureModal() {
    if (document.getElementById("galleryLightbox")) return;

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="galleryLightbox" class="gallery-lightbox" hidden aria-hidden="true">
        <div class="gallery-lightbox-backdrop" data-close-gallery></div>
        <div class="gallery-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Galerie photos">
          <button type="button" class="gallery-lightbox-close" data-close-gallery aria-label="Fermer">×</button>
          <button type="button" class="gallery-lightbox-nav gallery-lightbox-prev" aria-label="Photo précédente">‹</button>
          <figure class="gallery-lightbox-figure">
            <img id="galleryLightboxImg" src="" alt="">
            <figcaption id="galleryLightboxCaption"></figcaption>
          </figure>
          <button type="button" class="gallery-lightbox-nav gallery-lightbox-next" aria-label="Photo suivante">›</button>
        </div>
      </div>
    `
    );

    document.querySelectorAll("[data-close-gallery]").forEach(el => {
      el.addEventListener("click", closeImageGallery);
    });

    document.querySelector(".gallery-lightbox-prev")?.addEventListener("click", e => {
      e.stopPropagation();
      showImage(index - 1);
    });

    document.querySelector(".gallery-lightbox-next")?.addEventListener("click", e => {
      e.stopPropagation();
      showImage(index + 1);
    });

    document.addEventListener("keydown", e => {
      const modal = document.getElementById("galleryLightbox");
      if (!modal || modal.hidden) return;
      if (e.key === "Escape") closeImageGallery();
      if (e.key === "ArrowLeft") showImage(index - 1);
      if (e.key === "ArrowRight") showImage(index + 1);
    });
  }

  function showImage(i) {
    if (!urls.length) return;
    index = (i + urls.length) % urls.length;

    const img = document.getElementById("galleryLightboxImg");
    const caption = document.getElementById("galleryLightboxCaption");
    const prev = document.querySelector(".gallery-lightbox-prev");
    const next = document.querySelector(".gallery-lightbox-next");

    if (img) img.src = urls[index];
    if (caption) caption.textContent = `${index + 1} / ${urls.length}`;

    const multi = urls.length > 1;
    if (prev) prev.hidden = !multi;
    if (next) next.hidden = !multi;
  }

  function openImageGallery(imageUrls, startIndex = 0) {
    if (!imageUrls?.length) return;
    ensureModal();
    urls = imageUrls.slice();
    index = Math.max(0, Math.min(startIndex, urls.length - 1));

    const modal = document.getElementById("galleryLightbox");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("gallery-lightbox-open");
    showImage(index);
  }

  function closeImageGallery() {
    const modal = document.getElementById("galleryLightbox");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("gallery-lightbox-open");
    urls = [];
  }

  window.openImageGallery = openImageGallery;
  window.closeImageGallery = closeImageGallery;
})();
