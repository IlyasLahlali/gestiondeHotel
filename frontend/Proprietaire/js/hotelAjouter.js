document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("hotelForm");
  const chambresContainer = document.getElementById("chambresContainer");
  const ajouterChambreBtn = document.getElementById("ajouterChambreBtn");
  const chambresCountEl = document.getElementById("chambresCount");
  const villeSelect = document.getElementById("ville");

  const modal = document.getElementById("addHotelChambreModal");
  const modalTitle = document.getElementById("addHotelChambreModalTitle");
  const modalSaveBtn = document.getElementById("addHotelChambreModalSave");
  const typeInput = document.getElementById("addHotelChType");
  const prixInput = document.getElementById("addHotelChPrix");
  const capaciteInput = document.getElementById("addHotelChCapacite");
  const photosInput = document.getElementById("addHotelChPhotos");
  const pendingGrid = document.getElementById("addHotelChPendingGrid");
  const hotelPhotosInput = document.getElementById("hotelPhotos");
  const hotelPhotosPreview = document.getElementById("hotelPhotosPreview");
  const createHotelBtn = document.getElementById("createHotelBtn");

  const chambres = [];
  let addMapPicker = null;
  let editingChambreId = null;
  let pendingPhotoUrls = [];
  let hotelPhotoPreviewUrls = [];
  let hotelPhotoFiles = [];
  let isCreateHotelSubmitting = false;
  let nextChambreId = 1;

  const TYPE_LABELS = {
    economique: "Économique",
    standard: "Standard",
    superieur: "Supérieur",
    deluxe: "Deluxe",
    suite: "Suite",
    familiale: "Familiale"
  };

  function typeLabel(type) {
    return TYPE_LABELS[type] || type || "Chambre";
  }

  function escapeHtml(str) {
    const el = document.createElement("div");
    el.textContent = str ?? "";
    return el.innerHTML;
  }

  function clearHotelPhotoPreviews() {
    hotelPhotoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    hotelPhotoPreviewUrls = [];
    if (hotelPhotosPreview) hotelPhotosPreview.innerHTML = "";
  }

  function resetHotelPhotos() {
    clearHotelPhotoPreviews();
    hotelPhotoFiles = [];
    if (hotelPhotosInput) hotelPhotosInput.value = "";
  }

  function syncHotelPhotosInput() {
    if (!hotelPhotosInput) return;
    const dt = new DataTransfer();
    hotelPhotoFiles.forEach(file => dt.items.add(file));
    hotelPhotosInput.files = dt.files;
  }

  function addHotelPhotoFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const remaining = 10 - hotelPhotoFiles.length;
    if (remaining <= 0) {
      alert("Maximum 10 photos pour l'hôtel.");
      return;
    }

    hotelPhotoFiles.push(...incoming.slice(0, remaining));
    if (incoming.length > remaining) {
      alert("Maximum 10 photos — seules les premières ont été ajoutées.");
    }

    syncHotelPhotosInput();
    renderHotelPhotoPreviews();
  }

  function removeHotelPhoto(index) {
    if (index < 0 || index >= hotelPhotoFiles.length) return;
    hotelPhotoFiles.splice(index, 1);
    syncHotelPhotosInput();
    renderHotelPhotoPreviews();
  }

  function renderHotelPhotoPreviews() {
    if (!hotelPhotosPreview) return;

    clearHotelPhotoPreviews();
    if (!hotelPhotoFiles.length) return;

    hotelPhotosPreview.innerHTML = hotelPhotoFiles.map((file, index) => {
      const url = URL.createObjectURL(file);
      hotelPhotoPreviewUrls.push(url);
      const coverClass = index === 0 ? " is-cover" : "";
      const badge = index === 0 ? '<span class="hotel-add-photos-preview__badge">Principale</span>' : "";
      return `
        <figure class="hotel-add-photos-preview__item${coverClass}">
          <img src="${url}" alt="Photo hôtel ${index + 1}">
          ${badge}
          <button type="button" class="hotel-add-photos-preview__remove" data-remove-hotel-photo="${index}" aria-label="Supprimer cette photo">×</button>
        </figure>`;
    }).join("");
  }

  function onHotelPhotosSelected() {
    if (!hotelPhotosInput?.files?.length) return;
    addHotelPhotoFiles(hotelPhotosInput.files);
    hotelPhotosInput.value = "";
  }

  function updateChambresCount() {
    const count = chambres.length;
    chambresCountEl.textContent = count === 1 ? "1 chambre" : `${count} chambres`;
    ajouterChambreBtn.textContent = count
      ? "+ Ajouter une autre chambre"
      : "+ Ajouter une chambre";
  }

  function openModal() {
    if (!modal) return;
    modal.classList.add("show");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("owner-modal-open");
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("owner-modal-open");
    clearPendingPhotoPreviews();
    if (photosInput) photosInput.value = "";
    editingChambreId = null;
  }

  function clearPendingPhotoPreviews() {
    pendingPhotoUrls.forEach(url => URL.revokeObjectURL(url));
    pendingPhotoUrls = [];
    if (pendingGrid) pendingGrid.innerHTML = "";
  }

  function renderPendingPhotoPreviews() {
    if (!photosInput || !pendingGrid) return;
    clearPendingPhotoPreviews();
    const files = photosInput.files;
    if (!files?.length) return;

    pendingGrid.innerHTML = Array.from(files).map((file, index) => {
      const url = URL.createObjectURL(file);
      pendingPhotoUrls.push(url);
      return `
        <figure class="owner-chambre-gallery__item owner-chambre-gallery__item--pending">
          <img src="${url}" alt="Nouvelle photo ${index + 1}">
          <span class="owner-chambre-gallery__badge owner-chambre-gallery__badge--new">Nouveau</span>
        </figure>`;
    }).join("");
  }

  function getPhotoFilesFromInput() {
    if (!photosInput?.files?.length) return [];
    return Array.from(photosInput.files);
  }

  function renderChambreCards() {
    if (!chambres.length) {
      chambresContainer.innerHTML = `
        <p class="hotel-add-chambres-empty">Aucune chambre ajoutée. Cliquez sur le bouton ci-dessous pour commencer.</p>`;
      updateChambresCount();
      return;
    }

    chambresContainer.innerHTML = chambres.map(chambre => {
      const coverUrl = chambre.photoUrls[0] || "";
      const thumb = coverUrl
        ? `<img src="${coverUrl}" alt="" class="hotel-add-chambre-card__img">`
        : `<span class="hotel-add-chambre-card__placeholder" aria-hidden="true">🛏</span>`;
      const photoCount = chambre.photos.length;
      const photoMeta = photoCount
        ? `${photoCount} photo${photoCount > 1 ? "s" : ""}`
        : "Aucune photo";

      return `
        <article class="hotel-add-chambre-card" data-chambre-id="${chambre.localId}">
          <div class="hotel-add-chambre-card__thumb">${thumb}</div>
          <div class="hotel-add-chambre-card__body">
            <strong class="hotel-add-chambre-card__type">${escapeHtml(typeLabel(chambre.type))}</strong>
            <p class="hotel-add-chambre-card__meta">${Math.round(chambre.prix)} DH / nuit · ${chambre.capacite} pers.</p>
            <p class="hotel-add-chambre-card__photos">${photoMeta}</p>
          </div>
          <div class="hotel-add-chambre-card__actions">
            <button type="button" class="hotel-add-chambre-card__btn hotel-add-chambre-card__btn--edit" data-edit-chambre="${chambre.localId}">Modifier</button>
            <button type="button" class="hotel-add-chambre-card__btn hotel-add-chambre-card__btn--delete" data-delete-chambre="${chambre.localId}">Supprimer</button>
          </div>
        </article>`;
    }).join("");

    updateChambresCount();
  }

  function openAddChambreModal() {
    editingChambreId = null;
    modalTitle.textContent = "Ajouter une chambre";
    modalSaveBtn.textContent = "Ajouter";
    typeInput.value = "standard";
    prixInput.value = "";
    capaciteInput.value = "";
    if (photosInput) photosInput.value = "";
    clearPendingPhotoPreviews();
    openModal();
  }

  function openEditChambreModal(localId) {
    const chambre = chambres.find(c => c.localId === localId);
    if (!chambre) return;

    editingChambreId = localId;
    modalTitle.textContent = "Modifier la chambre";
    modalSaveBtn.textContent = "Enregistrer";
    typeInput.value = chambre.type;
    prixInput.value = chambre.prix;
    capaciteInput.value = chambre.capacite;

    if (photosInput) photosInput.value = "";
    clearPendingPhotoPreviews();
    if (pendingGrid && chambre.photoUrls.length) {
      pendingGrid.innerHTML = chambre.photoUrls.map((url, index) => `
        <figure class="owner-chambre-gallery__item owner-chambre-gallery__item--pending">
          <img src="${url}" alt="Photo ${index + 1}">
          <span class="owner-chambre-gallery__badge">${index === 0 ? "Vignette" : "Photo"}</span>
        </figure>`).join("");
    }

    openModal();
  }

  function revokeChambrePhotoUrls(chambre) {
    chambre.photoUrls.forEach(url => URL.revokeObjectURL(url));
  }

  function deleteChambre(localId) {
    const index = chambres.findIndex(c => c.localId === localId);
    if (index === -1) return;
    revokeChambrePhotoUrls(chambres[index]);
    chambres.splice(index, 1);
    renderChambreCards();
  }

  function saveChambreFromModal() {
    const type = typeInput.value;
    const prix = Number(prixInput.value);
    const capacite = Number.parseInt(capaciteInput.value, 10);
    const newPhotos = getPhotoFilesFromInput();

    if (!type) {
      alert("Choisissez un type de chambre.");
      return;
    }
    if (!Number.isFinite(prix) || prix <= 0) {
      alert("Indiquez un prix valide.");
      return;
    }
    if (!Number.isFinite(capacite) || capacite <= 0) {
      alert("Indiquez une capacité valide.");
      return;
    }

    if (editingChambreId) {
      const chambre = chambres.find(c => c.localId === editingChambreId);
      if (!chambre) return;

      chambre.type = type;
      chambre.prix = prix;
      chambre.capacite = capacite;

      if (newPhotos.length) {
        revokeChambrePhotoUrls(chambre);
        chambre.photos = newPhotos;
        chambre.photoUrls = newPhotos.map(file => URL.createObjectURL(file));
      }
    } else {
      const photos = newPhotos;
      chambres.push({
        localId: nextChambreId++,
        type,
        prix,
        capacite,
        photos,
        photoUrls: photos.map(file => URL.createObjectURL(file))
      });
    }

    closeModal();
    renderChambreCards();
  }

  async function initMapPicker() {
    if (addMapPicker || !window.HotelMap) return;
    addMapPicker = new HotelMap.HotelMapPicker("hotelAddMap", {
      addressInputId: "adresse",
      villeSelectId: "ville"
    });
    await addMapPicker.init();
    if (villeSelect?.value) {
      addMapPicker.onVilleChange(villeSelect.value);
    }
  }

  initMapPicker();
  renderChambreCards();

  document.getElementById("mapLocateBtn")?.addEventListener("click", () => {
    initMapPicker().then(() => addMapPicker?.locateUser());
  });

  villeSelect?.addEventListener("change", () => {
    if (addMapPicker) addMapPicker.onVilleChange(villeSelect.value);
  });

  ajouterChambreBtn.addEventListener("click", openAddChambreModal);
  document.getElementById("addHotelChambreModalClose")?.addEventListener("click", closeModal);
  document.getElementById("addHotelChambreModalCancel")?.addEventListener("click", closeModal);
  modalSaveBtn?.addEventListener("click", saveChambreFromModal);
  photosInput?.addEventListener("change", renderPendingPhotoPreviews);
  hotelPhotosInput?.addEventListener("change", onHotelPhotosSelected);

  hotelPhotosPreview?.addEventListener("click", event => {
    const btn = event.target.closest("[data-remove-hotel-photo]");
    if (!btn) return;
    btn.classList.add("is-active");
    removeHotelPhoto(Number(btn.dataset.removeHotelPhoto));
  });

  modal?.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal?.classList.contains("show")) {
      closeModal();
    }
  });

  chambresContainer.addEventListener("click", event => {
    const editId = event.target.closest("[data-edit-chambre]")?.dataset.editChambre;
    const deleteId = event.target.closest("[data-delete-chambre]")?.dataset.deleteChambre;

    if (editId) {
      openEditChambreModal(Number(editId));
      return;
    }

    if (deleteId) {
      deleteChambre(Number(deleteId));
    }
  });

  function setCreateHotelBtnPressed(isPressed) {
    if (!createHotelBtn) return;
    if (!isPressed && isCreateHotelSubmitting) return;

    createHotelBtn.classList.toggle("is-pressed", isPressed);

    if (isPressed) {
      createHotelBtn.style.setProperty("background-color", "#2F64EA", "important");
      createHotelBtn.style.setProperty("color", "#FFFFFF", "important");
      createHotelBtn.style.setProperty("box-shadow", "0 4px 12px rgba(47, 100, 234, 0.28)", "important");
    } else {
      createHotelBtn.style.removeProperty("background-color");
      createHotelBtn.style.removeProperty("color");
      createHotelBtn.style.removeProperty("box-shadow");
    }
  }

  function releaseCreateHotelBtnPressed() {
    window.setTimeout(() => {
      if (!isCreateHotelSubmitting) setCreateHotelBtnPressed(false);
    }, 120);
  }

  createHotelBtn?.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    setCreateHotelBtnPressed(true);
  });

  createHotelBtn?.addEventListener("pointerup", releaseCreateHotelBtnPressed);

  createHotelBtn?.addEventListener("pointercancel", () => {
    if (!isCreateHotelSubmitting) setCreateHotelBtnPressed(false);
  });

  createHotelBtn?.addEventListener("mouseleave", () => {
    if (!isCreateHotelSubmitting) setCreateHotelBtnPressed(false);
  });

  createHotelBtn?.addEventListener("keydown", event => {
    if (event.key === " " || event.key === "Enter") setCreateHotelBtnPressed(true);
  });

  createHotelBtn?.addEventListener("keyup", event => {
    if ((event.key === " " || event.key === "Enter") && !isCreateHotelSubmitting) {
      setCreateHotelBtnPressed(false);
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    isCreateHotelSubmitting = true;
    setCreateHotelBtnPressed(true);

    const token = localStorage.getItem("token");
    if (!token) {
      isCreateHotelSubmitting = false;
      setCreateHotelBtnPressed(false);
      alert("Non connecté");
      return;
    }

    await initMapPicker();
    const coords = addMapPicker ? addMapPicker.getLatLng() : { latitude: null, longitude: null };

    const data = {
      nom: document.getElementById("nom").value,
      ville: document.getElementById("ville").value,
      adresse: document.getElementById("adresse").value,
      description: document.getElementById("description").value,
      latitude: coords.latitude,
      longitude: coords.longitude,
      chambres: chambres.map(c => ({
        type: c.type,
        prix: c.prix,
        capacite: c.capacite
      }))
    };

    try {
      const res = await fetch(`${window.API_BASE || window.location.origin + "/api"}/hotels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(data)
      });

      const text = await res.text();
      let payload;

      try {
        payload = JSON.parse(text);
      } catch {
        if (!res.ok) {
          alert(text || "Erreur");
          return;
        }
        alert(text);
        return;
      }

      if (!res.ok) {
        alert(payload.message || text || "Erreur");
        return;
      }

      const hotelId = payload.id;
      const photoFiles = hotelPhotoFiles;

      try {
        if (photoFiles.length) {
          if (photoFiles.length > 10) {
            alert("Hôtel créé. Maximum 10 images — seules les 10 premières seront envoyées.");
          }
          const limited = photoFiles.slice(0, 10);
          await uploadHotelPhotoBatch(hotelId, limited, token, { hasPrincipal: false });
        }

        const createdChambres = Array.isArray(payload.chambres) ? payload.chambres : [];
        for (let i = 0; i < chambres.length; i += 1) {
          const localChambre = chambres[i];
          const serverChambre = createdChambres[i];
          if (!serverChambre?.id || !localChambre?.photos?.length) continue;
          await uploadChambreGalleryImages(serverChambre.id, localChambre.photos, token);
        }
      } catch (uploadErr) {
        alert(`${payload.message}\n\nAttention : ${uploadErr.message}`);
        window.location.href = hotelId ? `hotelDetail.html?id=${hotelId}` : "hotel.html";
        return;
      }

      alert(payload.message || "Hôtel créé");
      form.reset();
      resetHotelPhotos();
      chambres.forEach(revokeChambrePhotoUrls);
      chambres.length = 0;
      renderChambreCards();
      window.location.href = hotelId ? `hotelDetail.html?id=${hotelId}` : "hotel.html";
    } catch (err) {
      console.log("ERREUR :", err);
      alert("Erreur serveur");
    } finally {
      isCreateHotelSubmitting = false;
      setCreateHotelBtnPressed(false);
    }
  });
});
