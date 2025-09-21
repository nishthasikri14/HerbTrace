'use strict';
const { Contract } = require('fabric-contract-api');

class TraceContract extends Contract {
    async initLedger(ctx) { console.info('Ledger initialized'); }

    async addCollectionEvent(ctx, batchId, lat, long, collector, species, quality) {
        const event = { type: "CollectionEvent", batchId, lat, long, collector, species, quality, timestamp: new Date().toISOString() };
        const provenance = await this._getProvenance(ctx, batchId);
        provenance.push(event);
        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(provenance)));
        return JSON.stringify(event);
    }

    async addQualityTest(ctx, batchId, labName, parameter, result) {
        const event = { type: "QualityTest", batchId, labName, parameter, result, timestamp: new Date().toISOString() };
        const provenance = await this._getProvenance(ctx, batchId);
        provenance.push(event);
        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(provenance)));
        return JSON.stringify(event);
    }

    async addProcessingStep(ctx, batchId, stepName, facility, details) {
        const event = { type: "ProcessingStep", batchId, stepName, facility, details, timestamp: new Date().toISOString() };
        const provenance = await this._getProvenance(ctx, batchId);
        provenance.push(event);
        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(provenance)));
        return JSON.stringify(event);
    }

    async getProvenanceByBatchId(ctx, batchId) {
        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) return JSON.stringify([]);
        return data.toString();
    }

    async _getProvenance(ctx, batchId) {
        const data = await ctx.stub.getState(batchId);
        if (!data || data.length === 0) return [];
        try { return JSON.parse(data.toString()); } catch { return []; }
    }
}

module.exports = TraceContract;