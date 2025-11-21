require("dotenv").config();
const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.TRACE_CONTRACT;
const PRIVATE_KEY = process.env.GANACHE_PK;

const ABI = [
  "function addEvent(string,string,string,string) external",
  "function getEvents(string) view returns (tuple(string eventType,string batchId,string payloadJson,string ipfsHash,uint256 timestamp)[])"
];

let contract;
function getContract() {
  if (contract) return contract;
  if (!PRIVATE_KEY) throw new Error("GANACHE_PK missing in .env");
  if (!CONTRACT_ADDRESS) throw new Error("TRACE_CONTRACT missing in .env");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  return contract;
}
module.exports = { getContract };
