// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {FintasSignalRegistry} from "./FintasSignalRegistry.sol";

/// @title FintasVault — EDUCATIONAL paper-trading research vault
/// @notice FOR EDUCATION AND RESEARCH ONLY. NOT A FINANCIAL PRODUCT.
///         This contract is a *paper-trading* research vault. Users deposit
///         a MOCK ERC20 token (mUSDC) and receive ERC20 shares whose NAV is
///         moved by an off-chain research oracle (rule-based multi-agent
///         analyst pipeline). No real-value asset is held, no real trading
///         is performed, and no investment advice is given.
///
///         The contract architecturally REFUSES any asset whose symbol does
///         not begin with the lowercase letter 'm' (the project's "mock"
///         prefix), so it cannot be pointed at a real stablecoin by mistake.
///         Fork at your own risk — using this code with real-value assets is
///         outside the authors' intent and explicitly disclaimed.
///
///         Signals published on-chain are descriptive research outputs
///         (bullish/bearish/neutral + confidence). They are NEVER buy/sell
///         instructions, recommendations, or investment advice.
///
/// @dev    Security properties intentionally enforced:
///           - Mock-only asset guard (symbol prefix check at construction).
///           - Role-separated access (ADMIN / ORACLE / GUARDIAN).
///           - ReentrancyGuard on all ERC20-moving paths.
///           - Bounded oracle updates (|deltaBps| ≤ MAX_DELTA_BPS_PER_UPDATE).
///           - Rate-limited oracle updates (MIN_UPDATE_INTERVAL).
///           - Pausable deposits while still honoring withdrawals.
///           - Emergency withdraw at `navPerShare = 1e18` if the oracle
///             misbehaves and the guardian flips the circuit breaker.
contract FintasVault is ERC20, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Roles
    // ------------------------------------------------------------------

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------

    uint256 public constant ONE = 1e18; // NAV-per-share precision
    uint256 public constant MAX_DELTA_BPS_PER_UPDATE = 500; // ±5% cap
    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant MIN_UPDATE_INTERVAL = 15 minutes;
    uint256 public constant MAX_PERFORMANCE_FEE_BPS = 2_000; // ≤20%

    // ------------------------------------------------------------------
    // Storage
    // ------------------------------------------------------------------

    IERC20 public immutable asset;
    uint8 private immutable _assetDecimals;
    FintasSignalRegistry public signalRegistry;

    uint256 public navPerShare; // 1e18-scaled — starts at 1e18
    uint256 public highWaterMark; // for performance fee accounting
    uint256 public lastUpdateAt;
    uint256 public performanceFeeBps; // charged on profit when withdrawing
    address public feeRecipient;
    bool public circuitBreakerTripped;

    /// @dev On-chain record of the vault's strategy allocation. The AI
    ///      expresses its portfolio view by pushing weights here; this does
    ///      NOT move funds (paper trading), it simply records strategy.
    struct Allocation {
        string symbol;
        uint16 weightBps;
    }

    Allocation[] private _allocations;

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error ZeroAmount();
    error ZeroAddress();
    error DeltaExceedsCap(int256 delta);
    error UpdateTooFrequent();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error FeeTooHigh();
    error InvalidAllocation();
    error NotCircuitBreakerMode();
    error StaleOrMissingSignal(string symbol);
    /// @dev Thrown if the vault is deployed with an asset whose symbol does
    ///      not start with the educational-mock prefix "m".
    error AssetNotMarkedAsMock();

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event Deposited(address indexed user, uint256 assets, uint256 shares, uint256 navPerShare);
    event Withdrawn(
        address indexed user, uint256 shares, uint256 assets, uint256 fee, uint256 navPerShare
    );
    event PerformanceReported(int256 deltaBps, uint256 newNav, uint256 newHighWaterMark);
    event AllocationsRebalanced(string[] symbols, uint16[] weightsBps);
    event CircuitBreakerTripped(address indexed by, string reason);
    event CircuitBreakerReset(address indexed by);
    event PerformanceFeeUpdated(uint256 oldBps, uint256 newBps);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event SignalRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    /// @notice Emitted once at construction to put the educational-only
    ///         posture of this contract on chain immutably.
    event EducationalUseOnly(string notice);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(
        IERC20 _asset,
        FintasSignalRegistry _registry,
        address admin,
        address oracle,
        address guardian,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        if (address(_asset) == address(0) || admin == address(0)) revert ZeroAddress();

        // Mock-asset guard: the asset's ERC20 symbol must start with a
        // lowercase 'm' (e.g. "mUSDC", "mDAI"). This makes it architecturally
        // hard to point the vault at a real-value stablecoin like USDC / DAI /
        // USDT. If you fork and remove this check, you are operating outside
        // the authors' intent and assume full legal and financial risk.
        bytes memory symBytes = bytes(IERC20Metadata(address(_asset)).symbol());
        if (symBytes.length == 0 || symBytes[0] != bytes1("m")) {
            revert AssetNotMarkedAsMock();
        }

        asset = _asset;
        signalRegistry = _registry;

        try IERC20Metadata(address(_asset)).decimals() returns (uint8 d) {
            _assetDecimals = d;
        } catch {
            _assetDecimals = 18;
        }

        navPerShare = ONE;
        highWaterMark = ONE;
        lastUpdateAt = block.timestamp;
        feeRecipient = admin;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (oracle != address(0)) _grantRole(ORACLE_ROLE, oracle);
        if (guardian != address(0)) _grantRole(GUARDIAN_ROLE, guardian);

        emit EducationalUseOnly(
            "FintasVault is a paper-trading research vault. It accepts only "
            "mock ERC20 assets (symbol prefix 'm') and is not intended for real "
            "funds. Not investment advice. Use at your own risk."
        );
    }

    function decimals() public view override returns (uint8) {
        return _assetDecimals;
    }

    // ------------------------------------------------------------------
    // User-facing actions
    // ------------------------------------------------------------------

    /// @notice Deposit `assets` of the underlying token and receive shares
    ///         priced at the current NAV.
    /// @return shares The number of vault share tokens minted to `msg.sender`.
    function deposit(uint256 assets) external whenNotPaused nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();

        shares = (assets * ONE) / navPerShare;
        if (shares == 0) revert ZeroAmount();

        asset.safeTransferFrom(msg.sender, address(this), assets);
        _mint(msg.sender, shares);

        emit Deposited(msg.sender, assets, shares, navPerShare);
    }

    /// @notice Burn `shares` and receive underlying asset priced at NAV.
    ///         A performance fee (if any) is charged on the realized profit
    ///         portion of the withdrawal.
    /// @return assetsOut The net amount of underlying sent to `msg.sender`.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assetsOut) {
        if (shares == 0) revert ZeroAmount();

        uint256 gross = (shares * navPerShare) / ONE;
        uint256 fee = _computeFee(shares);
        assetsOut = gross - fee;

        uint256 available = asset.balanceOf(address(this));
        if (assetsOut + fee > available) {
            revert InsufficientLiquidity(assetsOut + fee, available);
        }

        _burn(msg.sender, shares);
        if (fee > 0) asset.safeTransfer(feeRecipient, fee);
        asset.safeTransfer(msg.sender, assetsOut);

        emit Withdrawn(msg.sender, shares, assetsOut, fee, navPerShare);
    }

    /// @notice Withdraw at `1e18` NAV (i.e. "my original dollars, no AI PnL")
    ///         once the circuit breaker is tripped. Designed so depositors
    ///         can always exit with at least the amount they put in if the
    ///         oracle misbehaves or the guardian halts the system.
    function emergencyWithdraw(uint256 shares) external nonReentrant returns (uint256 assetsOut) {
        if (!circuitBreakerTripped) revert NotCircuitBreakerMode();
        if (shares == 0) revert ZeroAmount();

        assetsOut = shares; // NAV forced back to 1.0 → share:asset is 1:1
        uint256 available = asset.balanceOf(address(this));
        if (assetsOut > available) revert InsufficientLiquidity(assetsOut, available);

        _burn(msg.sender, shares);
        asset.safeTransfer(msg.sender, assetsOut);

        emit Withdrawn(msg.sender, shares, assetsOut, 0, ONE);
    }

    // ------------------------------------------------------------------
    // Oracle / AI writes
    // ------------------------------------------------------------------

    /// @notice Called by the AI oracle to record a new vault-level return
    ///         (paper-trading style). Rate-limited and bounded.
    /// @param deltaBps Signed return in basis points (e.g. +37 = +0.37%).
    function reportPerformance(int256 deltaBps) external onlyRole(ORACLE_ROLE) whenNotPaused {
        if (block.timestamp < lastUpdateAt + MIN_UPDATE_INTERVAL) revert UpdateTooFrequent();
        int256 absDelta = deltaBps >= 0 ? deltaBps : -deltaBps;
        if (uint256(absDelta) > MAX_DELTA_BPS_PER_UPDATE) revert DeltaExceedsCap(deltaBps);

        // Apply delta: newNav = oldNav * (1 + delta/10_000)
        int256 signedNav = int256(navPerShare);
        int256 change = (signedNav * deltaBps) / int256(MAX_BPS);
        int256 newNavSigned = signedNav + change;
        require(newNavSigned > 0, "nav underflow"); // structurally unreachable

        navPerShare = uint256(newNavSigned);
        lastUpdateAt = block.timestamp;

        if (navPerShare > highWaterMark) highWaterMark = navPerShare;

        emit PerformanceReported(deltaBps, navPerShare, highWaterMark);
    }

    /// @notice Record how the AI believes vault capital should be allocated
    ///         across tracked symbols. Weights must sum to `MAX_BPS`. Every
    ///         symbol included here MUST have a fresh signal in the registry.
    function rebalanceAllocations(string[] calldata symbols, uint16[] calldata weightsBps)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        if (symbols.length == 0 || symbols.length != weightsBps.length) revert InvalidAllocation();

        uint256 sum;
        for (uint256 i = 0; i < weightsBps.length; i++) {
            sum += weightsBps[i];
        }
        if (sum != MAX_BPS) revert InvalidAllocation();

        if (address(signalRegistry) != address(0)) {
            for (uint256 i = 0; i < symbols.length; i++) {
                if (!signalRegistry.isFresh(symbols[i])) revert StaleOrMissingSignal(symbols[i]);
            }
        }

        delete _allocations;
        for (uint256 i = 0; i < symbols.length; i++) {
            _allocations.push(Allocation({symbol: symbols[i], weightBps: weightsBps[i]}));
        }

        emit AllocationsRebalanced(symbols, weightsBps);
    }

    // ------------------------------------------------------------------
    // Guardian / Admin
    // ------------------------------------------------------------------

    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function tripCircuitBreaker(string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        circuitBreakerTripped = true;
        navPerShare = ONE; // force 1:1 so emergency withdraw is deterministic
        if (!paused()) _pause();
        emit CircuitBreakerTripped(msg.sender, reason);
    }

    function resetCircuitBreaker() external onlyRole(DEFAULT_ADMIN_ROLE) {
        circuitBreakerTripped = false;
        emit CircuitBreakerReset(msg.sender);
    }

    function setPerformanceFeeBps(uint256 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > MAX_PERFORMANCE_FEE_BPS) revert FeeTooHigh();
        emit PerformanceFeeUpdated(performanceFeeBps, newFeeBps);
        performanceFeeBps = newFeeBps;
    }

    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, newRecipient);
        feeRecipient = newRecipient;
    }

    function setSignalRegistry(FintasSignalRegistry newRegistry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit SignalRegistryUpdated(address(signalRegistry), address(newRegistry));
        signalRegistry = newRegistry;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function totalAssets() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function sharesToAssets(uint256 shares) external view returns (uint256) {
        return (shares * navPerShare) / ONE;
    }

    function assetsToShares(uint256 assets) external view returns (uint256) {
        return (assets * ONE) / navPerShare;
    }

    function getAllocations() external view returns (Allocation[] memory) {
        return _allocations;
    }

    function allocationCount() external view returns (uint256) {
        return _allocations.length;
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    function _computeFee(uint256 shares) internal view returns (uint256) {
        if (performanceFeeBps == 0) return 0;
        if (navPerShare <= ONE) return 0; // only charge on profit
        uint256 profitPerShare = navPerShare - ONE;
        uint256 profit = (shares * profitPerShare) / ONE;
        return (profit * performanceFeeBps) / MAX_BPS;
    }
}
