// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/ILendingPool.sol";

contract MockLendingPool is ILendingPool, ERC20 {
  using SafeERC20 for IERC20;

  IERC20 public immutable underlying;

  constructor(IERC20 _underlying) ERC20("Mock", "M") {
    underlying = _underlying;
  }

  function deposit(
    address _reserve,
    uint256 _amount,
    address _onBehalfOf,
    uint16
  ) external override {
    require(_reserve == address(underlying), "Incorrect reserve token");
    IERC20(_reserve).safeTransferFrom(_onBehalfOf, address(this), _amount);
    _mint(_onBehalfOf, _amount);
  }

  function withdraw(
    address,
    uint256 _amount,
    address _to
  ) external override {
    _burn(msg.sender, _amount);
    underlying.safeTransfer(_to, _amount);
  }
}
