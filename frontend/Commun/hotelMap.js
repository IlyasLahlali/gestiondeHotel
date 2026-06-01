(function (global) {
  "use strict";

  const NOMINATIM = "https://nominatim.openstreetmap.org";
  const USER_AGENT = "HotelFacileSmart/1.0";

  const CITY_COORDS = {
    Marrakech: [31.6295, -7.9811],
    Rabat: [34.0209, -6.8416],
    Casablanca: [33.5731, -7.5898],
    Tanger: [35.7595, -5.834],
    "Fès": [34.0181, -5.0078],
    Agadir: [30.4278, -9.5981],
    Oujda: [34.6814, -1.9086],
    "Meknès": [33.8935, -5.5473]
  };

  let leafletPromise = null;

  function parseCoord(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function externalMapsUrl(lat, lng, label) {
    const q = encodeURIComponent(label || `${lat},${lng}`);
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${q}`;
  }

  async function nominatimFetch(path) {
    const res = await fetch(`${NOMINATIM}${path}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT }
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function geocodeAddress(adresse, ville) {
    const q = [adresse, ville, "Maroc"].filter(Boolean).join(", ");
    if (!q.trim()) return null;
    const data = await nominatimFetch(
      `/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    );
    if (!Array.isArray(data) || !data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }

  async function reverseGeocode(lat, lng) {
    const data = await nominatimFetch(
      `/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    if (!data) return null;
    return data.display_name || null;
  }

  function fixLeafletIcons() {
    if (!global.L || global.L._hotelMapIconsFixed) return;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
    });
    global.L._hotelMapIconsFixed = true;
  }

  function loadLeaflet() {
    if (global.L && global.L.map) {
      fixLeafletIcons();
      return Promise.resolve();
    }
    if (leafletPromise) return leafletPromise;

    leafletPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.setAttribute("data-leaflet-css", "1");
        document.head.appendChild(link);
      }

      const existing = document.querySelector('script[data-leaflet-js]');
      if (existing) {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error("Leaflet")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.setAttribute("data-leaflet-js", "1");
      script.onload = () => {
        fixLeafletIcons();
        resolve();
      };
      script.onerror = () => reject(new Error("Leaflet"));
      document.head.appendChild(script);
    });

    return leafletPromise;
  }

  function defaultCoords(ville) {
    return CITY_COORDS[ville] || CITY_COORDS.Marrakech;
  }

  class HotelMapPicker {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.options = options;
      this.map = null;
      this.marker = null;
      this.lat = null;
      this.lng = null;
      this.ready = false;
    }

    async init() {
      await loadLeaflet();
      const el = document.getElementById(this.containerId);
      if (!el || this.map) return;

      const [lat, lng] = defaultCoords(this.options.ville || "Marrakech");
      this.map = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(this.map);

      this.map.on("click", e => this.setMarker(e.latlng.lat, e.latlng.lng, true));
      this.ready = true;
    }

    invalidateSize() {
      if (this.map) {
        this.map.invalidateSize();
      }
    }

    setMarker(lat, lng, reverse) {
      this.lat = lat;
      this.lng = lng;
      if (!this.marker) {
        this.marker = L.marker([lat, lng], { draggable: true }).addTo(this.map);
        this.marker.on("dragend", () => {
          const pos = this.marker.getLatLng();
          this.lat = pos.lat;
          this.lng = pos.lng;
          this.updateAddressFromCoords();
        });
      } else {
        this.marker.setLatLng([lat, lng]);
      }
      this.map.setView([lat, lng], Math.max(this.map.getZoom(), 15));
      if (reverse) this.updateAddressFromCoords();
    }

    async updateAddressFromCoords() {
      const inputId = this.options.addressInputId;
      if (!inputId || this.lat == null || this.lng == null) return;
      const input = document.getElementById(inputId);
      if (!input) return;
      const addr = await reverseGeocode(this.lat, this.lng);
      if (addr) input.value = addr.split(",").slice(0, 3).join(",").trim();
    }

    async setFromHotel(latitude, longitude, ville) {
      await this.init();
      this.options.ville = ville;
      let lat = parseCoord(latitude);
      let lng = parseCoord(longitude);
      if (lat == null || lng == null) {
        const input = this.options.addressInputId
          ? document.getElementById(this.options.addressInputId)
          : null;
        const villeEl = this.options.villeSelectId
          ? document.getElementById(this.options.villeSelectId)
          : null;
        const adresse = input?.value?.trim();
        const v = villeEl?.value || ville;
        if (adresse && v) {
          const coords = await geocodeAddress(adresse, v);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          }
        }
      }
      if (lat == null || lng == null) {
        [lat, lng] = defaultCoords(ville);
      }
      this.setMarker(lat, lng, false);
      this.invalidateSize();
    }

    async locateUser() {
      await this.init();
      if (!navigator.geolocation) {
        alert("Géolocalisation non disponible sur cet appareil.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => this.setMarker(pos.coords.latitude, pos.coords.longitude, true),
        () => alert("Impossible d'obtenir votre position.")
      );
    }

    async geocodeFromForm() {
      await this.init();
      const input = this.options.addressInputId
        ? document.getElementById(this.options.addressInputId)
        : null;
      const villeEl = this.options.villeSelectId
        ? document.getElementById(this.options.villeSelectId)
        : null;
      const adresse = input?.value?.trim();
      const ville = villeEl?.value?.trim();
      if (!adresse || !ville) {
        alert("Renseignez l'adresse et la ville avant de localiser sur la carte.");
        return;
      }
      const coords = await geocodeAddress(adresse, ville);
      if (!coords) {
        alert("Adresse introuvable sur la carte.");
        return;
      }
      this.setMarker(coords.lat, coords.lng, false);
    }

    onVilleChange(ville) {
      this.options.ville = ville;
      if (this.lat == null || this.lng == null) {
        const [lat, lng] = defaultCoords(ville);
        this.setMarker(lat, lng, false);
      }
    }

    getLatLng() {
      if (this.lat == null || this.lng == null) return { latitude: null, longitude: null };
      return {
        latitude: Math.round(this.lat * 1e6) / 1e6,
        longitude: Math.round(this.lng * 1e6) / 1e6
      };
    }
  }

  class HotelMapView {
    constructor(containerId, lat, lng, label) {
      this.containerId = containerId;
      this.lat = lat;
      this.lng = lng;
      this.label = label || "";
      this.map = null;
    }

    async render() {
      await loadLeaflet();
      const el = document.getElementById(this.containerId);
      if (!el) return;

      this.map = L.map(el, { scrollWheelZoom: false, dragging: true, zoomControl: true }).setView(
        [this.lat, this.lng],
        15
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(this.map);
      L.marker([this.lat, this.lng]).addTo(this.map);
      setTimeout(() => this.map.invalidateSize(), 150);
    }
  }

  global.HotelMap = {
    CITY_COORDS,
    loadLeaflet,
    parseCoord,
    geocodeAddress,
    reverseGeocode,
    externalMapsUrl,
    HotelMapPicker,
    HotelMapView
  };
})(window);
