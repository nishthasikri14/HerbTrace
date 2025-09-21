// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Traceability {
    struct Event {
        string eventType;   // "CollectionEvent" | "ProcessingStep" | "QualityTest"
        string batchId;
        string payloadJson; // JSON payload
        string ipfsHash;    // optional IPFS/Pinata CID
        uint256 timestamp;  // block timestamp
    }

    mapping(string => Event[]) private eventsByBatch;

    event EventAdded(string batchId, string eventType, string ipfsHash, uint256 index);

    function addEvent(
        string calldata batchId,
        string calldata eventType,
        string calldata payloadJson,
        string calldata ipfsHash
    ) external {
        // Use a storage reference to keep stack shallow
        Event[] storage list = eventsByBatch[batchId];
        list.push(Event({
            eventType: eventType,
            batchId: batchId,
            payloadJson: payloadJson,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp
        }));
        uint256 idx = list.length - 1;
        emit EventAdded(batchId, eventType, ipfsHash, idx);
    }

    function getEvents(string calldata batchId) external view returns (Event[] memory) {
        return eventsByBatch[batchId];
    }
}
