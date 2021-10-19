// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./Poof.sol";
import "./../interfaces/IVerifier.sol";

abstract contract PoofMintable is Poof, ERC20 {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  constructor(
    string memory _tokenName,
    string memory _tokenSymbol,
    IERC20 _token,
    IVerifier[5] memory _verifiers,
    bytes32 _accountRoot
  ) ERC20(_tokenName, _tokenSymbol) Poof(_token, _verifiers, _accountRoot) {}

  function burn(bytes[3] memory _proofs, DepositArgs memory _args) external {
    burn(_proofs, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function burn(
    bytes[3] memory _proofs,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public {
    require(_args.amount == 0, "Cannot use amount for burning");
    beforeDeposit(_proofs, _args, _treeUpdateProof, _treeUpdateArgs);
    _burn(msg.sender, _args.debt);
  }

  function mint(bytes[3] memory _proofs, WithdrawArgs memory _args) external {
    mint(_proofs, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function mint(
    bytes[3] memory _proofs,
    WithdrawArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public {
    require(_args.amount == _args.extData.fee, "Amount can only be used for fee");
    beforeWithdraw(_proofs, _args, _treeUpdateProof, _treeUpdateArgs);
    if (_args.debt > 0) {
      _mint(_args.extData.recipient, _args.debt);
    }
    if (_args.extData.fee > 0) {
      token.safeTransfer(_args.extData.relayer, _args.extData.fee);
    }
  }
}

