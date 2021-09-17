// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./../interfaces/IWERC20.sol";

contract WERC20Mock is ERC20, IWERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public token;

  constructor(IERC20 _token) ERC20("Mock ERC20", "mERC20") {
    token = _token;
  }

  function wrap(uint256 underlyingAmount) public override {
    uint256 debtAmount = underlyingToDebt(underlyingAmount);
    token.safeTransferFrom(msg.sender, address(this), underlyingAmount);
    _mint(msg.sender, debtAmount);
  }

  function unwrap(uint256 debtAmount) public override {
    require(balanceOf(msg.sender) >= debtAmount, "Insufficient funds for unwrap");
    uint256 underlyingAmount = debtToUnderlying(debtAmount);
    _burn(msg.sender, debtAmount);
    token.safeTransfer(msg.sender, underlyingAmount);
  }

  function underlyingToDebt(uint256 underlyingAmount) public pure override returns (uint256) {
    return underlyingAmount.mul(2);
  }

  function debtToUnderlying(uint256 debtAmount) public pure override returns (uint256) {
    return debtAmount.div(2);
  }

  function underlyingToken() external view override returns (address) {
    return address(token);
  }
}

