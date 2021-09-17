// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ILendingPool {
  function deposit (address _reserve, uint256 _amount, uint16 _referralCode) external;

  function core() external view returns (address);
}

