// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedMToken.sol";

contract wmcUSD is WrappedMToken {
  constructor(address _mToken, address _token, address _lendingPool)
    WrappedMToken("Wrapped mcUSD", "wmcUSD", _mToken, _token, _lendingPool)
  {}
}
