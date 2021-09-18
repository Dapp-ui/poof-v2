// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWERC20 is IERC20 {
  function wrap(uint256 underlyingAmount) external;

  function unwrap(uint256 debtAmount) external;

  function underlyingToDebt(uint256 underlyingAmount) external view returns (uint256);

  function debtToUnderlying(uint256 debtAmount) external view returns (uint256);

  function underlyingToken() external view returns (address);

  function underlyingBalanceOf(address owner) external view returns (uint256);
}

