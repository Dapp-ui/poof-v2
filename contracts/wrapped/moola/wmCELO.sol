// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedMToken.sol";

contract wmCELO is WrappedMToken {
  constructor(address _mToken, address _token, address _lendingPool, address _feeToSetter)
    WrappedMToken("Wrapped mCELO", "wmCELO", _mToken, _token, _lendingPool, _feeToSetter)
  {}
}
