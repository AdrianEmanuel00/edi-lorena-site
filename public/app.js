const weddingDate = new Date("2026-09-13T15:00:00+03:00");

const nav = document.getElementById("siteNav");
const rsvpFlow = document.getElementById("rsvpFlow");
const rsvpChoiceGrid = document.getElementById("rsvpChoiceGrid");
const rsvpCountPanel = document.getElementById("rsvpCountPanel");
const rsvpForm = document.getElementById("rsvpForm");
const responseType = document.getElementById("responseType");
const declineFields = document.getElementById("declineFields");
const attendFields = document.getElementById("attendFields");
const guestRows = document.getElementById("guestRows");
const guestCount = document.getElementById("guestCount");
const successMsg = document.getElementById("successMsg");
const submitRsvp = document.getElementById("submitRsvp");
const pickAttendInline = document.getElementById("pickAttendInline");
const pickDeclineInline = document.getElementById("pickDeclineInline");
const countContinueInline = document.getElementById("countContinueInline");
const countBackInline = document.getElementById("countBackInline");

function pad(value, size) {
  return String(value).padStart(size, "0");
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

function resetChoiceState() {
  pickAttendInline.classList.remove("is-selected");
  pickDeclineInline.classList.remove("is-selected");
}

function showChoiceStep() {
  resetChoiceState();
  rsvpFlow.classList.remove("is-answering");
  rsvpChoiceGrid.classList.remove("is-hidden");
  rsvpCountPanel.classList.add("is-hidden");
  rsvpForm.classList.add("is-hidden");
  declineFields.classList.add("is-hidden");
  attendFields.classList.add("is-hidden");
  guestRows.innerHTML = "";
  responseType.value = "";
}

function showCountStep() {
  resetChoiceState();
  pickAttendInline.classList.add("is-selected");
  rsvpFlow.classList.add("is-answering");
  rsvpChoiceGrid.classList.add("is-hidden");
  rsvpCountPanel.classList.remove("is-hidden");
  rsvpForm.classList.add("is-hidden");
}

function showForm(type) {
  resetChoiceState();
  responseType.value = type;
  rsvpFlow.classList.add("is-answering");
  rsvpChoiceGrid.classList.add("is-hidden");
  rsvpCountPanel.classList.add("is-hidden");
  rsvpForm.classList.remove("is-hidden");

  if (type === "decline") {
    pickDeclineInline.classList.add("is-selected");
    declineFields.classList.remove("is-hidden");
    attendFields.classList.add("is-hidden");
    return;
  }

  pickAttendInline.classList.add("is-selected");
  renderGuestRows(Number(guestCount.value || 1));
  declineFields.classList.add("is-hidden");
  attendFields.classList.remove("is-hidden");
}

function renderGuestRows(count) {
  guestRows.innerHTML = "";
  for (let index = 1; index <= count; index += 1) {
    const block = document.createElement("section");
    block.className = "guest-block";
    block.innerHTML = `
      <p>Persoana ${index}</p>
      <div class="form-row">
        <label>
          <span>Prenume</span>
          <input type="text" name="guest_${index}_firstName" autocomplete="given-name" required>
        </label>
        <label>
          <span>Nume</span>
          <input type="text" name="guest_${index}_lastName" autocomplete="family-name" required>
        </label>
      </div>
      <label>
        <span>Meniu preferat</span>
        <select name="guest_${index}_menu" required>
          <option value="" disabled selected>Alege meniul</option>
          <option value="Carne">Carne</option>
          <option value="Vegetarian">Vegetarian</option>
          <option value="Meniu de copii">Meniu de copii</option>
        </select>
      </label>
    `;
    guestRows.appendChild(block);
  }
}

function collectPayload() {
  if (responseType.value === "decline") {
    return {
      responseType: "decline",
      firstName: document.getElementById("declineFirstName").value,
      lastName: document.getElementById("declineLastName").value,
      message: document.getElementById("declineMessage").value
    };
  }

  const guests = [...guestRows.querySelectorAll(".guest-block")].map((block) => ({
    firstName: block.querySelector("[name$='_firstName']").value,
    lastName: block.querySelector("[name$='_lastName']").value,
    menu: block.querySelector("[name$='_menu']").value
  }));

  return {
    responseType: "attend",
    guests,
    message: document.getElementById("attendMessage").value
  };
}

function validatePayload(payload) {
  if (payload.responseType === "decline") {
    return payload.firstName.trim() && payload.lastName.trim();
  }
  return payload.guests.every(
    (guest) => guest.firstName.trim() && guest.lastName.trim() && guest.menu.trim()
  );
}

async function sendRsvp(payload) {
  const response = await fetch("/api/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Nu am putut trimite confirmarea.");
  }
  return data;
}

window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 80);
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

pickAttendInline.addEventListener("click", showCountStep);
pickDeclineInline.addEventListener("click", () => showForm("decline"));
countBackInline.addEventListener("click", showChoiceStep);
countContinueInline.addEventListener("click", () => showForm("attend"));
document.getElementById("changeRsvp").addEventListener("click", () => {
  rsvpForm.reset();
  showChoiceStep();
});

rsvpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = collectPayload();
  if (!validatePayload(payload)) {
    alert("Vă rugăm să completați toate câmpurile obligatorii.");
    return;
  }

  submitRsvp.disabled = true;
  submitRsvp.textContent = "Se trimite...";

  try {
    await sendRsvp(payload);
    rsvpFlow.classList.add("is-hidden");
    successMsg.classList.add("is-visible");
  } catch (error) {
    alert(error.message);
  } finally {
    submitRsvp.disabled = false;
    submitRsvp.textContent = "Trimite confirmarea";
  }
});

updateCountdown();
setInterval(updateCountdown, 1000);
