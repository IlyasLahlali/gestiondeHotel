const API = window.API_BASE || `${window.location.origin}/api`;
const IMAGES = "../../images/";

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "login.html";
}

function openHotel(id) {
  window.location.href = `hotelDetail.html?id=${id}`;
}

function goToVille(ville) {
  window.location.href = `HotelVille.html?ville=${encodeURIComponent(ville)}`;
}

function goReservations() {
  window.location.href = "reservationDetail.html";
}

function goFavoris() {
  window.location.href = "favoris.html";
}

function rechercher() {
  const ville = document.getElementById("ville").value;
  const personnes = document.getElementById("personnes").value;
  const type = document.getElementById("type").value;
  const budget = document.getElementById("budget")?.value;

  if (!ville) {
    alert("Veuillez sélectionner une ville.");
    return;
  }

  let url = `rechercheResultat.html?ville=${encodeURIComponent(ville)}`;
  if (personnes) url += `&personnes=${encodeURIComponent(personnes)}`;
  if (type) url += `&type=${encodeURIComponent(type)}`;
  if (budget) url += `&budget=${encodeURIComponent(budget)}`;

  window.location.href = url;
}

HomeData.bindCachedDestinations(goToVille);
HomeData.loadPopularHotels(API, IMAGES);
HomeData.loadDestinations(API, IMAGES, goToVille);
