// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./Poof.sol";
import "./interfaces/IVerifier.sol";

contract PoofMintable is Poof, ERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  constructor(
    string memory _tokenName,
    string memory _tokenSymbol,
    IERC20 _token,
    IVerifier[3] memory _verifiers,
    bytes32 _accountRoot
  ) ERC20(_tokenName, _tokenSymbol) Poof(_token, _verifiers, _accountRoot) {
    token = _token;
    accountRoots[0] = _accountRoot;
    depositVerifier = _verifiers[0];
    withdrawVerifier = _verifiers[1];
    treeUpdateVerifier = _verifiers[2];
  }

  function burn(bytes memory _proof, DepositArgs memory _args) public {
    // Check operation here to ensure that the proof is not used for depositing
    require(_args.extData.operation == Operation.BURN, "Incorrect operation");
    burn(_proof, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function burn(
    bytes memory _proof,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public {
    beforeDeposit(_proof, _args, _treeUpdateProof, _treeUpdateArgs);
    _burn(msg.sender, _args.amount);
  }

  function mint(bytes memory _proof, WithdrawArgs memory _args) public {
    // Check operation here to ensure that the proof is not used for withdrawing
    require(_args.extData.operation == Operation.MINT, "Incorrect operation");
    mint(_proof, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function mint(
    bytes memory _proof,
    WithdrawArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public {
    beforeWithdraw(_proof, _args, _treeUpdateProof, _treeUpdateArgs);
    uint256 amount = _args.amount.sub(_args.extData.fee, "Amount should be greater than fee");
    if (amount > 0) {
      _mint(_args.extData.recipient, amount);
    }
    if (_args.extData.fee > 0) {
      token.transfer(_args.extData.relayer, _args.extData.fee);
    }
  }
}

