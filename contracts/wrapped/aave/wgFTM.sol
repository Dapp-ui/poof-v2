// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedATokenVal.sol";

contract wgFTM is WrappedATokenVal {
  constructor(address _gToken, address _lendingPool, address _wethGateway, address _feeToSetter)
    WrappedATokenVal("Wrapped gFTM", "wgFTM", _gToken, _lendingPool, _wethGateway, _feeToSetter)
  {}
}
