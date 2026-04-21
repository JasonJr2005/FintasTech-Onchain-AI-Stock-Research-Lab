// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice ERC20 stablecoin mock used as the underlying asset for FintasVault
///         on local / test networks. Anyone can call `faucet()` once per cooldown
///         to get test funds — not intended for mainnet use.
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6; // match real USDC
    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** _DECIMALS;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    mapping(address => uint256) public lastFaucetAt;

    error FaucetCooldownActive(uint256 secondsRemaining);

    event FaucetClaimed(address indexed user, uint256 amount);

    constructor() ERC20("Mock USD Coin", "mUSDC") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** _DECIMALS);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Claim test tokens. One call per address per cooldown window.
    function faucet() external {
        uint256 last = lastFaucetAt[msg.sender];
        if (last != 0 && block.timestamp < last + FAUCET_COOLDOWN) {
            revert FaucetCooldownActive(last + FAUCET_COOLDOWN - block.timestamp);
        }
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner-only mint for testing / seeding demo accounts.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
