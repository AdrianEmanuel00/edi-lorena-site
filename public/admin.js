let allRsvps = [];
let activeFilter = "all";
let editingId = null;
let selectedId = null;

const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const statsGrid = document.getElementById("statsGrid");
const responsesList = document.getElementById("responsesList");
const responseDetails = document.getElementById("responseDetails");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const menuOptions = ["Carne", "Vegetarian", "Meniu de copii"];

function showAdmin() {
  loginPanel.classList.add("is-hidden");
  adminPanel.classList.remove("is-hidden");
}

function showLogin() {
  loginPanel.classList.remove("is-hidden");
  adminPanel.classList.add("is-hidden");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function fullName(guest) {
  return `${guest.firstName || ""} ${guest.lastName || ""}`.trim();
}

function groupNames(rsvp) {
  const names = (rsvp.guests || []).map(fullName).filter(Boolean);
  if (rsvp.responseType !== "attend" || names.length <= 1) {
    return rsvp.primaryName || names[0] || "Fără nume";
  }

  if (names.length === 2) {
    return `${names[0]} & ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

function pluralPeople(count) {
  return Number(count) === 1 ? "1 persoană" : `${count} persoane`;
}

function personCount(rsvp) {
  if (rsvp.responseType === "attend") {
    return Number(rsvp.guestCount || rsvp.guests?.length || 0);
  }

  return 1;
}

function getFilteredRsvps() {
  const query = searchInput.value.trim().toLowerCase();
  return allRsvps.filter((rsvp) => {
    const typeMatches = activeFilter === "all" || rsvp.responseType === activeFilter;
    const haystack = [
      rsvp.primaryName,
      rsvp.message,
      rsvp.responseType,
      ...(rsvp.guests || []).flatMap((guest) => [fullName(guest), guest.menu])
    ]
      .join(" ")
      .toLowerCase();
    return typeMatches && (!query || haystack.includes(query));
  });
}

function currentSelection(rsvps = getFilteredRsvps()) {
  if (!rsvps.length) return null;
  return rsvps.find((rsvp) => rsvp.id === selectedId) || rsvps[0];
}

function statusLabel(rsvp) {
  return rsvp.responseType === "attend" ? "Participă" : "Nu pot";
}

function renderStats() {
  const attendingResponses = allRsvps.filter((rsvp) => rsvp.responseType === "attend");
  const declinedResponses = allRsvps.filter((rsvp) => rsvp.responseType === "decline");
  const totalPeople = allRsvps.reduce((sum, rsvp) => sum + personCount(rsvp), 0);
  const attendingPeople = attendingResponses.reduce((sum, rsvp) => sum + personCount(rsvp), 0);
  const declinedPeople = declinedResponses.reduce((sum, rsvp) => sum + personCount(rsvp), 0);
  const menuCounts = attendingResponses
    .flatMap((rsvp) => rsvp.guests || [])
    .reduce((counts, guest) => {
      counts[guest.menu] = (counts[guest.menu] || 0) + 1;
      return counts;
    }, {});

  const cards = [
    { label: "Răspunsuri persoane", value: totalPeople, type: "total" },
    { label: "Participă", value: attendingPeople, type: "attend" },
    { label: "Nu pot", value: declinedPeople, type: "decline" },
    { label: "Meniu carne", value: menuCounts.Carne || 0, type: "menu" },
    { label: "Meniu vegetarian", value: menuCounts.Vegetarian || 0, type: "menu" },
    { label: "Meniu copii", value: menuCounts["Meniu de copii"] || 0, type: "menu" }
  ];

  statsGrid.innerHTML = cards
    .map(
      ({ label, value, type }) => `
        <article class="stat-card stat-${escapeHtml(type)}">
          <strong>${value}</strong>
          <span>${escapeHtml(label)}</span>
        </article>
      `
    )
    .join("");
}

function renderMenuOptions(selectedMenu = "") {
  return `
    <option value="" disabled ${selectedMenu ? "" : "selected"}>Alege meniul</option>
    ${menuOptions
      .map(
        (menu) => `
          <option value="${escapeHtml(menu)}" ${menu === selectedMenu ? "selected" : ""}>
            ${escapeHtml(menu)}
          </option>
        `
      )
      .join("")}
  `;
}

function renderEditGuestRow(guest = {}, index = 1, isAttend = true) {
  const removeButton =
    isAttend && index > 1
      ? '<button type="button" class="edit-row-remove" data-action="remove-guest">Șterge persoana</button>'
      : "";

  return `
    <section class="edit-guest-row" data-guest-row>
      <div class="edit-guest-head">
        <p>Persoana ${index}</p>
        ${removeButton}
      </div>
      <div class="form-row">
        <label>
          <span>Prenume</span>
          <input type="text" name="firstName" value="${escapeHtml(guest.firstName)}" required>
        </label>
        <label>
          <span>Nume</span>
          <input type="text" name="lastName" value="${escapeHtml(guest.lastName)}" required>
        </label>
      </div>
      ${
        isAttend
          ? `
            <label>
              <span>Meniu preferat</span>
              <select name="menu" required>${renderMenuOptions(guest.menu)}</select>
            </label>
          `
          : ""
      }
    </section>
  `;
}

function renderEditForm(rsvp) {
  const isAttend = rsvp.responseType === "attend";
  const guests = rsvp.guests?.length ? rsvp.guests : [{ firstName: "", lastName: "", menu: "" }];

  return `
    <form class="response-edit-form" data-edit-form data-id="${escapeHtml(rsvp.id)}">
      <input type="hidden" name="responseType" value="${isAttend ? "attend" : "decline"}">
      <div class="edit-form-title">Corectează răspunsul</div>
      <div class="edit-guests">
        ${guests.map((guest, index) => renderEditGuestRow(guest, index + 1, isAttend)).join("")}
      </div>
      ${
        isAttend
          ? '<button type="button" class="btn-quiet edit-add-guest" data-action="add-guest">Adaugă persoană</button>'
          : ""
      }
      <label>
        <span>Mesaj sau mențiuni speciale</span>
        <textarea name="message">${escapeHtml(rsvp.message)}</textarea>
      </label>
      <div class="edit-actions">
        <button type="submit" class="btn-primary">Salvează</button>
        <button type="button" class="btn-quiet" data-action="cancel-edit">Renunță</button>
      </div>
    </form>
  `;
}

function renderListItem(rsvp, selectedRsvp) {
  const guests = rsvp.guests || [];
  const count = personCount(rsvp);
  const menus = [...new Set(guests.map((guest) => guest.menu).filter(Boolean))];
  const active = selectedRsvp?.id === rsvp.id ? " active" : "";

  return `
    <button type="button" class="response-list-item${active}" data-select-rsvp="${escapeHtml(rsvp.id)}">
      <div class="response-list-name">${escapeHtml(groupNames(rsvp))}</div>
      <div class="response-list-date">${formatDate(rsvp.submittedAt)}</div>
      <div class="badges">
        <span class="badge ${escapeHtml(rsvp.responseType)}">${escapeHtml(statusLabel(rsvp))}</span>
        <span class="badge">${escapeHtml(pluralPeople(count))}</span>
        ${menus.length ? `<span class="badge warm">${escapeHtml(menus.join(", "))}</span>` : ""}
      </div>
    </button>
  `;
}

function renderDetailGuests(rsvp) {
  const guests = rsvp.guests?.length ? rsvp.guests : [{ firstName: "", lastName: "", menu: "" }];
  const isAttend = rsvp.responseType === "attend";

  return guests
    .map(
      (guest, index) => `
        <div class="admin-guest">
          <div class="admin-guest-name">${escapeHtml(fullName(guest) || `Invitat ${index + 1}`)}</div>
          <div class="admin-guest-menu">${escapeHtml(isAttend ? guest.menu || "Meniu nespecificat" : "Nu participă")}</div>
        </div>
      `
    )
    .join("");
}

function renderResponseDetails(rsvp) {
  if (!rsvp) {
    responseDetails.innerHTML = `
      <div class="response-detail-card">
        <div class="empty-state">Nu există răspunsuri pentru filtrul selectat.</div>
      </div>
    `;
    return;
  }

  const guests = rsvp.guests || [];
  const isAttend = rsvp.responseType === "attend";
  const isGroup = isAttend && guests.length > 1;
  const updatedLabel = rsvp.updatedAt ? ` · editat ${formatDate(rsvp.updatedAt)}` : "";
  const companions = guests.map(fullName).filter(Boolean).join(", ");

  responseDetails.innerHTML = `
    <article class="response-detail-card" data-rsvp-id="${escapeHtml(rsvp.id)}">
      <div class="admin-detail-top">
        <div>
          <div class="detail-eyebrow">Răspuns selectat</div>
          <div class="detail-name">${escapeHtml(groupNames(rsvp))}</div>
          <div class="detail-date">${formatDate(rsvp.submittedAt)}${updatedLabel}</div>
        </div>
        <div class="detail-actions">
          <mark class="${escapeHtml(rsvp.responseType)}">${escapeHtml(statusLabel(rsvp))}</mark>
          <div class="response-actions">
            <button type="button" data-action="edit" data-id="${escapeHtml(rsvp.id)}">Editează</button>
            <button type="button" data-action="delete" data-id="${escapeHtml(rsvp.id)}">Șterge</button>
          </div>
        </div>
      </div>

      ${
        editingId === rsvp.id
          ? renderEditForm(rsvp)
          : `
            <div class="detail-grid">
              <div class="detail-mini">
                <div class="mini-title">Persoane și meniuri</div>
                <div class="mini-sub">${escapeHtml(isAttend ? pluralPeople(personCount(rsvp)) : "Răspuns de neparticipare")}</div>
                ${renderDetailGuests(rsvp)}
              </div>

              <div class="detail-mini warm">
                <div class="mini-title">Mesajul lor</div>
                <div class="detail-message">${escapeHtml((rsvp.message || "").trim() || "Nu au lăsat un mesaj.")}</div>
              </div>
            </div>

            ${
              isGroup
                ? `<div class="companions"><strong>Vin împreună:</strong> ${escapeHtml(companions)}</div>`
                : ""
            }
          `
      }
    </article>
  `;
}

function renderResponses() {
  const rsvps = getFilteredRsvps();
  emptyState.classList.toggle("is-hidden", rsvps.length > 0);
  const selectedRsvp = currentSelection(rsvps);
  selectedId = selectedRsvp?.id || null;

  responsesList.innerHTML = rsvps.map((rsvp) => renderListItem(rsvp, selectedRsvp)).join("");
  renderResponseDetails(selectedRsvp);
}

async function fetchRsvps() {
  const response = await fetch("/api/rsvps");
  if (response.status === 401) {
    showLogin();
    return;
  }
  const data = await response.json();
  allRsvps = data.rsvps || [];
  showAdmin();
  renderStats();
  renderResponses();
}

function csvEscape(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = [
    ["Data", "Status", "Nume principal", "Numar persoane", "Invitati", "Meniuri", "Mesaj"]
  ];

  getFilteredRsvps().forEach((rsvp) => {
    rows.push([
      formatDate(rsvp.submittedAt),
      rsvp.responseType === "attend" ? "Participa" : "Nu pot",
      rsvp.primaryName,
      rsvp.guestCount || 0,
      (rsvp.guests || []).map(fullName).join("; "),
      (rsvp.guests || []).map((guest) => guest.menu).filter(Boolean).join("; "),
      rsvp.message || ""
    ]);
  });

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rsvp-edi-lorena.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function renumberEditRows(form) {
  form.querySelectorAll("[data-guest-row]").forEach((row, index) => {
    row.querySelector(".edit-guest-head p").textContent = `Persoana ${index + 1}`;
    const removeButton = row.querySelector("[data-action='remove-guest']");
    if (removeButton) removeButton.classList.toggle("is-hidden", index === 0);
  });
}

function collectEditPayload(form) {
  const responseType = form.elements.responseType.value;
  const message = form.elements.message.value;
  const rows = [...form.querySelectorAll("[data-guest-row]")].map((row) => ({
    firstName: row.querySelector("[name='firstName']").value.trim(),
    lastName: row.querySelector("[name='lastName']").value.trim(),
    menu: row.querySelector("[name='menu']")?.value || ""
  }));

  if (responseType === "decline") {
    return {
      responseType,
      firstName: rows[0]?.firstName || "",
      lastName: rows[0]?.lastName || "",
      message
    };
  }

  return {
    responseType,
    guests: rows,
    message
  };
}

function validateEditPayload(payload) {
  if (payload.responseType === "decline") {
    return payload.firstName && payload.lastName;
  }
  return payload.guests.length > 0 && payload.guests.every((guest) => guest.firstName && guest.lastName && guest.menu);
}

async function updateRsvp(id, payload) {
  const response = await fetch(`/api/rsvps/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Nu am putut salva modificările.");
  }
  return data.rsvp;
}

async function deleteRsvp(id) {
  const response = await fetch(`/api/rsvps/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Nu am putut șterge răspunsul.");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";

  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: document.getElementById("username").value,
      password: document.getElementById("password").value
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    loginError.textContent = data.message || "Nu te-am putut autentifica.";
    return;
  }

  await fetchRsvps();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  showLogin();
});

document.querySelectorAll(".filter-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    renderResponses();
  });
});

adminPanel.addEventListener("click", async (event) => {
  const selectedButton = event.target.closest("[data-select-rsvp]");
  if (selectedButton) {
    selectedId = selectedButton.dataset.selectRsvp;
    editingId = null;
    renderResponses();
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id || button.closest("[data-rsvp-id]")?.dataset.rsvpId;

  if (action === "edit") {
    editingId = id;
    selectedId = id;
    renderResponses();
    return;
  }

  if (action === "cancel-edit") {
    editingId = null;
    renderResponses();
    return;
  }

  if (action === "add-guest") {
    const form = button.closest("[data-edit-form]");
    const rows = form.querySelector(".edit-guests");
    const nextIndex = form.querySelectorAll("[data-guest-row]").length + 1;
    if (nextIndex > 8) {
      alert("Poți adăuga maximum 8 persoane.");
      return;
    }
    rows.insertAdjacentHTML("beforeend", renderEditGuestRow({}, nextIndex, true));
    renumberEditRows(form);
    return;
  }

  if (action === "remove-guest") {
    const form = button.closest("[data-edit-form]");
    if (form.querySelectorAll("[data-guest-row]").length <= 1) {
      alert("Trebuie să rămână cel puțin o persoană.");
      return;
    }
    button.closest("[data-guest-row]").remove();
    renumberEditRows(form);
    return;
  }

  if (action === "delete") {
    const rsvp = allRsvps.find((item) => item.id === id);
    const name = rsvp ? groupNames(rsvp) : "acest răspuns";
    if (!confirm(`Ștergi definitiv răspunsul pentru ${name}?`)) return;

    button.disabled = true;
    try {
      await deleteRsvp(id);
      allRsvps = allRsvps.filter((item) => item.id !== id);
      editingId = null;
      if (selectedId === id) selectedId = null;
      renderStats();
      renderResponses();
    } catch (error) {
      alert(error.message);
      button.disabled = false;
    }
  }
});

adminPanel.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-edit-form]");
  if (!form) return;

  event.preventDefault();
  const payload = collectEditPayload(form);
  if (!validateEditPayload(payload)) {
    alert("Completează numele și meniul pentru fiecare persoană.");
    return;
  }

  const submitButton = form.querySelector("[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Se salvează...";

  try {
    const updatedRsvp = await updateRsvp(form.dataset.id, payload);
    allRsvps = allRsvps.map((rsvp) => (rsvp.id === updatedRsvp.id ? updatedRsvp : rsvp));
    editingId = null;
    selectedId = updatedRsvp.id;
    renderStats();
    renderResponses();
  } catch (error) {
    alert(error.message);
    submitButton.disabled = false;
    submitButton.textContent = "Salvează";
  }
});

searchInput.addEventListener("input", renderResponses);
document.getElementById("exportBtn").addEventListener("click", exportCsv);

fetchRsvps();
