// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./PToken.sol";

contract V1Migration {
    using SafeERC20 for IERC20;
    IERC20 public immutable v1;
    PToken public immutable v2;

    constructor(IERC20 _v1, PToken _v2) {
        v1 = _v1;
        v2 = _v2;
    }

    function mint(uint256 _amount) external {
        v1.safeTransferFrom(msg.sender, address(this), _amount);
        v2.mint(msg.sender, _amount);
    }

    function burn(uint256 _amount) external {
        v2.burn(msg.sender, _amount);
        v1.safeTransfer(msg.sender, _amount);
    }
}
