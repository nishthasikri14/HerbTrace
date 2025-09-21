'use strict';

const fs = require('fs');
const path = require('path');
const pinataHelper = require('./pinataHelper');

const localDB = path.join(__dirname, 'localDB.json');

function loadDB() {
    if (fs.existsSync(localDB)) {
        return JSON.parse(fs.readFileSync(localDB, 'utf8'));
    }
    return {};
}

function saveDB(db) {
    fs.writeFileSync(localDB, JSON.stringify(db, null, 2));
}

async function main() {
    const db = loadDB();

    const ipfsHash = "QmW6Prbx8n55UJJesigs84uiEJsp5zBxbLDT8mgPzC3kHV"; // your uploaded lab report

    for (let i = 1; i <= 5; i++) {
        const batchId = `BATCH${i}`;
        db[batchId] = [];

        // Farmer Collection
        db[batchId].push({
            type: 'collection',
            collector: `Farmer ${i}`,
            species: i % 2 === 0 ? 'Tulsi' : 'Ashwagandha',
            quality: i % 2 === 0 ? 'Medium' : 'High',
            lat: 28.6139 + i * 0.01,
            long: 77.2090 + i * 0.01,
            timestamp: Date.now()
        });

        // Lab Test (only first batch has report)
        db[batchId].push({
            type: 'quality',
            labName: 'BioTest Labs',
            parameter: 'Purity',
            resultValue: `${98 - i}%`,
            ipfsHash: i === 1 ? ipfsHash : null,
            timestamp: Date.now()
        });

        // Processing Step
        db[batchId].push({
            type: 'processing',
            stepName: 'Packaging',
            facility: `Packaging Unit ${i}`,
            details: `Packed in ${100 + i*10}g pouches`,
            timestamp: Date.now()
        });
    }

    saveDB(db);
    console.log('Sample data with 5 batches inserted!');
}

main();