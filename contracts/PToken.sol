// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PToken is ERC20, Ownable {
    mapping(address => bool) public supplyManagers;

    constructor(string memory symbol, string memory name) ERC20(symbol, name) {}

    event SupplyManagerAdded(address indexed supplyManager);
    event SupplyManagerRenounced(address indexed supplyManager);

    modifier onlySupplyManager() {
        require(supplyManagers[msg.sender], "PToken: caller is not a supply manager");
        _;
    }

    function mint(address _to, uint256 _amount) external onlySupplyManager {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external onlySupplyManager {
        _burn(_from, _amount);
    }

    function addSupplyManager(address _supplyManager) external onlyOwner {
        supplyManagers[_supplyManager] = true;
        emit SupplyManagerAdded(_supplyManager);
    }

    function renounceSupplyManager(address _supplyManager) external onlyOwner {
        supplyManagers[_supplyManager] = false;
        emit SupplyManagerRenounced(_supplyManager);
    }
}
