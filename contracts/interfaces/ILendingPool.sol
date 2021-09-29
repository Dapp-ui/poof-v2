// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ILendingPool {
  function deposit (address _reserve, uint256 _amount, address _onBehalfOf, uint16 _referralCode) external;

  function withdraw (address _reserve, uint256 _amount, address _to) external;
}

