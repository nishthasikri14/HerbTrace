#HerbTrace-Blockchain-based Ayurvedic Herb Traceability System

HerbTrace is a blockchain-powered supply chain traceability system designed to ensure authenticity, transparency, and tamper-proof tracking of Ayurvedic herbs from the point of collection to final formulation.

The project leverages Ethereum smart contracts (Ganache) for local blockchain development, and **IPFS** for decentralized storage of herb-related documents and data.

##Problem Statement
The Ayurvedic supply chain often suffers from:
* Adulteration and substitution of herbs
* Lack of transparency in sourcing
* No reliable way to verify authenticity
* Manual and centralized record keeping

HerbTrace addresses these challenges by providing an immutable and verifiable digital trail for each herb batch using blockchain technology.
##Solution Overview
HerbTrace enables:
* Registration of herb batches at the source
* Geo-tagged and time-stamped records
* Ownership transfer across supply chain stages
* Decentralized storage of certificates and documents on IPFS
* Public verification of herb authenticity
All critical events are recorded on the blockchain, ensuring data integrity and trust.

##System Architecture
On-chain (Blockchain):
* Herb batch metadata
* Ownership and transfer records
* IPFS content identifiers (CIDs)
  
Off-chain (IPFS):
* Certificates
* Images
* Lab reports
* Supporting documents
The blockchain stores only hashes (CIDs), while large files are stored securely on IPFS.

##Tech Stack
###Blockchain & Web3
* Ethereum (Local Development)
* Solidity (Smart Contracts)
* Ganache (Local Ethereum Test Network)
* IPFS (InterPlanetary File System)
* Web3.js / Ethers.js

##Tools & Utilities
* MetaMask
* Git & GitHub
  
##Key Features
* Tamper-proof herb traceability
* Geo-tagged collection records
* Batch-level tracking
* Ownership transfer logging
* Decentralized document storage using IPFS
* Immutable audit trail

##Use Cases
* Ayurvedic manufacturers
* Herbal medicine suppliers
* Regulatory authorities
* Consumers seeking product authenticity
* 
## Future Enhancements
* QR code–based public verification
* Deployment on public Ethereum testnet
* IoT integration for real-time environmental data
* AI-based quality assessment of herbs
* Mobile application for end users

##Contribution
Contributions are welcome! Feel free to fork the repository, raise issues, or submit pull requests.

##License
This project is licensed under the MIT License.

##Contact
If you have any questions or suggestions, feel free to connect.
#If you found this project useful, don’t forget to star the repository!
