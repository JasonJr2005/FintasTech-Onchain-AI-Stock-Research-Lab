// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title FintasSignalRegistry — on-chain registry of descriptive research signals
/// @notice FOR EDUCATION AND RESEARCH ONLY. NOT INVESTMENT ADVICE.
///         Append-only record of research signals produced by the off-chain
///         FintasTech rule-based multi-agent analyst pipeline (14 master
///         heuristics + 4 core analysts). Each entry is a descriptive
///         bullish/bearish/neutral verdict with a confidence score and an
///         IPFS-style reasoning hash. Entries are NEVER buy/sell instructions
///         or recommendations; they exist so that the model's prior statements
///         can be audited after the fact.
/// @dev    - Only addresses with ORACLE_ROLE can push signals.
///         - Signal values are constrained on-chain (confidence 0..10000 bps,
///           score -10000..10000 bps).
///         - Full history is preserved per symbol; the latest snapshot is
///           cached for convenience.
contract FintasSignalRegistry is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @dev Internal enum kept as int8 for compact storage & EVM-friendly math.
    ///      -1 = bearish, 0 = neutral, 1 = bullish
    enum Direction {
        Bearish,
        Neutral,
        Bullish
    }

    struct Signal {
        Direction direction;
        uint16 confidenceBps; // 0..10_000  (10_000 = 100%)
        int16 scoreBps; // -10_000 .. 10_000  (AI composite score)
        uint64 timestamp;
        bytes32 reasoningHash; // IPFS/CID hash of human-readable reasoning
        address publishedBy;
    }

    /// @dev Latest snapshot keyed by ticker hash (keccak256(symbol)).
    mapping(bytes32 => Signal) private _latest;
    /// @dev Full history per symbol — useful for audits and backtests.
    mapping(bytes32 => Signal[]) private _history;
    /// @dev List of every symbol ever published.
    bytes32[] public trackedSymbols;
    mapping(bytes32 => bool) private _tracked;
    /// @dev Human-readable symbol kept alongside its hash for UX.
    mapping(bytes32 => string) public symbolOf;

    uint256 public constant MAX_CONFIDENCE_BPS = 10_000;
    int16 public constant MAX_SCORE_BPS = 10_000;
    int16 public constant MIN_SCORE_BPS = -10_000;
    uint256 public constant STALE_AFTER = 1 days;

    error InvalidConfidence();
    error InvalidScore();
    error EmptySymbol();
    error UnknownSymbol();

    event SignalPushed(
        bytes32 indexed symbolHash,
        string symbol,
        Direction direction,
        uint16 confidenceBps,
        int16 scoreBps,
        uint64 timestamp,
        address indexed publishedBy
    );
    event OracleGranted(address indexed account);
    event OracleRevoked(address indexed account);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    // --- Admin ------------------------------------------------------------

    function grantOracle(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(ORACLE_ROLE, account);
        emit OracleGranted(account);
    }

    function revokeOracle(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(ORACLE_ROLE, account);
        emit OracleRevoked(account);
    }

    // --- Oracle writes ----------------------------------------------------

    /// @notice Push a new AI signal for `symbol`.
    /// @param symbol          Human-readable ticker e.g. "AAPL", "0700.HK".
    /// @param direction       Bearish / Neutral / Bullish.
    /// @param confidenceBps   AI self-reported confidence in bps (0..10000).
    /// @param scoreBps        Composite score in bps (-10000..10000).
    /// @param reasoningHash   IPFS/CID hash of the detailed reasoning blob.
    function pushSignal(
        string calldata symbol,
        Direction direction,
        uint16 confidenceBps,
        int16 scoreBps,
        bytes32 reasoningHash
    ) external onlyRole(ORACLE_ROLE) {
        if (bytes(symbol).length == 0) revert EmptySymbol();
        if (confidenceBps > MAX_CONFIDENCE_BPS) revert InvalidConfidence();
        if (scoreBps > MAX_SCORE_BPS || scoreBps < MIN_SCORE_BPS) revert InvalidScore();

        bytes32 symbolHash = keccak256(bytes(symbol));
        Signal memory sig = Signal({
            direction: direction,
            confidenceBps: confidenceBps,
            scoreBps: scoreBps,
            timestamp: uint64(block.timestamp),
            reasoningHash: reasoningHash,
            publishedBy: msg.sender
        });

        _latest[symbolHash] = sig;
        _history[symbolHash].push(sig);

        if (!_tracked[symbolHash]) {
            _tracked[symbolHash] = true;
            trackedSymbols.push(symbolHash);
            symbolOf[symbolHash] = symbol;
        }

        emit SignalPushed(
            symbolHash, symbol, direction, confidenceBps, scoreBps, uint64(block.timestamp), msg.sender
        );
    }

    // --- Reads ------------------------------------------------------------

    function getLatest(string calldata symbol) external view returns (Signal memory) {
        bytes32 h = keccak256(bytes(symbol));
        if (!_tracked[h]) revert UnknownSymbol();
        return _latest[h];
    }

    function getLatestByHash(bytes32 symbolHash) external view returns (Signal memory) {
        if (!_tracked[symbolHash]) revert UnknownSymbol();
        return _latest[symbolHash];
    }

    function historyLength(string calldata symbol) external view returns (uint256) {
        return _history[keccak256(bytes(symbol))].length;
    }

    function getHistoryAt(string calldata symbol, uint256 index) external view returns (Signal memory) {
        Signal[] storage h = _history[keccak256(bytes(symbol))];
        require(index < h.length, "index OOB");
        return h[index];
    }

    function trackedSymbolsCount() external view returns (uint256) {
        return trackedSymbols.length;
    }

    /// @notice Convenience: returns true when the latest signal is fresh.
    function isFresh(string calldata symbol) external view returns (bool) {
        bytes32 h = keccak256(bytes(symbol));
        if (!_tracked[h]) return false;
        return block.timestamp - _latest[h].timestamp <= STALE_AFTER;
    }
}
