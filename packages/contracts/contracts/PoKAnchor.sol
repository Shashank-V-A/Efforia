// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PoKAnchor
 * @notice Anchors Proof-of-Knowledge certificates on-chain: fingerprint hash, score, timestamp, author.
 *         Read-only verification; no raw telemetry or content.
 */
contract PoKAnchor {
    struct Record {
        bytes32 fingerprintHash;
        uint256 score;       // 0..1000 (effort * 1000)
        uint256 timestamp;
        address author;
        bool exists;
    }

    mapping(bytes32 => Record) public records;
    bytes32[] public allHashes;

    event Anchored(bytes32 indexed fingerprintHash, uint256 score, uint256 timestamp, address author);

    /**
     * @dev Anchor a PoK certificate. Caller becomes author.
     * @param fingerprintHash SHA-256 of normalized features (32 bytes).
     * @param score Human effort score in basis points (0..1000 = 0.0 .. 1.0).
     */
    function anchor(bytes32 fingerprintHash, uint256 score) external {
        require(score <= 1000, "PoK: score must be 0-1000");
        require(!records[fingerprintHash].exists, "PoK: already anchored");
        uint256 ts = block.timestamp;
        records[fingerprintHash] = Record({
            fingerprintHash: fingerprintHash,
            score: score,
            timestamp: ts,
            author: msg.sender,
            exists: true
        });
        allHashes.push(fingerprintHash);
        emit Anchored(fingerprintHash, score, ts, msg.sender);
    }

    /**
     * @dev Check if a fingerprint has been anchored and return its record.
     */
    function getRecord(bytes32 fingerprintHash)
        external
        view
        returns (
            bytes32 hash_,
            uint256 score,
            uint256 timestamp,
            address author,
            bool exists
        )
    {
        Record memory r = records[fingerprintHash];
        return (r.fingerprintHash, r.score, r.timestamp, r.author, r.exists);
    }

    /**
     * @dev Verify: returns true iff the fingerprint is anchored.
     */
    function verify(bytes32 fingerprintHash) external view returns (bool) {
        return records[fingerprintHash].exists;
    }

    /**
     * @dev Total number of anchored certificates.
     */
    function totalAnchored() external view returns (uint256) {
        return allHashes.length;
    }
}
