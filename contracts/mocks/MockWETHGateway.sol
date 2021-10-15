// SPDX-License-Identifier: MIT

pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../interfaces/IWETHGateway.sol";

contract MockWETHGateway is IWETHGateway, ERC20 {
  using SafeERC20 for IERC20;

  constructor() ERC20("Mock", "M") {}

  function depositETH(
    address,
    address _onBehalfOf,
    uint16
  ) external payable override {
    _mint(_onBehalfOf, msg.value);
  }

  function withdrawETH(
    address,
    uint256 _amount,
    address _onBehalfOf
  ) external override {
    _burn(msg.sender, _amount);
    (bool ok, ) = _onBehalfOf.call{value: _amount}("");
    require(ok, "Failed to withdraw ETH");
  }
}
