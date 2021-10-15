// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./WrappedGToken.sol";

contract wgFTM is WrappedGToken {
  constructor(address _gToken, address _lendingPool, address _wethGateway, address _feeToSetter)
    WrappedGToken("Wrapped gFTM", "wgFTM", _gToken, _lendingPool, _wethGateway, _feeToSetter)
  {}
}
