/** Lieux emblématiques et fichiers image par ville */
const VILLES_DESTINATIONS = {
  Marrakech: { file: "marrakech.jpg", landmark: "Place Jemaa el-Fna" },
  Rabat: { file: "rabat.jpg", landmark: "Tour Hassan" },
  Casablanca: { file: "casablanca.jpg", landmark: "Mosquée Hassan II" },
  Tanger: { file: "tanger.jpg", landmark: "Kasbah & port de Tanger" },
  "Fès": { file: "fes.jpg", landmark: "Bab Bou Jeloud" },
  Agadir: { file: "agadir.jpg", landmark: "Plage d'Agadir" },
  Meknès: { file: "meknes.jpg", landmark: "Bab Mansour" },
  Oujda: { file: "oujda.jpg", landmark: "Médina de Oujda" }
};

function getVilleDestination(ville, imageBase) {
  const base = imageBase || window.APP_PATHS?.images || "../../images/";
  const info = VILLES_DESTINATIONS[ville?.trim()];
  return {
    image: `${base}${info?.file || "default.jpg"}`,
    landmark: info?.landmark || "Maroc"
  };
}
