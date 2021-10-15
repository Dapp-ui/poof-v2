// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./../interfaces/IVerifier.sol";
import "./../PoofBase.sol";

contract PoofVal is PoofBase {
  using SafeMath for uint256;

  constructor(
    IVerifier[3] memory _verifiers,
    bytes32 _accountRoot
  ) PoofBase(_verifiers, _accountRoot) {}

  function transfer(
    bytes memory _fromProof,
    WithdrawArgs memory _fromArgs,
    bytes memory _toProof,
    DepositArgs memory _toArgs,
    bytes memory _fromTreeUpdateProof,
    TreeUpdateArgs memory _fromTreeUpdateArgs,
    bytes memory _toTreeUpdateProof,
    TreeUpdateArgs memory _toTreeUpdateArgs
  ) external {
    require(_fromArgs.amount - _fromArgs.extData.fee == _toArgs.amount, "'from' transfer amount does not equal the 'to' transfer amount");
    require(_fromArgs.extData.depositProofHash == keccak248(abi.encode(_toProof)), "'from' proof hash does not match 'to' proof hash");

    // Validate and update the `to` account
    beforeDeposit(_toProof, _toArgs, _toTreeUpdateProof, _toTreeUpdateArgs);

    // Validate and update the `from` account
    beforeWithdraw(_fromProof, _fromArgs, _fromTreeUpdateProof, _fromTreeUpdateArgs);

    if (_fromArgs.extData.fee > 0) {
      (bool ok, ) = _fromArgs.extData.relayer.call{value: _fromArgs.extData.fee}("");
      require(ok, "Failed to send fee to relayer");
    }
  }

  function deposit(bytes memory _proof, DepositArgs memory _args) external payable virtual {
    require(_args.debt == 0, "Cannot use debt for depositing");
    deposit(_proof, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function deposit(
    bytes memory _proof,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public payable virtual {
    beforeDeposit(_proof, _args, _treeUpdateProof, _treeUpdateArgs);
    require(msg.value == _args.amount, "Specified amount must equal msg.value");
  }

  function withdraw(bytes memory _proof, WithdrawArgs memory _args) external virtual {
    require(_args.debt == 0, "Cannot use debt for withdrawing");
    withdraw(_proof, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function withdraw(
    bytes memory _proof,
    WithdrawArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public virtual {
    beforeWithdraw(_proof, _args, _treeUpdateProof, _treeUpdateArgs);
    require(_args.extData.depositProofHash == bytes32(0), "`depositProofHash` should be zeroed");
    uint256 amount = _args.amount.sub(_args.extData.fee, "Amount should be greater than fee");
    if (amount > 0) {
      (bool ok, ) = _args.extData.recipient.call{value: amount}("");
      require(ok, "Failed to send amount to recipient");
    }
    if (_args.extData.fee > 0) {
      (bool ok, ) = _args.extData.relayer.call{value: _args.extData.fee}("");
      require(ok, "Failed to send fee to relayer");
    }
  }
}
