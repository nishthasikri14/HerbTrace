require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true, // helps avoid "stack too deep"
    },
  },
  networks: {
    ganache: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      accounts: [process.env.GANACHE_PK],
    },
  },
};
