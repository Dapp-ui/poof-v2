// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedAToken.sol";

contract waAVAX is WrappedAToken {
  constructor(address _aToken, address _lendingPool, address _wethGateway, address _feeToSetter)
    WrappedAToken("Wrapped aAVAX", "waAVAX", _aToken, _lendingPool, _wethGateway, _feeToSetter)
  {}
}
