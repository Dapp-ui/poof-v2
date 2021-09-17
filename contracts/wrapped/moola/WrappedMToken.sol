// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../../interfaces/ILendingPool.sol";
import "../../interfaces/IWERC20.sol";
import "../../interfaces/IAToken.sol";

contract WrappedMToken is ERC20, IWERC20 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public constant MULTIPLIER = 1e18;

  IAToken public immutable mToken;
  IERC20 public immutable token;
  ILendingPool public immutable lendingPool;

  constructor(
    string memory _name,
    string memory _symbol,
    address _mToken,
    address _token,
    address _lendingPool
  ) ERC20(_name, _symbol) {
    mToken = IAToken(_mToken);
    token = IERC20(_token);
    lendingPool = ILendingPool(_lendingPool);
  }

  function debtToUnderlying(uint256 debtAmount) public view override returns (uint256) {
    uint256 totalDebtSupply = totalSupply();
    if (totalDebtSupply == 0) {
      return debtAmount.div(MULTIPLIER);
    }
    return debtAmount.mul(mToken.balanceOf(address(this))).div(totalDebtSupply);
  }

  function underlyingToDebt(uint256 underlyingAmount) public view override returns (uint256) {
    uint256 totalUnderlyingSupply = mToken.balanceOf(address(this));
    if (totalUnderlyingSupply == 0) {
      return underlyingAmount.mul(MULTIPLIER);
    }
    return underlyingAmount.mul(totalSupply()).div(totalUnderlyingSupply);
  }

  function wrap(uint256 underlyingAmount) public override {
    require(underlyingAmount > 0, "underlyingAmount cannot be 0");
    uint256 toMint = underlyingToDebt(underlyingAmount);
    token.safeTransferFrom(msg.sender, address(this), underlyingAmount);
    token.approve(lendingPool.core(), underlyingAmount);
    lendingPool.deposit(address(token), underlyingAmount, 88);
    _mint(msg.sender, toMint);
  }

  function unwrap(uint256 debtAmount) public override {
    require(debtAmount > 0, "debtAmount cannot be 0");
    uint256 toReturn = debtToUnderlying(debtAmount);
    _burn(msg.sender, debtAmount);
    mToken.redeem(toReturn);
    token.safeTransfer(msg.sender, toReturn);
  }

  function underlyingToken() external override view returns (address) {
    return address(token);
  }
}
