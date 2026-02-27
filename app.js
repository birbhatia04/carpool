// Backend helpers
async function fetchState() {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("Bad response");
    const data = await res.json();
    return {
      cars: data.cars ?? [],
      people: data.people ?? [],
      trips: data.trips ?? [],
      adjustments: data.adjustments ?? [],
    };
  } catch {
    return { cars: [], people: [], trips: [], adjustments: [] };
  }
}

function saveState() {
  // Fire-and-forget; UI stays responsive even if backend is a bit slow
  fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cars: state.cars,
      people: state.people,
      trips: state.trips,
      adjustments: state.adjustments,
    }),
  }).catch(() => {
    // Ignore network errors for now
  });
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const state = { cars: [], people: [], trips: [], adjustments: [] };

// DOM references
const tabsContainer = document.getElementById("nav-tabs");
const tabPanels = document.querySelectorAll(".tab-panel");

const tripForm = document.getElementById("trip-form");
const tripDateInput = document.getElementById("trip-date");
const tripCarSelect = document.getElementById("trip-car");
const tripDriverSelect = document.getElementById("trip-driver");
const tripPassengersContainer = document.getElementById("trip-passengers");
const tripList = document.getElementById("trip-list");
const tripFilterCar = document.getElementById("trip-filter-car");
const calendarGrid = document.getElementById("calendar-grid");
const calendarMonthLabel = document.getElementById("calendar-month-label");
const calendarPrev = document.getElementById("calendar-prev");
const calendarNext = document.getElementById("calendar-next");

const carForm = document.getElementById("car-form");
const carNameInput = document.getElementById("car-name");
const carFuelSelect = document.getElementById("car-fuel");
const carList = document.getElementById("car-list");

const personForm = document.getElementById("person-form");
const personNameInput = document.getElementById("person-name");
const ratesWrapper = document.getElementById("rates-table-wrapper");

const balancePersonFilter = document.getElementById("balance-person-filter");
const balanceList = document.getElementById("balance-list");

const adjustmentForm = document.getElementById("adjustment-form");
const adjustCarSelect = document.getElementById("adjust-car");
const adjustPersonSelect = document.getElementById("adjust-person");
const adjustAmountInput = document.getElementById("adjust-amount");
const adjustNoteInput = document.getElementById("adjust-note");
const adjustmentList = document.getElementById("adjustment-list");

const resetButton = document.getElementById("reset-data");

// Calendar state
let currentCalendarMonth = new Date();
currentCalendarMonth.setDate(1);

// Tabs
tabsContainer.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;

  const tabId = btn.dataset.tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t === btn));

  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });
});

// Rendering helpers
function renderCarOptions(selectEl, includePlaceholder = true) {
  const prevValue = selectEl.value;
  selectEl.innerHTML = "";
  if (includePlaceholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Select car";
    selectEl.appendChild(opt);
  }
  state.cars.forEach((car) => {
    const opt = document.createElement("option");
    opt.value = car.id;
    opt.textContent = car.name;
    selectEl.appendChild(opt);
  });
  if ([...selectEl.options].some((o) => o.value === prevValue)) {
    selectEl.value = prevValue;
  }
}

function renderPeopleOptions(selectEl, includePlaceholder = true) {
  const prevValue = selectEl.value;
  selectEl.innerHTML = "";
  if (includePlaceholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Select person";
    selectEl.appendChild(opt);
  }
  state.people.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    selectEl.appendChild(opt);
  });
  if ([...selectEl.options].some((o) => o.value === prevValue)) {
    selectEl.value = prevValue;
  }
}

function renderPassengerChips() {
  tripPassengersContainer.innerHTML = "";
  if (state.people.length === 0) {
    tripPassengersContainer.classList.add("empty-state");
    tripPassengersContainer.innerHTML =
      '<p class="muted small">Add people to select passengers.</p>';
    return;
  }

  tripPassengersContainer.classList.remove("empty-state");
  state.people.forEach((person) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.personId = person.id;
    chip.innerHTML = `<span class="chip-label">${person.name}</span>`;
    chip.addEventListener("click", () => {
      chip.classList.toggle("selected");
    });
    tripPassengersContainer.appendChild(chip);
  });
}

function formatDate(dStr) {
  if (!dStr) return "";
  const d = new Date(dStr);
  if (Number.isNaN(d.getTime())) return dStr;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  const num = Number(value) || 0;
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDateTime(d) {
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Calendar
function renderCalendar() {
  if (!calendarGrid || !calendarMonthLabel) return;

  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();

  const monthName = currentCalendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  calendarMonthLabel.textContent = monthName;

  calendarGrid.innerHTML = "";

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  dayNames.forEach((name) => {
    const header = document.createElement("div");
    header.className = "calendar-cell-header";
    header.textContent = name;
    calendarGrid.appendChild(header);
  });

  const firstDayOfMonth = new Date(year, month, 1);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const totalCells = 42;

  const today = new Date();
  const isSameDate = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const tripsByDate = {};
  state.trips.forEach((trip) => {
    if (!trip.date) return;
    tripsByDate[trip.date] = (tripsByDate[trip.date] || 0) + 1;
  });

  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-cell";

    let dateObj;
    let displayDay;
    let otherMonth = false;

    if (i < startDay) {
      const day = prevMonthDays - (startDay - 1 - i);
      dateObj = new Date(year, month - 1, day);
      displayDay = day;
      otherMonth = true;
    } else if (i >= startDay + daysInMonth) {
      const day = i - (startDay + daysInMonth) + 1;
      dateObj = new Date(year, month + 1, day);
      displayDay = day;
      otherMonth = true;
    } else {
      const day = i - startDay + 1;
      dateObj = new Date(year, month, day);
      displayDay = day;
    }

    // Build a local-date string (avoid time-zone shift from toISOString)
    const iso = [
      dateObj.getFullYear(),
      String(dateObj.getMonth() + 1).padStart(2, "0"),
      String(dateObj.getDate()).padStart(2, "0"),
    ].join("-");
    const hasTrip = Boolean(tripsByDate[iso]);

    if (otherMonth) {
      cell.classList.add("other-month");
    }
    if (isSameDate(dateObj, today)) {
      cell.classList.add("today");
    }
    if (hasTrip) {
      cell.classList.add("has-trip");
    }

    const dayNumber = document.createElement("div");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = displayDay;
    cell.appendChild(dayNumber);

    if (hasTrip) {
      const dot = document.createElement("div");
      dot.className = "calendar-trip-dot";
      cell.appendChild(dot);
    }

    cell.addEventListener("click", () => {
      tripDateInput.value = iso;
      renderTrips();
    });

    calendarGrid.appendChild(cell);
  }
}

if (calendarPrev && calendarNext) {
  calendarPrev.addEventListener("click", () => {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() - 1);
    renderCalendar();
  });
  calendarNext.addEventListener("click", () => {
    currentCalendarMonth.setMonth(currentCalendarMonth.getMonth() + 1);
    renderCalendar();
  });
}

// Trips
tripForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!tripDateInput.value || !tripCarSelect.value || !tripDriverSelect.value) {
    return;
  }
  const carId = tripCarSelect.value;
  const driverId = tripDriverSelect.value;

  const passengerIds = [...tripPassengersContainer.querySelectorAll(".chip")]
    .filter((chip) => chip.classList.contains("selected"))
    .map((chip) => chip.dataset.personId)
    .filter((id) => id !== driverId);

  const trip = {
    id: uid(),
    date: tripDateInput.value,
    carId,
    driverId,
    passengerIds,
  };
  state.trips.push(trip);
  saveState();
  renderAll();

  tripForm.reset();
  tripPassengersContainer
    .querySelectorAll(".chip")
    .forEach((chip) => chip.classList.remove("selected"));
});

function renderTrips() {
  renderCarOptions(tripFilterCar, true);

  if (state.trips.length === 0) {
    tripList.classList.add("empty-state");
    tripList.innerHTML =
      '<p class="muted">No trips yet. Add your first trip on the left.</p>';
    return;
  }
  tripList.classList.remove("empty-state");

  const filteredCarId = tripFilterCar.value || null;
  const trips = [...state.trips]
    .filter((t) => !filteredCarId || t.carId === filteredCarId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (trips.length === 0) {
    tripList.classList.add("empty-state");
    tripList.innerHTML =
      '<p class="muted">No trips yet for this filter.</p>';
    return;
  }

  tripList.innerHTML = "";
  trips.forEach((trip) => {
    const car = state.cars.find((c) => c.id === trip.carId);
    const driver = state.people.find((p) => p.id === trip.driverId);
    const passengers = trip.passengerIds
      .map((id) => state.people.find((p) => p.id === id))
      .filter(Boolean);

    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div>
        <div class="list-item-header">
          <span>${formatDate(trip.date)}</span>
          ${
            car
              ? `<span class="badge car">${car.name}</span>`
              : '<span class="badge car">Unknown car</span>'
          }
        </div>
        <div class="list-item-meta">
          <span>Driver: ${driver ? driver.name : "Unknown"}</span>
          <span>Passengers: ${
            passengers.length
              ? passengers.map((p) => p.name).join(", ")
              : "None"
          }</span>
        </div>
      </div>
      <div class="list-item-amount">
        <button class="btn subtle small-btn" data-trip-id="${trip.id}">Remove</button>
      </div>
    `;
    el
      .querySelector("button[data-trip-id]")
      .addEventListener("click", () => deleteTrip(trip.id));
    tripList.appendChild(el);
  });
}

function deleteTrip(id) {
  const idx = state.trips.findIndex((t) => t.id === id);
  if (idx === -1) return;
  state.trips.splice(idx, 1);
  saveState();
  renderAll();
}

tripFilterCar.addEventListener("change", renderTrips);

// Cars
carForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!carNameInput.value.trim() || !carFuelSelect.value) return;

  const car = {
    id: uid(),
    name: carNameInput.value.trim(),
    fuelType: carFuelSelect.value,
  };
  state.cars.push(car);

  // Initialize rates for this car for all people
  state.people.forEach((p) => {
    if (!p.rates) p.rates = {};
    if (p.rates[car.id] == null) p.rates[car.id] = 0;
  });

  saveState();
  carForm.reset();
  renderAll();
});

function renderCars() {
  if (state.cars.length === 0) {
    carList.classList.add("empty-state");
    carList.innerHTML =
      '<p class="muted">No cars yet. Add your first car on the left.</p>';
    return;
  }
  carList.classList.remove("empty-state");
  carList.innerHTML = "";

  state.cars.forEach((car) => {
    const el = document.createElement("div");
    el.className = "list-item";
    el.innerHTML = `
      <div>
        <div class="list-item-header">
          <span>${car.name}</span>
        </div>
        <div class="list-item-meta">
          <span class="badge fuel">Fuel: ${car.fuelType}</span>
        </div>
      </div>
      <div class="list-item-amount">
        <button class="btn subtle small-btn" data-car-id="${car.id}">Remove</button>
      </div>
    `;
    el.querySelector("button[data-car-id]").addEventListener("click", () => {
      deleteCar(car.id);
    });
    carList.appendChild(el);
  });

  renderCarOptions(tripCarSelect);
  renderCarOptions(tripFilterCar, true);
  renderPeopleOptions(balancePersonFilter, true);
  renderCarOptions(adjustCarSelect, true);
}

function deleteCar(id) {
  // Remove car, its trips, and any rates
  state.cars = state.cars.filter((c) => c.id !== id);
  state.trips = state.trips.filter((t) => t.carId !== id);
  state.people.forEach((p) => {
    if (p.rates) {
      delete p.rates[id];
    }
  });
  saveState();
  renderAll();
}

// People & rates
personForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!personNameInput.value.trim()) return;
  const person = {
    id: uid(),
    name: personNameInput.value.trim(),
    rates: {},
  };
  state.cars.forEach((c) => {
    person.rates[c.id] = 0;
  });
  state.people.push(person);
  saveState();
  personForm.reset();
  renderAll();
});

function renderRatesTable() {
  if (state.cars.length === 0 || state.people.length === 0) {
    ratesWrapper.classList.add("empty-state");
    ratesWrapper.innerHTML =
      '<p class="muted">Add at least one car and one person to start setting rates.</p>';
    return;
  }

  ratesWrapper.classList.remove("empty-state");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headerRow.innerHTML = `<th>Person</th>`;
  state.cars.forEach((car) => {
    const th = document.createElement("th");
    th.textContent = car.name;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  state.people.forEach((person) => {
    if (!person.rates) person.rates = {};
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.textContent = person.name;
    row.appendChild(nameCell);

    state.cars.forEach((car) => {
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.className = "rate-input";
      input.value = person.rates[car.id] ?? 0;
      input.addEventListener("change", () => {
        person.rates[car.id] = Number(input.value) || 0;
        saveState();
        renderBalances();
      });
      cell.appendChild(input);
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  ratesWrapper.innerHTML = "";
  ratesWrapper.appendChild(table);

  renderPeopleOptions(tripDriverSelect);
  renderPeopleOptions(adjustPersonSelect);
  renderPassengerChips();
}

// Balances
function computeBalances() {
  // balances[carId][personId] = amount (positive = amount they owe for that car)
  const balances = {};
  state.cars.forEach((car) => {
    balances[car.id] = {};
    state.people.forEach((p) => {
      balances[car.id][p.id] = 0;
    });
  });

  state.trips.forEach((trip) => {
    const car = state.cars.find((c) => c.id === trip.carId);
    if (!car) return;

    trip.passengerIds.forEach((pid) => {
      const passenger = state.people.find((p) => p.id === pid);
      if (!passenger) return;
      const rate =
        (passenger.rates && passenger.rates[trip.carId] != null
          ? passenger.rates[trip.carId]
          : 0) || 0;
      // Each listed person simply owes their rate for this car.
      balances[trip.carId][pid] += rate;
    });
  });

  // Apply manual adjustments
  (state.adjustments || []).forEach((adj) => {
    if (!balances[adj.carId] || balances[adj.carId][adj.personId] == null) {
      return;
    }
    balances[adj.carId][adj.personId] += adj.amount;
  });

  return balances;
}

function renderBalances() {
  const balances = computeBalances();
  renderPeopleOptions(balancePersonFilter, true);

  const selectedPersonId = balancePersonFilter.value || null;
  const entries = [];

  if (selectedPersonId) {
    const person = state.people.find((p) => p.id === selectedPersonId);
    if (person) {
      state.cars.forEach((car) => {
        const amount = balances[car.id]?.[selectedPersonId] ?? 0;
        if (Math.abs(amount) < 0.5) return;
        entries.push({ car, person, amount });
      });
    }
  } else {
    // All people, all cars
    state.cars.forEach((car) => {
      const map = balances[car.id];
      if (!map) return;
      Object.entries(map).forEach(([personId, amount]) => {
        const person = state.people.find((p) => p.id === personId);
        if (!person) return;
        if (Math.abs(amount) < 0.5) return;
        entries.push({ car, person, amount });
      });
    });
  }

  if (entries.length === 0) {
    balanceList.classList.add("empty-state");
    balanceList.innerHTML =
      '<p class="muted">No dues to show yet. Add trips or manual adjustments to see amounts here.</p>';
    return;
  }

  balanceList.classList.remove("empty-state");
  balanceList.innerHTML = "";

  entries
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .forEach(({ car, person, amount }) => {
      const owes = amount > 0;
      const el = document.createElement("div");
      el.className = "list-item";

      const status =
        owes && amount > 0
          ? `<span class="badge owes">Owes ${formatCurrency(amount)}</span>`
          : `<span class="badge credit">Is owed ${formatCurrency(
              Math.abs(amount)
            )}</span>`;

      el.innerHTML = `
        <div>
          <div class="list-item-header">
            <span>${person.name}</span>
            <span class="badge car">${car.name}</span>
          </div>
          <div class="list-item-meta">
            ${status}
          </div>
        </div>
        <div class="list-item-amount">
          <span>${amount > 0 ? "Due" : "Credit"}</span><br/>
          <strong>${formatCurrency(Math.abs(amount))}</strong>
        </div>
      `;
      balanceList.appendChild(el);
    });
}

balancePersonFilter.addEventListener("change", renderBalances);

// Manual adjustments
if (adjustmentForm) {
  adjustmentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!adjustCarSelect.value || !adjustPersonSelect.value || !adjustAmountInput.value) {
      return;
    }
    const adj = {
      id: uid(),
      carId: adjustCarSelect.value,
      personId: adjustPersonSelect.value,
      amount: Number(adjustAmountInput.value) || 0,
      note: adjustNoteInput.value.trim() || "",
      createdAt: new Date().toISOString(),
    };
    if (!state.adjustments) state.adjustments = [];
    state.adjustments.unshift(adj);
    saveState();
    adjustmentForm.reset();
    renderAll();
  });
}

function renderAdjustments() {
  if (!adjustmentList) return;
  const adjustments = state.adjustments || [];
  if (adjustments.length === 0) {
    adjustmentList.classList.add("empty-state");
    adjustmentList.innerHTML =
      '<p class="muted small">No manual adjustments yet.</p>';
    return;
  }
  adjustmentList.classList.remove("empty-state");
  adjustmentList.innerHTML = "";

  adjustments.slice(0, 20).forEach((adj) => {
    const car = state.cars.find((c) => c.id === adj.carId);
    const person = state.people.find((p) => p.id === adj.personId);
    const when = adj.createdAt ? new Date(adj.createdAt) : null;
    const el = document.createElement("div");
    el.className = "list-item";
    const owes = adj.amount > 0;
    el.innerHTML = `
      <div>
        <div class="list-item-header">
          <span>${person ? person.name : "Unknown person"}</span>
          ${car ? `<span class="badge car">${car.name}</span>` : ""}
        </div>
        <div class="list-item-meta">
          <span>${when ? formatDateTime(when) : ""}</span>
          ${adj.note ? `<span>· ${adj.note}</span>` : ""}
        </div>
      </div>
      <div class="list-item-amount">
        <span>${owes ? "Added Due" : "Added Credit"}</span><br/>
        <strong>${formatCurrency(Math.abs(adj.amount))}</strong>
      </div>
    `;
    adjustmentList.appendChild(el);
  });
}

// Reset data
resetButton.addEventListener("click", () => {
  const ok = confirm(
    "This will remove all cars, people, rates and trips from this browser. Continue?"
  );
  if (!ok) return;
  state.cars = [];
  state.people = [];
  state.trips = [];
  state.adjustments = [];
  saveState();
  renderAll();
});

function renderAll() {
  renderCars();
  renderRatesTable();
  renderTrips();
  renderBalances();
  renderCalendar();
  renderAdjustments();
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  const loaded = await fetchState();
  state.cars = loaded.cars;
  state.people = loaded.people;
  state.trips = loaded.trips;
  state.adjustments = loaded.adjustments;
  renderAll();
});

