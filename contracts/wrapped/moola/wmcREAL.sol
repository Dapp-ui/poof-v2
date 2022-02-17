// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedMToken.sol";

contract wmcREAL is WrappedMToken {
  constructor(address _mToken, address _token, address _lendingPool, address _feeToSetter)
    WrappedMToken("Wrapped mcREAL", "wmcREAL", _mToken, _token, _lendingPool, _feeToSetter)
  {}
}
