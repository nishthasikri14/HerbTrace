// routes/geo.js (CommonJS)
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;

// Where we'll store events locally (JSON file beside server.js)
const DB_PATH = path.resolve(__dirname, "..", "db.json");

// Ensure db.json exists and has the shape { "events": [] }
async function ensureDb() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ events: [] }, null, 2), "utf-8");
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !Array.isArray(data.events)) {
      return { events: [] };
    }
    return data;
  } catch {
    return { events: [] };
  }
}

async function writeDb(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

// POST /api/events -> save a geo event
// body: { batchId, role, context, latitude, longitude, accuracy }
router.post("/events", async (req, res) => {
  try {
    const { batchId, role, context, latitude, longitude, accuracy } = req.body || {};

    if (!batchId || latitude == null || longitude == null) {
      return res
        .status(400)
        .json({ ok: false, error: "batchId + latitude + longitude are required" });
    }

    const event = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      batchId: String(batchId),
      role: role ? String(role) : null,          // "farmer" | "processor" | "lab"
      context: context ? String(context) : null, // e.g., "harvested"
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy != null ? Number(accuracy) : null,
      ts: new Date().toISOString()
    };

    const db = await readDb();
    db.events.push(event);
    await writeDb(db);

    return res.json({ ok: true, event });
  } catch (e) {
    console.error("POST /api/events error:", e);
    return res.status(500).json({ ok: false, error: "internal save failed" });
  }
});

// GET /api/events?batchId=XYZ -> list events (sorted by time)
router.get("/events", async (req, res) => {
  try {
    const { batchId } = req.query;
    const db = await readDb();
    const list = db.events
      .filter(e => (batchId ? e.batchId === String(batchId) : true))
      .sort((a, b) => new Date(a.ts) - new Date(b.ts));

    return res.json({ ok: true, events: list });
  } catch (e) {
    console.error("GET /api/events error:", e);
    return res.status(500).json({ ok: false, error: "internal read failed" });
  }
});

module.exports = router;
