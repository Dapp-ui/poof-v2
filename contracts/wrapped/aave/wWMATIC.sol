// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedATokenVal.sol";

contract wWMATIC is WrappedATokenVal {
  constructor(address _aToken, address _lendingPool, address _wethGateway, address _feeToSetter)
    WrappedATokenVal("Wrapped WMATIC", "wWMATIC", _aToken, _lendingPool, _wethGateway, _feeToSetter)
  {}
}

