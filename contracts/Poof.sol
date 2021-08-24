// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./interfaces/IVerifier.sol";

// TODO
// 1. Support lending

interface IFeeManager {
  function feeTo() external view returns (address);
  function protocolFeeDivisor() external view returns (uint256);
}

contract Poof is Ownable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IFeeManager public feeManager;
  IERC20 public token;

  IVerifier public depositVerifier;
  IVerifier public withdrawVerifier;
  IVerifier public treeUpdateVerifier;

  mapping(bytes32 => bool) public accountNullifiers;

  uint256 public accountCount;
  uint256 public constant ACCOUNT_ROOT_HISTORY_SIZE = 100;
  bytes32[ACCOUNT_ROOT_HISTORY_SIZE] public accountRoots;

  event NewAccount(bytes32 commitment, bytes32 nullifier, bytes encryptedAccount, uint256 index);
  event VerifiersUpdated(address deposit, address withdraw, address treeUpdate);

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
    bytes32 extDataHash;
    WithdrawExtData extData;
    AccountUpdate account;
  }

  constructor(
    IERC20 _token,
    IFeeManager _feeManager,
    address[3] memory _verifiers,
    bytes32 _accountRoot
  ) {
    token = _token;
    feeManager = _feeManager;
    accountRoots[0] = _accountRoot;
    // prettier-ignore
    _setVerifiers([
      IVerifier(_verifiers[0]),
      IVerifier(_verifiers[1]),
      IVerifier(_verifiers[2])
    ]);
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
  ) public {
    require(_fromArgs.amount - _fromArgs.extData.fee == _toArgs.amount, "Transfer is unfair");
    require(_fromArgs.extData.depositProofHash == keccak248(abi.encode(_toProof)), "'from' proof hash does not match 'to' proof hash");

    // Validate and update the `to` account
    validateAccountUpdate(_toArgs.account, _toTreeUpdateProof, _toTreeUpdateArgs);
    require(_toArgs.extDataHash == keccak248(abi.encode(_toArgs.extData)), "Incorrect 'to' external data hash");
    require(
      depositVerifier.verifyProof(
        _toProof,
        [
          uint256(_toArgs.amount),
          uint256(_toArgs.extDataHash),
          uint256(_toArgs.account.inputRoot),
          uint256(_toArgs.account.inputNullifierHash),
          uint256(_toArgs.account.outputRoot),
          uint256(_toArgs.account.outputPathIndices),
          uint256(_toArgs.account.outputCommitment)
        ]
      ),
      "Invalid deposit proof"
    );

    accountNullifiers[_toArgs.account.inputNullifierHash] = true;
    insertAccountRoot(_toArgs.account.inputRoot == getLastAccountRoot() ? _toArgs.account.outputRoot : _toTreeUpdateArgs.newRoot);

    emit NewAccount(
      _toArgs.account.outputCommitment,
      _toArgs.account.inputNullifierHash,
      _toArgs.extData.encryptedAccount,
      accountCount - 1
    );

    // Validate and update the `from` account
    validateAccountUpdate(_fromArgs.account, _fromTreeUpdateProof, _fromTreeUpdateArgs);
    require(_fromArgs.extDataHash == keccak248(abi.encode(_fromArgs.extData)), "Incorrect 'from' external data hash");
    require(
      withdrawVerifier.verifyProof(
        _fromProof,
        [
          uint256(_fromArgs.amount),
          uint256(_fromArgs.extDataHash),
          uint256(_fromArgs.account.inputRoot),
          uint256(_fromArgs.account.inputNullifierHash),
          uint256(_fromArgs.account.outputRoot),
          uint256(_fromArgs.account.outputPathIndices),
          uint256(_fromArgs.account.outputCommitment)
        ]
      ),
      "Invalid withdrawal proof"
    );

    if (_fromArgs.extData.fee > 0) {
      token.transfer(_fromArgs.extData.relayer, _fromArgs.extData.fee);
    }

    accountNullifiers[_fromArgs.account.inputNullifierHash] = true;
    insertAccountRoot(_fromArgs.account.inputRoot == getLastAccountRoot() ? _fromArgs.account.outputRoot : _fromTreeUpdateArgs.newRoot);

    emit NewAccount(
      _fromArgs.account.outputCommitment,
      _fromArgs.account.inputNullifierHash,
      _fromArgs.extData.encryptedAccount,
      accountCount - 1
    );
  }

  function deposit(bytes memory _proof, DepositArgs memory _args) public {
    deposit(_proof, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function deposit(
    bytes memory _proof,
    DepositArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public {
    validateAccountUpdate(_args.account, _treeUpdateProof, _treeUpdateArgs);
    require(_args.extDataHash == keccak248(abi.encode(_args.extData)), "Incorrect external data hash");
    token.safeTransferFrom(msg.sender, address(this), _args.amount);
    require(
      depositVerifier.verifyProof(
        _proof,
        [
          uint256(_args.amount),
          uint256(_args.extDataHash),
          uint256(_args.account.inputRoot),
          uint256(_args.account.inputNullifierHash),
          uint256(_args.account.outputRoot),
          uint256(_args.account.outputPathIndices),
          uint256(_args.account.outputCommitment)
        ]
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

  function withdraw(bytes memory _proof, WithdrawArgs memory _args) public {
    withdraw(_proof, _args, new bytes(0), TreeUpdateArgs(0, 0, 0, 0));
  }

  function withdraw(
    bytes memory _proof,
    WithdrawArgs memory _args,
    bytes memory _treeUpdateProof,
    TreeUpdateArgs memory _treeUpdateArgs
  ) public {
    validateAccountUpdate(_args.account, _treeUpdateProof, _treeUpdateArgs);
    require(_args.extDataHash == keccak248(abi.encode(_args.extData)), "Incorrect external data hash");
    require(_args.amount < 2**248, "Amount value out of range");
    require(
      withdrawVerifier.verifyProof(
        _proof,
        [
          uint256(_args.amount),
          uint256(_args.extDataHash),
          uint256(_args.account.inputRoot),
          uint256(_args.account.inputNullifierHash),
          uint256(_args.account.outputRoot),
          uint256(_args.account.outputPathIndices),
          uint256(_args.account.outputCommitment)
        ]
      ),
      "Invalid withdrawal proof"
    );

    address feeTo = feeManager.feeTo();
    uint256 protocolFeeDivisor = feeManager.protocolFeeDivisor();

    bool feeOn = feeTo != address(0) && protocolFeeDivisor != 0;
    uint256 protocolFee = feeOn ? _args.amount.div(protocolFeeDivisor) : 0;
    uint256 amount = _args.amount.sub(_args.extData.fee.add(protocolFee), "Amount should be greater than fee");
    if (amount > 0) {
      token.transfer(_args.extData.recipient, amount);
    }
    if (_args.extData.fee > 0) {
      token.transfer(_args.extData.relayer, _args.extData.fee);
    }
    if (feeOn) {
      token.transfer(feeTo, protocolFee);
    }

    insertAccountRoot(_args.account.inputRoot == getLastAccountRoot() ? _args.account.outputRoot : _treeUpdateArgs.newRoot);
    accountNullifiers[_args.account.inputNullifierHash] = true;

    emit NewAccount(
      _args.account.outputCommitment,
      _args.account.inputNullifierHash,
      _args.extData.encryptedAccount,
      accountCount - 1
    );
  }

  function setVerifiers(IVerifier[3] calldata _verifiers) external onlyOwner {
    _setVerifiers(_verifiers);
  }

  function setFeeManager(IFeeManager _feeManager) external onlyOwner {
    feeManager = _feeManager;
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
        [uint256(_args.oldRoot), uint256(_args.newRoot), uint256(_args.leaf), uint256(_args.pathIndices)]
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

  function _setVerifiers(IVerifier[3] memory _verifiers) internal {
    depositVerifier = _verifiers[0];
    withdrawVerifier = _verifiers[1];
    treeUpdateVerifier = _verifiers[2];
    emit VerifiersUpdated(address(_verifiers[0]), address(_verifiers[1]), address(_verifiers[2]));
  }
}
