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
    IVerifier[5] memory _verifiers,
    bytes32 _accountRoot
  ) PoofBase(_verifiers, _accountRoot) {
    token = _token;
  }

  function deposit(bytes[3] memory _proofs, DepositArgs memory _args) external virtual {
    require(_args.debt == 0, "Cannot use debt for depositing");
    deposit(_proofs, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function deposit(
    bytes[3] memory _proofs,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public virtual {
    beforeDeposit(_proofs, _args, _treeUpdateProof, _treeUpdateArgs);
    token.safeTransferFrom(msg.sender, address(this), _args.amount);
  }

  function withdraw(bytes[3] memory _proofs, WithdrawArgs memory _args) external virtual {
    require(_args.debt == 0, "Cannot use debt for withdrawing");
    withdraw(_proofs, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function withdraw(
    bytes[3] memory _proofs,
    WithdrawArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public virtual {
    beforeWithdraw(_proofs, _args, _treeUpdateProof, _treeUpdateArgs);
    uint256 amount = _args.amount.sub(_args.extData.fee, "Amount should be greater than fee");
    if (amount > 0) {
      token.safeTransfer(_args.extData.recipient, amount);
    }
    if (_args.extData.fee > 0) {
      token.safeTransfer(_args.extData.relayer, _args.extData.fee);
    }
  }
}
