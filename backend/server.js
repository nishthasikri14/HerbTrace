'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const bcrypt = require('bcrypt'); // make sure to install via npm
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const cors = require('cors');

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

// ---------- Demo Users ----------
const users = [
  { username: "farmer1", password: bcrypt.hashSync("1234", 10), role: "farmer" },
  { username: "processor1", password: bcrypt.hashSync("1234", 10), role: "processor" },
  { username: "lab1", password: bcrypt.hashSync("1234", 10), role: "lab" }
];

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
    const { collector, species, otherSpecies, quality, lat, long } = req.body;
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

    const db = loadDB();
    db[batchId] = db[batchId] || [];
    const event = {
      type: 'collection',
      batchId,
      collector,
      species: herb,
      quality,
      lat,
      long,
      imageLink,
      farmer: req.user.username,
      timestamp,
      status: 'pending'
    };
    db[batchId].push(event);
    saveDB(db);

    // ---------- Simulate On-chain Ganache txn ----------
    try {
      const ganacheTx = {
        batchId,
        eventType: 'CollectionEvent',
        payload: event,
        txHash: `0x${Math.random().toString(16).substr(2, 64)}`, // dummy hash
        timestamp
      };
      console.log('Simulated on-chain transaction:', ganacheTx);
      // Optionally, store it locally as well
      db[batchId].push({ type: 'onchain', ...ganacheTx });
      saveDB(db);
    } catch (err) { console.error('On-chain simulation failed', err); }

    res.json({ ok: true, batchId, event });
  } catch (err) { res.status(500).json({ ok: false, error: 'Server error' }); }
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

app.post('/api/processor/process', authRole(['processor']), (req, res) => {
  const { batchId, facility, facilityLocation, managerName, processType } = req.body;
  const db = loadDB();
  if (!db[batchId]) return res.status(400).json({ ok: false, error: 'Batch not found' });

  const timestamp = Date.now();
  const event = {
    type: 'processing',
    batchId,
    facility,
    facilityLocation,
    managerName,
    processType,
    processor: req.user.username,
    timestamp,
    status: 'processed'
  };
  db[batchId].push(event);
  db[batchId].forEach(e => { if (e.type === 'collection') e.status = 'processed'; });
  saveDB(db);
  res.json({ ok: true, event });
});

// ---------- Lab ----------
app.get('/api/lab/dashboard', authRole(['lab']), (req, res) => {
  const db = loadDB();
  const pending = [];
  Object.keys(db).forEach(batchId => {
    const events = db[batchId];
    const last = events[events.length - 1];
    if (last && last.status === 'processed') pending.push({ batchId, ...last });
  });
  res.json({ ok: true, pending });
});

app.post('/api/lab/upload-report', authRole(['lab']), upload.single('file'), async (req, res) => {
  const { batchId, labName, labManagerName, labLocation, resultStatus } = req.body;
  if (!req.file) return res.status(400).json({ ok: false, error: 'File missing' });

  const db = loadDB();
  if (!db[batchId]) return res.status(400).json({ ok: false, error: 'Batch not found' });

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
    labName,
    labManagerName,
    labLocation,
    resultStatus,
    ipfsLink,
    lab: req.user.username,
    timestamp,
    status: 'tested'
  };
  db[batchId].push(event);
  saveDB(db);

  res.json({ ok: true, event });
});

// ---------- Consumer ----------
app.get('/api/consumer/view', (req, res) => {
  const batchId = req.query.batchId;
  const db = loadDB();
  res.json({ ok: true, events: db[batchId] || [] });
});

// ---------- Provenance ----------
app.get('/provenance/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  const db = loadDB();
  const events = db[batchId] || [];

  let html = `<!doctype html><html><head><meta charset="utf-8"><title>Provenance ${batchId}</title>
    <style>
      body{font-family:Arial;background:#f7f9fb;padding:20px}
      .card{background:#fff;padding:16px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.06);max-width:900px;margin:12px auto}
      h2{color:#2E8B57}
      .evt{border-left:4px solid #2E8B57;padding:12px;margin:12px 0;border-radius:6px;background:#fff}
      .muted{color:#666;font-size:0.9em}
      a.link{color:#2E8B57}
    </style>
  </head><body><div class="card"><h2>Provenance — ${batchId}</h2>`;

  if (events.length === 0) html += '<p class="muted">No records found.</p>';
  else {
    events.forEach(e => {
      html += `<div class="evt">`;
      if (e.type === 'collection') {
        html += `<strong>Collection</strong> — <span class="muted">${new Date(e.timestamp).toLocaleString()}</span><br>`;
        html += `Species: ${e.species} | Quality: ${e.quality}<br>`;
        if (e.lat && e.long) html += `Location: (${e.lat}, ${e.long})<br>`;
        if (e.imageLink) html += `Image: <a class="link" target="_blank" href="${e.imageLink}">View</a><br>`;
        html += `Status: ${e.status}`;
      } else if (e.type === 'processing') {
        html += `<strong>Processing</strong> — ${e.facility} (${e.facilityLocation})<br>`;
        html += `Manager: ${e.managerName}<br>Type: ${e.processType}<br>Status: ${e.status}`;
      } else if (e.type === 'quality') {
        html += `<strong>Lab Test</strong> — ${e.labName} (${e.labLocation})<br>`;
        html += `Manager: ${e.labManagerName}<br>Result: ${e.resultStatus}<br>`;
        if (e.ipfsLink) html += `Report: <a class="link" target="_blank" href="${e.ipfsLink}">View</a><br>`;
        html += `Status: ${e.status}`;
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