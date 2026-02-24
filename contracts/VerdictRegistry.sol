// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title VerdictRegistry
/// @notice Immutable on-chain log of claim verdicts issued by the CRE Fact-Checker agent.
contract VerdictRegistry {
    event VerdictStored(
        bytes32 indexed verdictHash,
        string verdict,
        uint256 timestamp
    );

    mapping(bytes32 => bool) public verdicts;

    /// @notice Store a verdict hash on-chain.
    /// @param verdictHash keccak256(postId + verdict + confidence + timestamp)
    /// @param verdict     Human-readable verdict string ("TRUE", "FALSE", "UNVERIFIABLE")
    function storeVerdict(bytes32 verdictHash, string calldata verdict) external {
        verdicts[verdictHash] = true;
        emit VerdictStored(verdictHash, verdict, block.timestamp);
    }
}
