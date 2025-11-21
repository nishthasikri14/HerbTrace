'use strict';
require('dotenv').config();    

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const bcrypt = require('bcrypt'); // make sure to install via npm
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const cors = require('cors');
const { ethers } = require('ethers'); // ✅ NEW: for Ganache on-chain tx

let pinataHelper = null;
try { pinataHelper = require('./pinataHelper'); } catch (e) { /* optional */ }

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRET_KEY = process.env.SECRET_KEY || 'supersecret'; // change in prod
const LOCAL_DB_PATH = path.join(__dirname, 'localDB.json');

// ---------- DB helpers ----------
function loadDB() {
  if (fs.existsSync(LOCAL_DB_PATH)) return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
  return {};
}
function saveDB(db) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2));
}
function generateBatchId() {
  const ts = Date.now().toString(36);
  const rnd = Math.floor(Math.random() * 9000 + 1000).toString(36);
  return `BATCH-${ts}-${rnd}`.toUpperCase();
}

// ---- Geo helpers ----
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function addEvent(db, batchId, event) {
  db[batchId] = db[batchId] || [];
  db[batchId].push(event);
}
function hasGeo(e) {
  return e && toNum(e.lat) != null && toNum(e.long) != null;
}

// ---------- Demo Users ----------
const users = [
  { username: "farmer1", password: bcrypt.hashSync("1234", 10), role: "farmer" },
  { username: "processor1", password: bcrypt.hashSync("1234", 10), role: "processor" },
  { username: "lab1", password: bcrypt.hashSync("1234", 10), role: "lab" }
];

// ---------- Immutable Profiles (server-enforced) ----------
const FARMER_PROFILES = {
  farmer1: { collectorName: 'Gurpreet Singh', farmLocation: 'Moga, Punjab' },
  // add other farmer profiles here
};

const PROCESSOR_PROFILES = {
  processor1: {
    managerName: 'Rajesh Kumar',
    facility: 'Punjab Herb Processing Plant',
    facilityLocation: 'Ludhiana, Punjab'
  }
  // add other processor profiles here
};

const LAB_PROFILES = {
  lab1: {
    labName: 'Punjab Quality Labs',
    labManagerName: 'Dr. Meera Arora',
    labLocation: 'Amritsar, Punjab'
  }
  // add other lab profiles here
};

// ---------- Serve Frontend ----------
const FRONTEND_PATH = path.join(__dirname, 'frontend');
app.use(express.static(FRONTEND_PATH));
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_PATH, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(FRONTEND_PATH, 'login.html')));
app.get('/consumer', (req, res) => res.sendFile(path.join(FRONTEND_PATH, 'consumer.html')));
app.get('/qr', (req, res) => res.sendFile(path.join(FRONTEND_PATH, 'qr.html')));

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }
  const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '4h' });
  res.json({ ok: true, token, role: user.role });
});

function authRole(roles) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ ok: false, error: 'No token' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, SECRET_KEY, (err, user) => {
      if (err) return res.status(403).json({ ok: false, error: 'Invalid token' });
      if (!roles.includes(user.role)) return res.status(403).json({ ok: false, error: 'Access denied' });
      req.user = user;
      next();
    });
  };
}

// ---------- Farmer ----------
app.post('/api/farmer/add-herb', authRole(['farmer']), upload.single('image'), async (req, res) => {
  try {
    const { species, otherSpecies, quality, lat, long } = req.body;
    let herb = species;
    if (species === 'other') herb = otherSpecies || 'Unknown';

    const batchId = generateBatchId();
    const timestamp = Date.now();

    let imageLink = null;
    if (req.file && pinataHelper) {
      try {
        const hash = await pinataHelper.uploadFile(req.file.path);
        if (hash) imageLink = `https://gateway.pinata.cloud/ipfs/${hash}`;
      } catch (e) { console.error('IPFS image upload failed', e); }
    }
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    // Inject immutable farmer details
    const farmerProfile = FARMER_PROFILES[req.user.username] || {};
    const collectorName = farmerProfile.collectorName || 'Unknown Farmer';
    const farmLocation = farmerProfile.farmLocation || 'Unknown Location';

    const db = loadDB();
    const event = {
      type: 'collection',
      batchId,
      collector: collectorName,       // immutable
      farmLocation,                   // immutable
      species: herb,
      quality,
      lat: toNum(lat),
      long: toNum(long),
      imageLink,
      farmer: req.user.username,
      timestamp,
      status: 'pending'
    };
    addEvent(db, batchId, event);
    saveDB(db);

    // ---------- Real On-chain Ganache txn (Farmer) ----------
    try {
      const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
      const signer = new ethers.Wallet(
        process.env.GANACHE_PK,
        provider
      );

      const tx = await signer.sendTransaction({
        to: signer.address, // self tx, just to get a tx hash
        value: 0,
        data: ethers.utils.toUtf8Bytes(JSON.stringify({
          batchId,
          eventType: 'CollectionEvent',
          payload: event
        }))
      });

      await tx.wait();

      const ganacheTx = {
        batchId,
        eventType: 'CollectionEvent',
        payload: event,
        txHash: tx.hash,
        timestamp
      };
      console.log('On-chain transaction (farmer):', ganacheTx);
      addEvent(db, batchId, { type: 'onchain', ...ganacheTx });
      saveDB(db);
    } catch (err) { console.error('On-chain transaction failed (farmer)', err); }

    res.json({ ok: true, batchId, event });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ ok: false, error: 'Server error' }); 
  }
});

// ---------- Processor ----------
app.get('/api/processor/dashboard', authRole(['processor']), (req, res) => {
  const db = loadDB();
  const pending = [];
  Object.keys(db).forEach(batchId => {
    db[batchId].forEach(e => {
      if (e.type === 'collection' && e.status === 'pending') pending.push({ batchId, ...e });
    });
  });
  res.json({ ok: true, pending });
});

app.post('/api/processor/process', authRole(['processor']), async (req, res) => {
  const { batchId, processType, lat, long } = req.body; // facility fields ignored (server-enforced)
  const db = loadDB();
  if (!db[batchId]) return res.status(400).json({ ok: false, error: 'Batch not found' });

  // Inject immutable processor details
  const p = PROCESSOR_PROFILES[req.user.username] || {};
  const facility = p.facility || 'Unknown Facility';
  const facilityLocation = p.facilityLocation || 'Unknown Location';
  const managerName = p.managerName || 'Unknown Manager';

  const timestamp = Date.now();
  const event = {
    type: 'processing',
    batchId,
    facility,             // immutable
    facilityLocation,     // immutable
    managerName,          // immutable
    processType,
    processor: req.user.username,
    lat: toNum(lat),    // optional geo
    long: toNum(long),  // optional geo
    timestamp,
    status: 'processed'
  };
  addEvent(db, batchId, event);
  db[batchId].forEach(e => { if (e.type === 'collection') e.status = 'processed'; });
  saveDB(db);

  // ---------- Real On-chain txn (Processor) ----------
  try {
    const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
    const signer = new ethers.Wallet(
      process.env.GANACHE_PK,
      provider
    );

    const tx = await signer.sendTransaction({
      to: signer.address,
      value: 0,
      data: ethers.utils.toUtf8Bytes(JSON.stringify({
        batchId,
        eventType: 'ProcessingEvent',
        payload: event
      }))
    });

    await tx.wait();

    const ganacheTx = {
      batchId,
      eventType: 'ProcessingEvent',
      payload: event,
      txHash: tx.hash,
      timestamp
    };
    console.log('On-chain transaction (processor):', ganacheTx);
    addEvent(db, batchId, { type: 'onchain', ...ganacheTx });
    saveDB(db);
  } catch (err) {
    console.error('On-chain transaction failed (processor)', err);
  }

  res.json({ ok: true, event });
});

// ---------- Lab ----------
app.get('/api/lab/dashboard', authRole(['lab']), (req, res) => {
  const db = loadDB();
  const pending = [];
  Object.keys(db).forEach(batchId => {
    const events = db[batchId];
    const last = events[events.length - 1];
let checked = last;

// If last is on-chain event, check the actual previous business event
if (last.type === 'onchain' && events.length >= 2) {
  checked = events[events.length - 2];
}

if (checked.status === 'processed') {
  pending.push({ batchId, ...checked });
}

  });
  res.json({ ok: true, pending });
});

app.post('/api/lab/upload-report', authRole(['lab']), upload.single('file'), async (req, res) => {
  const { batchId, resultStatus } = req.body; // lab fields ignored (server-enforced)
  if (!req.file) return res.status(400).json({ ok: false, error: 'File missing' });

  const db = loadDB();
  if (!db[batchId]) return res.status(400).json({ ok: false, error: 'Batch not found' });

  // Immutable lab profile
  const lp = LAB_PROFILES[req.user.username] || {};
  const labName = lp.labName || 'Unknown Lab';
  const labManagerName = lp.labManagerName || 'Unknown Manager';
  const labLocation = lp.labLocation || 'Unknown Location';

  let ipfsLink = null;
  if (pinataHelper) {
    try {
      const hash = await pinataHelper.uploadFile(req.file.path);
      if (hash) ipfsLink = `https://gateway.pinata.cloud/ipfs/${hash}`;
    } catch (e) { console.error('IPFS lab upload failed', e); }
  }
  if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

  const timestamp = Date.now();
  const event = {
    type: 'quality',
    batchId,
    labName,            // immutable
    labManagerName,     // immutable
    labLocation,        // immutable
    resultStatus,
    ipfsLink,
    lat: toNum(req.body.lat),   // optional geo
    long: toNum(req.body.long), // optional geo
    lab: req.user.username,
    timestamp,
    status: 'tested'
  };
  addEvent(db, batchId, event);
  saveDB(db);

  // ---------- Real On-chain  txn (Lab) ----------
  try {
    const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
    const signer = new ethers.Wallet(
      process.env.GANACHE_PK,
      provider
    );

    const tx = await signer.sendTransaction({
      to: signer.address,
      value: 0,
      data: ethers.utils.toUtf8Bytes(JSON.stringify({
        batchId,
        eventType: 'QualityEvent',
        payload: event
      }))
    });

    await tx.wait();

    const ganacheTx = {
      batchId,
      eventType: 'QualityEvent',
      payload: event,
      txHash: tx.hash,
      timestamp
    };
    console.log('On-chain transaction (lab):', ganacheTx);
    addEvent(db, batchId, { type: 'onchain', ...ganacheTx });
    saveDB(db);
  } catch (err) {
    console.error('On-chain transaction failed (lab)', err);
  }

  res.json({ ok: true, event });
});

// ---------- Generic Geo Endpoints ----------
app.post('/api/events', (req, res) => {
  try {
    const { batchId, role, context, latitude, longitude, accuracy } = req.body || {};
    if (!batchId) return res.status(400).json({ ok: false, error: 'batchId required' });
    const lat = toNum(latitude);
    const long = toNum(longitude);
    if (lat == null || long == null) return res.status(400).json({ ok: false, error: 'latitude/longitude required' });

    const db = loadDB();
    const event = {
      type: 'geo',
      batchId,
      role: role || null,         // 'farmer' | 'processor' | 'lab'
      context: context || null,   // 'harvested' | 'processed' | 'lab-tested'
      lat, long,
      accuracy: toNum(accuracy),
      timestamp: Date.now()
    };
    addEvent(db, batchId, event);
    saveDB(db);
    res.json({ ok: true, event });
  } catch (e) {
    console.error('POST /api/events', e);
    res.status(500).json({ ok: false, error: 'internal save failed' });
  }
});

app.get('/api/events', (req, res) => {
  try {
    const { batchId } = req.query;
    const db = loadDB();
    const list = batchId ? (db[batchId] || []) : Object.values(db).flat();
    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    res.json({ ok: true, events: list });
  } catch (e) {
    console.error('GET /api/events', e);
    res.status(500).json({ ok: false, error: 'internal read failed' });
  }
});

// ---------- Consumer ----------
app.get('/api/consumer/view', (req, res) => {
  const batchId = req.query.batchId;
  const db = loadDB();
  res.json({ ok: true, events: db[batchId] || [] });
});

// ---------- Provenance (with map) ----------
app.get('/provenance/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  const db = loadDB();
  const events = (db[batchId] || []).slice();
  const geoEvents = events.filter(hasGeo);

  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Provenance ${batchId}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
    <style>
      body{font-family:Arial;background:#f7f9fb;padding:20px}
      .card{background:#fff;padding:16px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.06);max-width:1000px;margin:12px auto}
      h2{color:#2E8B57}
      .evt{border-left:4px solid #2E8B57;padding:12px;margin:12px 0;border-radius:6px;background:#fff}
      .muted{color:#666;font-size:0.9em}
      a.link{color:#2E8B57}
      #map{height:420px;border-radius:12px;margin:16px 0}
    </style>
  </head><body><div class="card"><h2>Provenance — ${batchId}</h2>`;

  if (events.length === 0) {
    html += '<p class="muted">No records found.</p>';
  } else {
    if (geoEvents.length > 0) {
      const markers = geoEvents.map(e => {
        const when = new Date(e.timestamp || Date.now()).toLocaleString();
        const title =
          e.type === 'collection' ? 'Collection' :
          e.type === 'processing' ? 'Processing' :
          e.type === 'quality'    ? 'Lab Test'  : 'Geo';
        const who = e.farmer || e.processor || e.lab || e.role || '';
        const ctx = e.context || '';
        return { lat: Number(e.lat), lng: Number(e.long), text: `${title} ${ctx ? '('+ctx+')' : ''}${who ? ' — '+who : ''}<br>${when}` };
      });

      html += `<div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        const map = L.map('map');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
        const markers = ${JSON.stringify(markers)};
        const latlngs = markers.map(m => [m.lat, m.lng]);
        const group = L.featureGroup(markers.map(m => L.marker([m.lat, m.lng]).bindPopup(m.text))).addTo(map);
        L.polyline(latlngs, { weight: 4 }).addTo(map);
        map.fitBounds(group.getBounds().pad(0.2));
      </script>`;
    }

    events.forEach(e => {
      const when = new Date(e.timestamp).toLocaleString();
      html += `<div class="evt">`;
      if (e.type === 'collection') {
        html += `<strong>Collection</strong> — <span class="muted">${when}</span><br>`;
        html += `Species: ${e.species} | Quality: ${e.quality}<br>`;
        if (e.collector) html += `Collector: ${e.collector}<br>`;        // NEW
        if (e.farmLocation) html += `Farm: ${e.farmLocation}<br>`;        // NEW
        if (hasGeo(e)) html += `Location: (${e.lat}, ${e.long})<br>`;
        if (e.imageLink) html += `Image: <a class="link" target="_blank" href="${e.imageLink}">View</a><br>`;
        html += `Status: ${e.status}`;
      } else if (e.type === 'processing') {
        html += `<strong>Processing</strong> — <span class="muted">${when}</span><br>`;
        html += `${e.facility} (${e.facilityLocation})<br>`;
        html += `Manager: ${e.managerName}<br>Type: ${e.processType}<br>`;
        if (hasGeo(e)) html += `Location: (${e.lat}, ${e.long})<br>`;
        html += `Status: ${e.status}`;
      } else if (e.type === 'quality') {
        html += `<strong>Lab Test</strong> — <span class="muted">${when}</span><br>`;
        html += `${e.labName} (${e.labLocation})<br>`;
        html += `Manager: ${e.labManagerName}<br>Result: ${e.resultStatus}<br>`;
        if (e.ipfsLink) html += `Report: <a class="link" target="_blank" href="${e.ipfsLink}">View</a><br>`;
        if (hasGeo(e)) html += `Location: (${e.lat}, ${e.long})<br>`;
        html += `Status: ${e.status}`;
      } else {
        html += `<strong>Event</strong> — <span class="muted">${when}</span><br>`;
        if (e.context) html += `Context: ${e.context}<br>`;
        if (hasGeo(e)) html += `Location: (${e.lat}, ${e.long})<br>`;
      }
      html += `</div>`;
    });
  }

  html += `<p style="text-align:center"><a href="/">Back</a></p>`;
  html += `</div></body></html>`;
  res.send(html);
});

// ---------- QR ----------
app.get('/qr/:batchId', async (req, res) => {
  const batchId = req.params.batchId;
  const url = `http://localhost:3000/provenance/${batchId}`;
  const qr = await QRCode.toDataURL(url);
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>QR ${batchId}</title></head>
    <body style="font-family:Arial;text-align:center;padding:30px">
    <h3>QR for ${batchId}</h3>
    <img src="${qr}" alt="QR" style="max-width:300px"/><br>
    <a href="${url}">${url}</a><br><a href="/">Back</a>
    </body></html>`);
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
