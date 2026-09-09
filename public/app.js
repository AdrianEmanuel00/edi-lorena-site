const weddingDate = new Date("2026-09-13T15:00:00+03:00");

const nav = document.getElementById("siteNav");
const seatingSearchForm = document.getElementById("seatingSearchForm");
const seatingSearch = document.getElementById("seatingSearch");
const seatingClear = document.getElementById("seatingClear");
const seatingSuggestions = document.getElementById("seatingSuggestions");
const seatingResults = document.getElementById("seatingResults");

let seatingGuests = [];
let indexedGuests = [];
let seatingTables = {};

function pad(value, size) {
  return String(value).padStart(size, "0");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTable(table) {
  const value = String(table || "").trim();
  if (!value) return "Masa nu este încă alocată";
  if (value.toLowerCase().includes("masa")) return value;
  return /^\d+$/.test(value) ? `Masa ${value}` : value;
}

function formatMenu(menu) {
  const value = String(menu || "").trim();
  return value || "Meniu nespecificat";
}

function updateCountdown() {
  const diff = weddingDate - new Date();
  const safeDiff = Math.max(0, diff);
  const days = Math.floor(safeDiff / 86400000);
  const hours = Math.floor((safeDiff % 86400000) / 3600000);
  const minutes = Math.floor((safeDiff % 3600000) / 60000);
  const seconds = Math.floor((safeDiff % 60000) / 1000);

  document.getElementById("cd-zile").textContent = pad(days, 3);
  document.getElementById("cd-ore").textContent = pad(hours, 2);
  document.getElementById("cd-minute").textContent = pad(minutes, 2);
  document.getElementById("cd-secunde").textContent = pad(seconds, 2);
}

function buildSeatingIndex(guests) {
  seatingGuests = guests
    .filter((guest) => guest && guest.name)
    .map((guest) => ({
      name: String(guest.name).trim(),
      table: String(guest.table || "").trim(),
      menu: String(guest.menu || "").trim()
    }));

  indexedGuests = seatingGuests.map((guest, index) => ({
    ...guest,
    index,
    searchKey: normalizeSearch(guest.name)
  }));

  seatingTables = seatingGuests.reduce((tables, guest) => {
    const key = String(guest.table || "").trim();
    if (!key) return tables;
    if (!tables[key]) tables[key] = [];
    tables[key].push(guest);
    return tables;
  }, {});
}

async function loadSeatingGuests() {
  try {
    const response = await fetch("assets/seating.json?v=20260910-mese", { cache: "no-store" });
    if (!response.ok) throw new Error("Lista meselor nu a putut fi încărcată.");
    const guests = await response.json();
    buildSeatingIndex(Array.isArray(guests) ? guests : []);
  } catch {
    buildSeatingIndex([]);
  }
}

function findSeatingMatches(query) {
  const normalized = normalizeSearch(query);
  if (normalized.length < 2) return [];

  const exactMatches = indexedGuests.filter((guest) => guest.searchKey === normalized);
  if (exactMatches.length) return exactMatches;

  const tokens = normalized.split(" ").filter(Boolean);
  return indexedGuests
    .filter((guest) => tokens.every((token) => guest.searchKey.includes(token)))
    .sort((a, b) => {
      const aStarts = a.searchKey.startsWith(normalized) ? 0 : 1;
      const bStarts = b.searchKey.startsWith(normalized) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name, "ro");
    });
}

function renderInitialSeatingMessage() {
  if (!seatingResults) return;

  seatingResults.innerHTML = seatingGuests.length
    ? '<div class="seating-message">Scrie numele pentru a vedea detaliile mesei.</div>'
    : '<div class="seating-message seating-empty">Lista meselor va fi disponibilă în curând.</div>';
}

function hideSuggestions() {
  if (!seatingSuggestions) return;
  seatingSuggestions.hidden = true;
  seatingSuggestions.innerHTML = "";
}

function showSuggestions(query) {
  const matches = findSeatingMatches(query).slice(0, 6);

  if (!seatingSuggestions || !matches.length) {
    hideSuggestions();
    return;
  }

  seatingSuggestions.innerHTML = matches
    .map(
      (guest) => `
        <button type="button" class="seating-suggestion" role="option" data-index="${guest.index}">
          <span class="seating-suggestion-name">${escapeHtml(guest.name)}</span>
          <span class="seating-suggestion-meta">${escapeHtml(formatTable(guest.table))}</span>
        </button>
      `
    )
    .join("");
  seatingSuggestions.hidden = false;
}

function renderGuestResult(guest) {
  const tableMates = (seatingTables[guest.table] || []).filter((mate) => mate.name !== guest.name);
  const mateList = tableMates.length
    ? tableMates
        .map(
          (mate) => {
            const menu = String(mate.menu || "").trim();
            return `
              <li>
                <span>${escapeHtml(mate.name)}</span>
                ${menu ? `<small>${escapeHtml(menu)}</small>` : ""}
              </li>
            `;
          }
        )
        .join("")
    : '<li><span>Nu mai este nimeni listat la această masă.</span></li>';

  return `
    <article class="seating-result-card">
      <div class="seating-result-top">
        <div>
          <p class="seating-result-label">Bine ai venit</p>
          <h3>${escapeHtml(guest.name)}</h3>
        </div>
        <div class="seating-table-badge">${escapeHtml(formatTable(guest.table))}</div>
      </div>

      <div class="seating-result-grid">
        <div class="seating-result-mini">
          <span>Meniul tău</span>
          <strong>${escapeHtml(formatMenu(guest.menu))}</strong>
        </div>
        <div class="seating-result-mini">
          <span>Invitați la masă</span>
          <strong>${(seatingTables[guest.table] || []).length || 1}</strong>
        </div>
      </div>

      <div class="seating-mates-block">
        <p>Cine mai este la masa ta</p>
        <ul>${mateList}</ul>
      </div>
    </article>
  `;
}

function renderSeatingResults(query) {
  if (!seatingResults) return;
  hideSuggestions();

  const normalized = normalizeSearch(query);
  if (!seatingGuests.length) {
    seatingResults.innerHTML = '<div class="seating-message seating-empty">Lista meselor va fi disponibilă în curând.</div>';
    return;
  }

  if (normalized.length < 2) {
    renderInitialSeatingMessage();
    return;
  }

  const matches = findSeatingMatches(query);
  if (!matches.length) {
    seatingResults.innerHTML =
      '<div class="seating-message seating-empty">Nu am găsit numele căutat. Încearcă după numele de familie sau fără diacritice.</div>';
    return;
  }

  const visibleMatches = matches.slice(0, 8);
  const resultIntro =
    matches.length > 1
      ? `<div class="seating-message">Am găsit ${matches.length} rezultate apropiate.</div>`
      : "";
  const overflow =
    matches.length > visibleMatches.length
      ? `<div class="seating-message">Am afișat primele ${visibleMatches.length} rezultate. Scrie mai multe litere pentru o căutare mai exactă.</div>`
      : "";

  seatingResults.innerHTML = resultIntro + visibleMatches.map(renderGuestResult).join("") + overflow;
}

window.addEventListener("scroll", () => {
  if (nav) nav.classList.toggle("scrolled", window.scrollY > 80);
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("visible");
    });
  },
  { threshold: 0.18 }
);

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

if (seatingSearchForm && seatingSearch) {
  seatingSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSeatingResults(seatingSearch.value);
  });

  seatingSearch.addEventListener("input", () => {
    seatingClear.classList.toggle("is-hidden", !seatingSearch.value);
    if (normalizeSearch(seatingSearch.value).length < 2) {
      hideSuggestions();
      renderInitialSeatingMessage();
      return;
    }
    showSuggestions(seatingSearch.value);
  });

  seatingSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSuggestions();
  });
}

if (seatingClear && seatingSearch) {
  seatingClear.addEventListener("click", () => {
    seatingSearch.value = "";
    seatingClear.classList.add("is-hidden");
    hideSuggestions();
    renderInitialSeatingMessage();
    seatingSearch.focus();
  });
}

if (seatingSuggestions && seatingSearch) {
  seatingSuggestions.addEventListener("click", (event) => {
    const option = event.target.closest(".seating-suggestion");
    if (!option) return;
    const guest = indexedGuests[Number(option.dataset.index)];
    if (!guest) return;
    seatingSearch.value = guest.name;
    seatingClear.classList.remove("is-hidden");
    renderSeatingResults(guest.name);
  });
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".seating-search-form")) hideSuggestions();
});

updateCountdown();
setInterval(updateCountdown, 1000);

loadSeatingGuests().then(renderInitialSeatingMessage);
