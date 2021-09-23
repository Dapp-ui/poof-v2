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
contract WrappedCToken is ERC20, FeeBase, IWERC20 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public constant MULTIPLIER = 1e18;

  ISafeBox public immutable safeBox;
  ICToken public immutable cToken;
  IERC20 public immutable token;

  uint256 public lastUnderlyingBalance;
  uint256 public totalUnredeemedFee;

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

  function debtToUnderlying(uint256 debtAmount) public view override returns (uint256) {
    uint256 totalDebtSupply = totalSupply();
    if (totalDebtSupply <= 0) {
      return debtAmount;
    }
    uint256 totalUnderlyingSupply = cToken.balanceOf(address(this)).mul(cToken.exchangeRateStored());
    return debtAmount.mul(totalUnderlyingSupply.sub(totalFee())).div(totalDebtSupply);
  }

  function underlyingToDebt(uint256 underlyingAmount) public view override returns (uint256) {
    uint256 totalDebtSupply = totalSupply();
    uint256 totalUnderlyingSupply = cToken.balanceOf(address(this)).mul(cToken.exchangeRateStored());
    if (totalUnderlyingSupply <= 0) {
      return underlyingAmount;
    }
    return underlyingAmount.mul(totalDebtSupply).div(totalUnderlyingSupply.sub(totalFee()));
  }

  function pendingFee() public view returns (uint256) {
    if (hasFee()) {
      // Invariant: feeDivisor > 0 && feeTo != address(0)
      uint256 currentUnderlyingBalance = safeBox.balanceOfUnderlying(address(this));
      if (currentUnderlyingBalance > lastUnderlyingBalance) {
        return currentUnderlyingBalance.sub(lastUnderlyingBalance).div(feeDivisor);
      }
    }
    return 0;
  }

  function totalFee() public view returns (uint256) {
    return pendingFee().add(totalUnredeemedFee);
  }

  function takeFee() external {
    uint256 fee = totalFee();
    uint256 feeInDebt = fee.div(cToken.exchangeRateStored());
    if (fee > 0) {
      cToken.approve(address(safeBox), feeInDebt);
      safeBox.withdraw(feeInDebt);
      token.safeTransfer(feeTo, fee);
      lastUnderlyingBalance = safeBox.balanceOfUnderlying(address(this));
      totalUnredeemedFee = 0;
    }
  }

  function wrap(uint256 underlyingAmount) external override {
    require(underlyingAmount > 0, "underlyingAmount cannot be 0");
    uint256 toMint = underlyingToDebt(underlyingAmount);
    token.safeTransferFrom(msg.sender, address(this), underlyingAmount);
    token.approve(address(safeBox), underlyingAmount);
    safeBox.deposit(underlyingAmount);
    _mint(msg.sender, toMint);

    // Assign lastUnderlyingBalance after we have wrapped
    lastUnderlyingBalance = safeBox.balanceOfUnderlying(address(this));
  }

  function unwrap(uint256 debtAmount) external override {
    require(debtAmount > 0, "debtAmount cannot be 0");
    uint256 toReturn = debtToUnderlying(debtAmount);
    totalUnredeemedFee = totalUnredeemedFee.add(pendingFee());
    _burn(msg.sender, debtAmount);
    cToken.approve(address(safeBox), toReturn);
    safeBox.withdraw(toReturn.div(cToken.exchangeRateStored()));
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

