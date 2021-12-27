// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./PToken.sol";

contract V1Migration is Ownable {
    using SafeERC20 for IERC20;
    IERC20 public immutable v1;
    PToken public immutable v2;

    mapping(address => bool) public whitelist;

    event WhitelistAdd(address indexed user);
    event WhitelistRemove(address indexed user);

    modifier onlyWhitelist() {
        require(
            whitelist[msg.sender],
            "V1Migration: caller is not on the whitelist"
        );
        _;
    }

    constructor(IERC20 _v1, PToken _v2) {
        v1 = _v1;
        v2 = _v2;
    }

    function mint(uint256 _amount) external onlyWhitelist {
        v1.safeTransferFrom(msg.sender, address(this), _amount);
        v2.mint(msg.sender, _amount);
    }

    function burn(uint256 _amount) external onlyWhitelist {
        v2.burn(msg.sender, _amount);
        v1.safeTransfer(msg.sender, _amount);
    }

    function addToWhitelist(address _user) external onlyOwner {
        whitelist[_user] = true;
        emit WhitelistAdd(_user);
    }

    function removeFromWhitelist(address _user) external onlyOwner {
        whitelist[_user] = false;
        emit WhitelistRemove(_user);
    }
}
