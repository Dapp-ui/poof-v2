// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedATokenVal.sol";

contract wWAVAX is WrappedATokenVal {
  constructor(address _aToken, address _lendingPool, address _wethGateway, address _feeToSetter)
    WrappedATokenVal("Wrapped WAVAX", "wWAVAX", _aToken, _lendingPool, _wethGateway, _feeToSetter)
  {}
}
