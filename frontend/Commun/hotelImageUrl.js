const API_ORIGIN = window.API_ORIGIN || window.location.origin;
window.API_ORIGIN = API_ORIGIN;

function hotelCoverSrc(hotel, imageBase) {
  const base = imageBase || window.APP_PATHS?.images || "../../images/";

  if (hotel?.image_principale) {
    return `${API_ORIGIN}${hotel.image_principale}`;
  }

  if (hotel?.ville && typeof getVilleDestination === "function") {
    return getVilleDestination(hotel.ville, base).image;
  }

  return `${base}default.jpg`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

async function uploadPrincipalImage(hotelId, file, token) {
  const dataUrl = await fileToDataUrl(file);

  const res = await fetch(`${API_ORIGIN}/api/hotels/${hotelId}/image-principale`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ dataUrl })
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || "Erreur upload image principale");

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function uploadGalleryImages(hotelId, files, token) {
  const images = await Promise.all(
    Array.from(files).map(async file => ({ dataUrl: await fileToDataUrl(file) }))
  );

  const res = await fetch(`${API_ORIGIN}/api/hotels/${hotelId}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ images })
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || "Erreur upload galerie");

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function chambreCoverSrc(chambre) {
  if (chambre?.images?.length) {
    return `${API_ORIGIN}${chambre.images[0].chemin}`;
  }
  return null;
}

function getChambreImageUrls(chambre) {
  if (!chambre?.images?.length) {
    const cover = chambreCoverSrc(chambre);
    return cover ? [cover] : [];
  }
  return chambre.images.map(img => `${API_ORIGIN}${img.chemin}`);
}

async function uploadHotelPhotoBatch(hotelId, files, token, { hasPrincipal = false } = {}) {
  const list = Array.from(files || []);
  if (!list.length) return;

  if (!hasPrincipal) {
    await uploadPrincipalImage(hotelId, list[0], token);
    if (list.length > 1) {
      await uploadGalleryImages(hotelId, list.slice(1), token);
    }
    return;
  }

  await uploadGalleryImages(hotelId, list, token);
}

async function uploadChambreGalleryImages(chambreId, files, token) {
  const images = await Promise.all(
    Array.from(files).map(async file => ({ dataUrl: await fileToDataUrl(file) }))
  );

  const res = await fetch(`${API_ORIGIN}/api/chambres/${chambreId}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ images })
  });

  const text = await res.text();
  if (!res.ok) throw new Error(text || "Erreur upload galerie chambre");

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
