// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VerdictRegistry
 * @notice Receives inactivity verdicts from Chainlink CRE via MockKeystoneForwarder.
 *
 * The CRE workflow calls evmClient.writeReport() which routes through the
 * MockKeystoneForwarder (0x15fC6ae953E024d975e77382eEeC56A9101f9F88).
 * That forwarder calls onReport(bytes metadata, bytes report) on this contract.
 *
 * The `report` bytes = ABI-encoded storeVerdict calldata:
 *   [0:4]  = storeVerdict selector (ignored — we're already in onReport)
 *   [4:]   = abi.encode(bytes32 verdictHash, string verdict)
 */
contract VerdictRegistry {

    // =========================================================================
    // State
    // =========================================================================

    address public immutable forwarder;
    address public owner;

    struct Verdict {
        bytes32 verdictHash;
        string  verdict;
        uint256 timestamp;
    }

    Verdict[] public verdicts;

    // =========================================================================
    // Events
    // =========================================================================

    event VerdictStored(
        bytes32 indexed verdictHash,
        string  verdict,
        uint256 timestamp
    );

    // =========================================================================
    // Modifiers
    // =========================================================================

    modifier onlyForwarder() {
        require(msg.sender == forwarder, "VerdictRegistry: caller is not forwarder");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "VerdictRegistry: not owner");
        _;
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    /**
     * @param forwarder_ Address of the MockKeystoneForwarder (or KeystoneForwarder)
     *                   that is authorised to push reports to this contract.
     */
    constructor(address forwarder_) {
        require(forwarder_ != address(0), "VerdictRegistry: zero forwarder");
        forwarder = forwarder_;
        owner     = msg.sender;
    }

    // =========================================================================
    // IReceiver — called by MockKeystoneForwarder
    // =========================================================================

    /**
     * @notice Entry point called by the Chainlink CRE forwarder.
     * @param  report  ABI-encoded storeVerdict call:
     *                   bytes[0:4]  — storeVerdict(bytes32,string) selector (skipped)
     *                   bytes[4:]   — abi.encode(bytes32 verdictHash, string verdict)
     */
    function onReport(bytes calldata /* metadata */, bytes calldata report) external onlyForwarder {
        require(report.length > 4, "VerdictRegistry: report too short");

        (bytes32 verdictHash, string memory verdict) =
            abi.decode(report[4:], (bytes32, string));

        _store(verdictHash, verdict);
    }

    // =========================================================================
    // Direct write (owner only — for testing / fallback)
    // =========================================================================

    function storeVerdict(bytes32 verdictHash, string calldata verdict) external onlyOwner {
        _store(verdictHash, verdict);
    }

    // =========================================================================
    // Internal
    // =========================================================================

    function _store(bytes32 verdictHash, string memory verdict) internal {
        verdicts.push(Verdict({
            verdictHash: verdictHash,
            verdict:     verdict,
            timestamp:   block.timestamp
        }));
        emit VerdictStored(verdictHash, verdict, block.timestamp);
    }

    // =========================================================================
    // View
    // =========================================================================

    function getLatestVerdict() external view returns (
        bytes32 verdictHash,
        string  memory verdict,
        uint256 timestamp
    ) {
        require(verdicts.length > 0, "VerdictRegistry: no verdicts yet");
        Verdict storage v = verdicts[verdicts.length - 1];
        return (v.verdictHash, v.verdict, v.timestamp);
    }

    function getVerdictCount() external view returns (uint256) {
        return verdicts.length;
    }
}
