// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "../interfaces/ICToken.sol";
import "../interfaces/ISafeBox.sol";

contract MockSafeBox is ERC20, ICToken, ISafeBox {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public underlying;

  constructor(IERC20 _underlying) ERC20 ("Mock", "M") {
    underlying = _underlying;
  }

  function cToken() external view override returns (address) {
    return address(this);
  }

  function uToken() external view override returns (address) {
    return address(underlying);
  }

  function balanceOfUnderlying(address owner) external view override returns (uint256) {
    if (totalSupply() <= 0) {
      return 0;
    }
    return underlying.balanceOf(address(this)).mul(balanceOf(owner)).div(totalSupply());
  }

  function deposit(uint256 amount) external override {
    uint256 toMint = amount;
    if (underlying.balanceOf(address(this)) > 0) {
      toMint = totalSupply().mul(amount).div(underlying.balanceOf(address(this)));
    }
    underlying.safeTransferFrom(msg.sender, address(this), amount);
    _mint(msg.sender, toMint);
  }

  function withdraw(uint256 amount) external override {
    uint256 toReturn = amount;
    if (totalSupply() > 0) {
      toReturn = amount.mul(underlying.balanceOf(address(this))).div(totalSupply());
    }
    underlying.safeTransfer(msg.sender, toReturn);
    _burn(msg.sender, amount);
  }

  function exchangeRateStored() external view override returns (uint256) {
    if (totalSupply() == 0) {
      return 1;
    }
    return underlying.balanceOf(address(this)).div(totalSupply());
  }
}

