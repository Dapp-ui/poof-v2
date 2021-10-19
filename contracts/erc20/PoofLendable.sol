// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./Poof.sol";
import "./../interfaces/IVerifier.sol";
import "./../interfaces/IWERC20.sol";

contract PoofLendable is Poof {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public underlyingToken;
  IWERC20 public debtToken;

  constructor(
    IWERC20 _debtToken,
    IVerifier[5] memory _verifiers,
    bytes32 _accountRoot
  ) Poof(_debtToken, _verifiers, _accountRoot) {
    underlyingToken = IERC20(_debtToken.underlyingToken());
    debtToken = _debtToken;
  }

  function deposit(bytes[3] memory _proofs, DepositArgs memory _args) external override {
    deposit(_proofs, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function deposit(
    bytes[3] memory _proofs,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public override {
    beforeDeposit(_proofs, _args, _treeUpdateProof, _treeUpdateArgs);
    uint256 underlyingAmount = debtToken.debtToUnderlying(_args.amount);
    underlyingToken.safeTransferFrom(msg.sender, address(this), underlyingAmount);
    require(underlyingToken.approve(address(debtToken), underlyingAmount), "Approve failed");
    debtToken.wrap(underlyingAmount);
  }

  function withdraw(bytes[3] memory _proofs, WithdrawArgs memory _args) external override {
    withdraw(_proofs, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function withdraw(
    bytes[3] memory _proofs,
    WithdrawArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public override {
    beforeWithdraw(_proofs, _args, _treeUpdateProof, _treeUpdateArgs);
    require(_args.amount >= _args.extData.fee, "Fee cannot be greater than amount");
    uint256 underlyingAmount = debtToken.debtToUnderlying(_args.amount.sub(_args.extData.fee));
    uint256 underlyingFeeAmount = debtToken.debtToUnderlying(_args.extData.fee);
    debtToken.unwrap(_args.amount);

    if (underlyingAmount > 0) {
      underlyingToken.safeTransfer(_args.extData.recipient, underlyingAmount);
    }
    if (underlyingFeeAmount > 0) {
      underlyingToken.safeTransfer(_args.extData.relayer, underlyingFeeAmount);
    }
  }

  function unitPerUnderlying() public view override returns (uint256) {
    return debtToken.underlyingToDebt(1);
  }
}

