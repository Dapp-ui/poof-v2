// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ISafeBox {
  function cToken() external view returns (address);

  function uToken() external view returns (address);

  function balanceOfUnderlying(address owner) external view returns (uint256);

  function deposit(uint256 amount) external;

  function withdraw(uint256 amount) external;
}

