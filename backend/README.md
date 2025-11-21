```markdown
# 🌿 HerbTrace — Blockchain-Powered Herb Supply Chain Tracking

HerbTrace is a full-stack Web3 application for tracking medicinal herbs across their entire lifecycle — **from farmer → processor → lab → consumer** — with complete transparency and tamper-proof storage.

The system uses:
- **Node.js + Express** (backend API)
- **HTML/CSS/JS** (frontend)
- **Ethereum blockchain** (event recording)
- **IPFS/Pinata** (file storage)
- **JWT authentication**
- **Local JSON DB** (for off-chain event history)

---

## 🔗 Blockchain Compatibility

Although the backend code references **Ganache**, HerbTrace works with **ANY EVM-compatible network**:

### Local Networks  
- Ganache  
- Hardhat Network  
- Anvil (Foundry)  
- Geth Private Chain  

### Public Testnets  
- Sepolia  
- Goerli  
- Holesky  
- Polygon Amoy  
- BNB Smart Chain Testnet  

To switch networks, update `.env`:

```

RPC_URL=[http://127.0.0.1:8545](http://127.0.0.1:8545)   # or your testnet RPC
GANACHE_PK=0xyourPrivateKey     # any private key on that network

````

The backend automatically uses these values:

```js
const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.GANACHE_PK, provider);
````

No code changes required.

---

## 🚀 Features

### 👨‍🌾 Farmer Module

* Add new herb batches
* Auto-generate Batch IDs
* Upload images (stored on IPFS)
* Auto-attach geo-location
* Stored on blockchain + local DB

### 🏭 Processor Module

* View pending farmer batches
* Process herbs with facility details
* Add processing events
* Blockchain event logging

### 🔬 Lab Module

* Upload lab test reports (PDF)
* Store reports on IPFS
* Attach test results
* Add geo coordinates
* Blockchain logging

### 🧾 Consumer View

* Scan QR → view complete batch history
* Timeline-style UI
* Map showing movement path

---

## 🗂 Project Structure

```
herb-trace/
│
├─ backend/
│   ├─ server.js        # Main API
│   ├─ contracts/       # Solidity smart contracts
│   ├─ scripts/         # Deployment scripts
│   ├─ routes/geo.js    # Geo APIs
│   ├─ localDB.json     # Local JSON DB
│   ├─ pinataHelper.js  # IPFS uploads
│
├─ frontend/
│   ├─ index.html
│   ├─ login.html
│   ├─ farmer.html
│   ├─ processor.html
│   ├─ lab.html
│   ├─ consumer.html
│   ├─ qr.html
│   ├─ style.css
│
└─ README.md
```

---

## ⚙️ Installation & Running

### 1️⃣ Install Dependencies

```bash
cd backend
npm install
```

### 2️⃣ Create `.env` File

```
RPC_URL=http://127.0.0.1:8545
GANACHE_PK=0xyourPrivateKey
PINATA_JWT=your_pinata_jwt
SECRET_KEY=supersecret
PORT=3000
```

### 3️⃣ Start Local Blockchain (example: Hardhat)

```bash
npx hardhat node
```

or Ganache, Anvil, Geth — any network works.

### 4️⃣ Start Backend Server

```bash
npm start
```

Server:

```
http://localhost:3000
```

---

## 📦 Smart Contract (Traceability.sol)

Tracks 3 event types:

* Collection event
* Processing step
* Quality test event

Events are grouped by `batchId` and fetched using:

```solidity
function getEvents(string calldata batchId) external view returns (Event[] memory);
```

---

## 🗺 QR + Provenance Map

Each batch gets a QR code that links to:

```
/provenance/<batchId>
```

This page displays:

* Full timeline
* Geo-tracking map
* IPFS-linked images and lab reports

---

## 🧪 Testing with Hardhat

```bash
npx hardhat test
```

---

## 📜 License

MIT License — free to use and modify.

---

## ❤️ Contribution

Pull requests and improvements are welcome!

```
```

