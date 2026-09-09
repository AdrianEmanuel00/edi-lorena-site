const weddingDate = new Date("2026-09-13T15:00:00+03:00");

const nav = document.getElementById("siteNav");
const seatingTriggers = document.querySelectorAll("[data-open-seating]");
const seatingSearchForm = document.getElementById("seatingSearchForm");
const seatingSearch = document.getElementById("seatingSearch");
const seatingClear = document.getElementById("seatingClear");
const seatingSuggestions = document.getElementById("seatingSuggestions");
const seatingResults = document.getElementById("seatingResults");
const seatingModal = document.getElementById("seatingModal");
const seatingModalClose = document.getElementById("seatingModalClose");
const seatingModalGuest = document.getElementById("seatingModalGuest");
const seatingModalTable = document.getElementById("seatingModalTable");
const seatingModalCount = document.getElementById("seatingModalCount");
const seatingModalList = document.getElementById("seatingModalList");
const seatingTablePanel = document.getElementById("seatingTablePanel");

let seatingGuests = [];
let indexedGuests = [];
let seatingTables = {};
let seatingModalLastFocus = null;

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
      table: String(guest.table || "").trim()
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
    const response = await fetch("assets/seating.json?v=20260910-hero-masa", { cache: "no-store" });
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
    ? '<div class="seating-message">Scrie numele pentru a afla masa.</div>'
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
  const guestCount = (seatingTables[guest.table] || []).length || 1;
  const countLabel = guestCount === 1 ? "1 invitat" : `${guestCount} invitați`;

  return `
    <article class="seating-result-card">
      <p class="seating-result-label">Bine ai venit</p>
      <h3>${escapeHtml(guest.name)}</h3>
      <div class="seating-result-divider" aria-hidden="true"></div>
      <div class="seating-result-main">
        <span>Masa ta</span>
        <strong>${escapeHtml(formatTable(guest.table))}</strong>
        <small>${escapeHtml(countLabel)} la această masă</small>
      </div>
      <div class="seating-result-actions">
        <button type="button" class="seating-open-table" data-index="${guest.index}">
          Vezi masa
        </button>
      </div>
    </article>
  `;
}

function resetSeatingTablePanel() {
  if (!seatingTablePanel) return;
  seatingTablePanel.classList.add("is-hidden");
  if (seatingModalGuest) seatingModalGuest.textContent = "";
  if (seatingModalTable) seatingModalTable.textContent = "";
  if (seatingModalCount) seatingModalCount.textContent = "";
  if (seatingModalList) seatingModalList.innerHTML = "";
}

function resetSeatingFinder() {
  if (seatingSearch) seatingSearch.value = "";
  if (seatingClear) seatingClear.classList.add("is-hidden");
  hideSuggestions();
  resetSeatingTablePanel();
  renderInitialSeatingMessage();
}

function openSeatingModal() {
  if (!seatingModal) return;

  seatingModalLastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  seatingModal.classList.add("is-open");
  seatingModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  resetSeatingFinder();
  window.setTimeout(() => {
    if (seatingSearch) seatingSearch.focus();
  }, 50);
}

function showSeatingTable(guest) {
  if (!seatingTablePanel || !seatingModalTable || !seatingModalList) return;

  const tableGuests = seatingTables[guest.table] || [];
  const count = tableGuests.length || 1;
  const countText =
    count === 1
      ? "Un invitat este trecut la această masă."
      : `${count} invitați sunt trecuți la această masă.`;

  if (seatingModalGuest) seatingModalGuest.textContent = guest.name;
  seatingModalTable.textContent = formatTable(guest.table);
  if (seatingModalCount) seatingModalCount.textContent = countText;
  seatingModalList.innerHTML = tableGuests
    .map((tableGuest) => {
      const isCurrentGuest = tableGuest.name === guest.name;
      return `
        <li class="${isCurrentGuest ? "is-current" : ""}">
          <span>${escapeHtml(tableGuest.name)}</span>
          ${isCurrentGuest ? "<strong>Tu</strong>" : ""}
        </li>
      `;
    })
    .join("");

  seatingTablePanel.classList.remove("is-hidden");
  seatingTablePanel.focus();
  seatingTablePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeSeatingModal() {
  if (!seatingModal) return;
  seatingModal.classList.remove("is-open");
  seatingModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (seatingModalLastFocus) seatingModalLastFocus.focus();
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
    resetSeatingTablePanel();
    renderSeatingResults(seatingSearch.value);
  });

  seatingSearch.addEventListener("input", () => {
    seatingClear.classList.toggle("is-hidden", !seatingSearch.value);
    resetSeatingTablePanel();
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
    resetSeatingTablePanel();
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
    resetSeatingTablePanel();
    renderSeatingResults(guest.name);
  });
}

if (seatingResults) {
  seatingResults.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(".seating-open-table");
    if (!button) return;
    const guest = indexedGuests[Number(button.dataset.index)];
    if (guest) showSeatingTable(guest);
  });
}

seatingTriggers.forEach((trigger) => {
  trigger.addEventListener("click", openSeatingModal);
});

if (seatingModal) {
  seatingModal.addEventListener("click", (event) => {
    if (event.target === seatingModal || event.target === seatingModalClose) {
      closeSeatingModal();
    }
  });
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  if (!event.target.closest(".seating-search-form")) hideSuggestions();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSeatingModal();
});

updateCountdown();
setInterval(updateCountdown, 1000);

loadSeatingGuests().then(renderInitialSeatingMessage);
