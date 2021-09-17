// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract VIP {
  mapping(address => bool) public invited;
  
  constructor() {
    invited[msg.sender] = true;
  }

  function invite(address _guest) public {
    require(invited[msg.sender], "Uninvited guest inviting another uninvited guest");
    invited[_guest] = true;
  }

  function batchInvite(address[] memory _guests) public {
    require(invited[msg.sender], "Uninvited guest inviting another uninvited guest");
    for (uint i = 0; i < _guests.length; i++) {
      invited[_guests[i]] = true;
    }
  }
}
