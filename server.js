const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_PATH = path.join(__dirname, "data.json");

const defaultState = {
  cars: [],
  people: [],
  trips: [],
  adjustments: [],
};

function readState() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.writeFileSync(DATA_PATH, JSON.stringify(defaultState, null, 2), "utf8");
      return { ...defaultState };
    }
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw || "{}");
    return {
      cars: parsed.cars || [],
      people: parsed.people || [],
      trips: parsed.trips || [],
      adjustments: parsed.adjustments || [],
    };
  } catch (e) {
    console.error("Failed to read data.json", e);
    return { ...defaultState };
  }
}

function writeState(state) {
  const safe = {
    cars: Array.isArray(state.cars) ? state.cars : [],
    people: Array.isArray(state.people) ? state.people : [],
    trips: Array.isArray(state.trips) ? state.trips : [],
    adjustments: Array.isArray(state.adjustments) ? state.adjustments : [],
  };
  fs.writeFileSync(DATA_PATH, JSON.stringify(safe, null, 2), "utf8");
}

app.use(express.json());

// API
app.get("/api/state", (req, res) => {
  const state = readState();
  res.json(state);
});

app.put("/api/state", (req, res) => {
  try {
    writeState(req.body || {});
    res.status(204).end();
  } catch (e) {
    console.error("Failed to write state", e);
    res.status(500).json({ error: "Failed to save state" });
  }
});

// Static frontend
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Carpool backend running at http://localhost:${PORT}`);
});

