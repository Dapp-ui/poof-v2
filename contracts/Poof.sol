// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/IVerifier.sol";

contract Poof {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public token;

  IVerifier public depositVerifier;
  IVerifier public withdrawVerifier;
  IVerifier public treeUpdateVerifier;

  mapping(bytes32 => bool) public accountNullifiers;

  uint256 public accountCount;
  uint256 public constant ACCOUNT_ROOT_HISTORY_SIZE = 100;
  bytes32[ACCOUNT_ROOT_HISTORY_SIZE] public accountRoots;

  event NewAccount(bytes32 commitment, bytes32 nullifier, bytes encryptedAccount, uint256 index);

  struct TreeUpdateArgs {
    bytes32 oldRoot;
    bytes32 newRoot;
    bytes32 leaf;
    uint256 pathIndices;
  }

  struct AccountUpdate {
    bytes32 inputRoot;
    bytes32 inputNullifierHash;
    bytes32 outputRoot;
    uint256 outputPathIndices;
    bytes32 outputCommitment;
  }

  struct DepositExtData {
    bytes encryptedAccount;
  }

  struct DepositArgs {
    uint256 amount;
    uint256 debt;
    uint256 unitPerUnderlying;
    bytes32 extDataHash;
    DepositExtData extData;
    AccountUpdate account;
  }

  struct TransferExtData {
    uint256 fee;
    address relayer;
    bytes32 depositProofHash;
    bytes encryptedAccount;
  }

  struct TransferArgs {
    uint256 amount;
    uint256 debt;
    uint256 unitPerUnderlying;
    bytes32 extDataHash;
    TransferExtData extData;
    AccountUpdate account;
  }

  struct WithdrawExtData {
    uint256 fee;
    address recipient;
    address relayer;
    bytes encryptedAccount;
  }

  struct WithdrawArgs {
    uint256 amount;
    uint256 debt;
    uint256 unitPerUnderlying;
    bytes32 extDataHash;
    WithdrawExtData extData;
    AccountUpdate account;
  }

  constructor(
    IERC20 _token,
    IVerifier[3] memory _verifiers,
    bytes32 _accountRoot
  ) {
    token = _token;
    accountRoots[0] = _accountRoot;
    depositVerifier = _verifiers[0];
    withdrawVerifier = _verifiers[1];
    treeUpdateVerifier = _verifiers[2];
  }

  function toDynamicArray(uint256[4] memory arr) internal pure returns (uint256[] memory) {
    uint256[] memory res = new uint256[](4);
    for (uint i = 0; i < arr.length; i++) {
      res[i] = arr[i];
    }
    return res;
  }

  function toDynamicArray(uint256[9] memory arr) internal pure returns (uint256[] memory) {
    uint256[] memory res = new uint256[](9);
    for (uint i = 0; i < arr.length; i++) {
      res[i] = arr[i];
    }
    return res;
  }

  function transfer(
    bytes memory _fromProof,
    TransferArgs memory _fromArgs,
    bytes memory _toProof,
    DepositArgs memory _toArgs,
    bytes memory _fromTreeUpdateProof,
    TreeUpdateArgs memory _fromTreeUpdateArgs,
    bytes memory _toTreeUpdateProof,
    TreeUpdateArgs memory _toTreeUpdateArgs
  ) external {
    require(_fromArgs.amount - _fromArgs.extData.fee == _toArgs.amount, "Transfer is unfair");
    require(_fromArgs.extData.depositProofHash == keccak248(abi.encode(_toProof)), "'from' proof hash does not match 'to' proof hash");

    // Validate and update the `to` account
    beforeDeposit(_toProof, _toArgs, _toTreeUpdateProof, _toTreeUpdateArgs);

    // Validate and update the `from` account
    validateAccountUpdate(_fromArgs.account, _fromTreeUpdateProof, _fromTreeUpdateArgs);
    require(_fromArgs.extDataHash == keccak248(abi.encode(_fromArgs.extData)), "Incorrect 'from' external data hash");
    require(_fromArgs.amount < 2**248, "Amount value out of range");
    require(_fromArgs.amount >= _fromArgs.extData.fee, "Amount should be >= than fee");
    require(_fromArgs.unitPerUnderlying >= unitPerUnderlying(), "Underlying per unit is overstated");
    require(
      withdrawVerifier.verifyProof(
        _fromProof,
        toDynamicArray([
          uint256(_fromArgs.amount),
          uint256(_fromArgs.debt),
          uint256(_fromArgs.unitPerUnderlying),
          uint256(_fromArgs.extDataHash),
          uint256(_fromArgs.account.inputRoot),
          uint256(_fromArgs.account.inputNullifierHash),
          uint256(_fromArgs.account.outputRoot),
          uint256(_fromArgs.account.outputPathIndices),
          uint256(_fromArgs.account.outputCommitment)
        ])
      ),
      "Invalid withdrawal proof"
    );

    accountNullifiers[_fromArgs.account.inputNullifierHash] = true;
    insertAccountRoot(_fromArgs.account.inputRoot == getLastAccountRoot() ? _fromArgs.account.outputRoot : _fromTreeUpdateArgs.newRoot);

    emit NewAccount(
      _fromArgs.account.outputCommitment,
      _fromArgs.account.inputNullifierHash,
      _fromArgs.extData.encryptedAccount,
      accountCount - 1
    );

    if (_fromArgs.extData.fee > 0) {
      token.safeTransfer(_fromArgs.extData.relayer, _fromArgs.extData.fee);
    }
  }

  function beforeDeposit(
    bytes memory _proof,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) internal {
    validateAccountUpdate(_args.account, _treeUpdateProof, _treeUpdateArgs);
    require(_args.extDataHash == keccak248(abi.encode(_args.extData)), "Incorrect external data hash");
    require(_args.unitPerUnderlying >= unitPerUnderlying(), "Underlying per unit is overstated");
    require(
      depositVerifier.verifyProof(
        _proof,
        toDynamicArray([
          uint256(_args.amount),
          uint256(_args.debt),
          uint256(_args.unitPerUnderlying),
          uint256(_args.extDataHash),
          uint256(_args.account.inputRoot),
          uint256(_args.account.inputNullifierHash),
          uint256(_args.account.outputRoot),
          uint256(_args.account.outputPathIndices),
          uint256(_args.account.outputCommitment)
        ])
      ),
      "Invalid deposit proof"
    );

    accountNullifiers[_args.account.inputNullifierHash] = true;
    insertAccountRoot(_args.account.inputRoot == getLastAccountRoot() ? _args.account.outputRoot : _treeUpdateArgs.newRoot);

    emit NewAccount(
      _args.account.outputCommitment,
      _args.account.inputNullifierHash,
      _args.extData.encryptedAccount,
      accountCount - 1
    );
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

  function beforeWithdraw(
    bytes memory _proof,
    WithdrawArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) internal {
    validateAccountUpdate(_args.account, _treeUpdateProof, _treeUpdateArgs);
    require(_args.extDataHash == keccak248(abi.encode(_args.extData)), "Incorrect external data hash");
    // Input check because zkSNARKs work modulo p
    require(_args.amount < 2**248, "Amount value out of range");
    require(_args.debt < 2**248, "Debt value out of range");
    require(_args.amount >= _args.extData.fee, "Amount should be >= than fee");
    require(_args.unitPerUnderlying >= unitPerUnderlying(), "Underlying per unit is overstated");
    require(
      withdrawVerifier.verifyProof(
        _proof,
        toDynamicArray([
          uint256(_args.amount),
          uint256(_args.debt),
          uint256(_args.unitPerUnderlying),
          uint256(_args.extDataHash),
          uint256(_args.account.inputRoot),
          uint256(_args.account.inputNullifierHash),
          uint256(_args.account.outputRoot),
          uint256(_args.account.outputPathIndices),
          uint256(_args.account.outputCommitment)
        ])
      ),
      "Invalid withdrawal proof"
    );

    insertAccountRoot(_args.account.inputRoot == getLastAccountRoot() ? _args.account.outputRoot : _treeUpdateArgs.newRoot);
    accountNullifiers[_args.account.inputNullifierHash] = true;

    emit NewAccount(
      _args.account.outputCommitment,
      _args.account.inputNullifierHash,
      _args.extData.encryptedAccount,
      accountCount - 1
    );
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
    uint256 amount = _args.amount.sub(_args.extData.fee, "Amount should be greater than fee");
    if (amount > 0) {
      token.safeTransfer(_args.extData.recipient, amount);
    }
    if (_args.extData.fee > 0) {
      token.safeTransfer(_args.extData.relayer, _args.extData.fee);
    }
  }

  // ------VIEW-------

  /**
    @dev Whether the root is present in the root history
    */
  function isKnownAccountRoot(bytes32 _root, uint256 _index) public view returns (bool) {
    return _root != 0 && accountRoots[_index % ACCOUNT_ROOT_HISTORY_SIZE] == _root;
  }

  /**
    @dev Returns the last root
    */
  function getLastAccountRoot() public view returns (bytes32) {
    return accountRoots[accountCount % ACCOUNT_ROOT_HISTORY_SIZE];
  }

  function unitPerUnderlying() public view virtual returns (uint256) {
    return 1;
  }

  // -----INTERNAL-------

  function keccak248(bytes memory _data) internal pure returns (bytes32) {
    return keccak256(_data) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
  }

  function validateTreeUpdate(
    bytes memory _proof,
    TreeUpdateArgs memory _args,
    bytes32 _commitment
  ) internal view {
    require(_proof.length > 0, "Outdated account merkle root");
    require(_args.oldRoot == getLastAccountRoot(), "Outdated tree update merkle root");
    require(_args.leaf == _commitment, "Incorrect commitment inserted");
    require(_args.pathIndices == accountCount, "Incorrect account insert index");
    require(
      treeUpdateVerifier.verifyProof(
        _proof,
        toDynamicArray([uint256(_args.oldRoot), uint256(_args.newRoot), uint256(_args.leaf), uint256(_args.pathIndices)])
      ),
      "Invalid tree update proof"
    );
  }

  function validateAccountUpdate(
    AccountUpdate memory _account,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) internal view {
    // Has to be a new nullifier hash
    require(!accountNullifiers[_account.inputNullifierHash], "Outdated account state");
    if (_account.inputRoot != getLastAccountRoot()) {
      // _account.outputPathIndices (= last tree leaf index) is always equal to root index in the history mapping
      // because we always generate a new root for each new leaf
      require(isKnownAccountRoot(_account.inputRoot, _account.outputPathIndices), "Invalid account root");
      validateTreeUpdate(_treeUpdateProof, _treeUpdateArgs, _account.outputCommitment);
    } else {
      require(_account.outputPathIndices == accountCount, "Incorrect account insert index");
    }
  }

  function insertAccountRoot(bytes32 _root) internal {
    accountRoots[++accountCount % ACCOUNT_ROOT_HISTORY_SIZE] = _root;
  }
  
}
