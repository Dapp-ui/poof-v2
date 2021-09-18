// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../FeeBase.sol";
import "../../interfaces/ISafeBox.sol";
import "../../interfaces/IWERC20.sol";
import "../../interfaces/ICToken.sol";

// Wrapped cToken for AlphaHomora or Compound
// TODO: WIP
contract WrappedCToken is ERC20, FeeBase, IWERC20 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public constant MULTIPLIER = 1e18;

  ISafeBox public immutable safeBox;
  ICToken public immutable cToken;
  IERC20 public immutable token;

  uint256 public lastUnderlyingBalance;

  constructor(
    string memory _name,
    string memory _symbol,
    address _safeBox,
    address _feeToSetter
  ) ERC20(_name, _symbol) FeeBase(_feeToSetter) {
    safeBox = ISafeBox(_safeBox);
    cToken = ICToken(ISafeBox(_safeBox).cToken());
    token = IERC20(ISafeBox(_safeBox).uToken());
  }

  modifier takeFee() {
    if (hasFee()) {
      // Invariant: feeDivisor > 0 && feeTo != address(0)
      uint256 currentUnderlyingBalance = safeBox.balanceOfUnderlying(address(this));
      if (currentUnderlyingBalance > lastUnderlyingBalance) {
        uint256 fee = currentUnderlyingBalance.sub(lastUnderlyingBalance).div(feeDivisor);
        cToken.approve(address(safeBox), fee);
        safeBox.withdraw(fee);
        token.safeTransfer(feeTo, fee);
      }
    }
    _;
  }

  function debtToUnderlying(uint256 debtAmount) public view override returns (uint256) {
    return debtAmount.div(cToken.exchangeRateStored());
  }

  function underlyingToDebt(uint256 underlyingAmount) public view override returns (uint256) {
    return underlyingAmount.mul(cToken.exchangeRateStored());
  }

  function wrap(uint256 underlyingAmount) public takeFee override {
    require(underlyingAmount > 0, "underlyingAmount cannot be 0");
    uint256 toMint = underlyingToDebt(underlyingAmount);
    token.safeTransferFrom(msg.sender, address(this), underlyingAmount);
    token.approve(address(safeBox), underlyingAmount);
    safeBox.deposit(underlyingAmount);
    _mint(msg.sender, toMint);

    // Assign lastUnderlyingBalance after we have wrapped
    lastUnderlyingBalance = safeBox.balanceOfUnderlying(address(this));
  }

  function unwrap(uint256 debtAmount) public takeFee override {
    require(debtAmount > 0, "debtAmount cannot be 0");
    uint256 toReturn = debtToUnderlying(debtAmount);
    _burn(msg.sender, debtAmount);
    cToken.approve(address(safeBox), toReturn);
    safeBox.withdraw(toReturn);
    token.safeTransfer(msg.sender, toReturn);

    // Assign lastUnderlyingBalance after we have unwrapped
    lastUnderlyingBalance = safeBox.balanceOfUnderlying(address(this));
  }

  function underlyingToken() external override view returns (address) {
    return address(token);
  }

  function underlyingBalanceOf(address owner) external view override returns (uint256) {
    return debtToUnderlying(balanceOf(owner));
  }
}

