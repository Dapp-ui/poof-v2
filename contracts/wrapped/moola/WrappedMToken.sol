// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../FeeBase.sol";
import "../../interfaces/ILendingPool.sol";
import "../../interfaces/IWERC20.sol";
import "../../interfaces/IAToken.sol";

contract WrappedMToken is ERC20, FeeBase, IWERC20 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public constant MULTIPLIER = 1e18;

  IAToken public immutable mToken;
  IERC20 public immutable token;
  ILendingPool public immutable lendingPool;

  uint256 public lastMBalance;
  uint256 public totalUnredeemedFee;

  constructor(
    string memory _name,
    string memory _symbol,
    address _mToken,
    address _token,
    address _lendingPool,
    address _feeToSetter
  ) ERC20(_name, _symbol) FeeBase(_feeToSetter) {
    mToken = IAToken(_mToken);
    token = IERC20(_token);
    lendingPool = ILendingPool(_lendingPool);
  }

  function pendingFee() public view returns (uint256) {
    if (hasFee()) {
      // Invariant: feeDivisor > 0
      uint256 currentMBalance = mToken.balanceOf(address(this));
      if (currentMBalance > lastMBalance) {
        return currentMBalance.sub(lastMBalance).div(feeDivisor);
      }
    }
    return 0;
  }

  function totalFee() public view returns (uint256) {
    return pendingFee().add(totalUnredeemedFee);
  }

  function debtToUnderlying(uint256 debtAmount) public view override returns (uint256) {
    uint256 totalDebtSupply = totalSupply();
    // slither-disable-next-line incorrect-equality
    if (totalDebtSupply <= 0) {
      return debtAmount.div(MULTIPLIER);
    }
    return debtAmount.mul(mToken.balanceOf(address(this)).sub(totalFee())).div(totalDebtSupply);
  }

  function underlyingToDebt(uint256 underlyingAmount) public view override returns (uint256) {
    uint256 totalUnderlyingSupply = mToken.balanceOf(address(this)).sub(totalFee());
    if (totalUnderlyingSupply <= 0) {
      return underlyingAmount.mul(MULTIPLIER);
    }
    return underlyingAmount.mul(totalSupply()).div(totalUnderlyingSupply);
  }

  function takeFee() external {
    uint256 fee = totalFee();
    if (fee > 0) {
      mToken.redeem(fee);
      token.safeTransfer(feeTo, fee);
      lastMBalance = mToken.balanceOf(address(this));
      totalUnredeemedFee = 0;
    }
  }

  function wrap(uint256 underlyingAmount) external override {
    require(underlyingAmount > 0, "underlyingAmount cannot be 0");
    uint256 toMint = underlyingToDebt(underlyingAmount);
    totalUnredeemedFee = totalUnredeemedFee.add(pendingFee());
    token.safeTransferFrom(msg.sender, address(this), underlyingAmount);
    require(token.approve(lendingPool.core(), underlyingAmount), "Approve failed");
    lendingPool.deposit(address(token), underlyingAmount, 88);
    _mint(msg.sender, toMint);

    // Assign lastMBalance after we have wrapped
    lastMBalance = mToken.balanceOf(address(this));
  }

  function unwrap(uint256 debtAmount) external override {
    require(debtAmount > 0, "debtAmount cannot be 0");
    uint256 toReturn = debtToUnderlying(debtAmount);
    totalUnredeemedFee = totalUnredeemedFee.add(pendingFee());
    _burn(msg.sender, debtAmount);
    mToken.redeem(toReturn);
    token.safeTransfer(msg.sender, toReturn);

    // Assign lastMBalance after we have unwrapped
    lastMBalance = mToken.balanceOf(address(this));
  }

  function underlyingToken() external override view returns (address) {
    return address(token);
  }

  function underlyingBalanceOf(address owner) external view override returns (uint256) {
    return debtToUnderlying(balanceOf(owner));
  }
}
