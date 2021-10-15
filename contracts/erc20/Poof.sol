// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./../interfaces/IVerifier.sol";
import "./../PoofBase.sol";

contract Poof is PoofBase {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  IERC20 public token;

  constructor(
    IERC20 _token,
    IVerifier[3] memory _verifiers,
    bytes32 _accountRoot
  ) PoofBase(_verifiers, _accountRoot) {
    token = _token;
  }

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
      token.safeTransfer(_fromArgs.extData.relayer, _fromArgs.extData.fee);
    }
  }

  function deposit(bytes memory _proof, DepositArgs memory _args) external virtual {
    require(_args.debt == 0, "Cannot use debt for depositing");
    deposit(_proof, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function deposit(
    bytes memory _proof,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public virtual {
    beforeDeposit(_proof, _args, _treeUpdateProof, _treeUpdateArgs);
    token.safeTransferFrom(msg.sender, address(this), _args.amount);
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
      token.safeTransfer(_args.extData.recipient, amount);
    }
    if (_args.extData.fee > 0) {
      token.safeTransfer(_args.extData.relayer, _args.extData.fee);
    }
  }
}
