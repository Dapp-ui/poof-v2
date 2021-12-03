const { toBN } = require('web3-utils')
const {
  bitsToNumber,
  toFixedHex,
  poseidonHash2,
  getExtDepositArgsHash,
  getExtWithdrawArgsHash,
  packEncryptedMessage,
} = require('./utils')
const { utils } = require('ffjavascript')
const Account = require('./account')
const MerkleTree = require('fixed-merkle-tree')
const snarkjs = require('snarkjs')

class Controller {
  constructor({ contract, merkleTreeHeight, provingKeys }) {
    this.merkleTreeHeight = Number(merkleTreeHeight)
    this.contract = contract
    this.provingKeys = provingKeys
  }

  async _fetchAccountCommitments() {
    const events = await this.contract.getPastEvents('NewAccount', {
      fromBlock: 0,
      toBlock: 'latest',
    })
    return events
      .sort((a, b) => a.returnValues.index - b.returnValues.index)
      .map((e) => toBN(e.returnValues.commitment))
  }

  _updateTree(tree, element) {
    const oldRoot = tree.root()
    tree.insert(element)
    const newRoot = tree.root()
    const { pathElements, pathIndices } = tree.path(tree.elements().length - 1)
    return {
      oldRoot,
      newRoot,
      pathElements,
      pathIndices: bitsToNumber(pathIndices),
    }
  }

  async deposit({
    account,
    amount,
    debt = toBN(0),
    unitPerUnderlying = toBN(1),
    publicKey,
    accountCommitments = null,
  }) {
    const newAmount = account.amount.add(amount)
    const newDebt = account.debt.sub(debt)
    const newAccount = new Account({ amount: newAmount, debt: newDebt })

    accountCommitments =
      accountCommitments || (await this._fetchAccountCommitments())
    const accountTree = new MerkleTree(
      this.merkleTreeHeight,
      accountCommitments,
      {
        hashFunction: poseidonHash2,
      },
    )
    const zeroAccount = {
      pathElements: new Array(this.merkleTreeHeight).fill(0),
      pathIndices: new Array(this.merkleTreeHeight).fill(0),
    }
    const accountIndex = accountTree.indexOf(account.commitment, (a, b) =>
      a.eq(b),
    )
    const accountPath =
      accountIndex !== -1 ? accountTree.path(accountIndex) : zeroAccount
    const accountTreeUpdate = this._updateTree(
      accountTree,
      newAccount.commitment,
    )

    const encryptedAccount = packEncryptedMessage(newAccount.encrypt(publicKey))
    const extDataHash = getExtDepositArgsHash({ encryptedAccount })

    const inputs = [{
      amount,
      debt,
      unitPerUnderlying,
      extDataHash,

      inputAmount: account.amount,
      inputDebt: account.debt,
      inputSecret: account.secret,
      inputNullifier: account.nullifier,
      inputSalt: account.salt,
      inputAccountHash: account.accountHash,

      outputAmount: newAccount.amount,
      outputDebt: newAccount.debt,
      outputSecret: newAccount.secret,
      outputNullifier: newAccount.nullifier,
      outputSalt: newAccount.salt,
      outputAccountHash: newAccount.accountHash,
    },
    {
      inputAmount: account.amount,
      inputDebt: account.debt,
      inputSecret: account.secret,
      inputNullifier: account.nullifier,
      inputSalt: account.salt,
      inputRoot: accountTreeUpdate.oldRoot,
      inputPathElements: accountPath.pathElements,
      inputPathIndices: bitsToNumber(accountPath.pathIndices),
      inputNullifierHash: account.nullifierHash,
      inputAccountHash: account.accountHash,
    },
    {
      inputRoot: accountTreeUpdate.oldRoot,

      outputAmount: newAccount.amount,
      outputDebt: newAccount.debt,
      outputSecret: newAccount.secret,
      outputNullifier: newAccount.nullifier,
      outputSalt: newAccount.salt,
      outputRoot: accountTreeUpdate.newRoot,
      outputPathIndices: accountTreeUpdate.pathIndices,
      outputPathElements: accountTreeUpdate.pathElements,
      outputCommitment: newAccount.commitment,
      outputAccountHash: newAccount.accountHash,
    }]

    const { proof: depositProofData } = await snarkjs.groth16.fullProve(
      utils.stringifyBigInts(inputs[0]),
      this.provingKeys.depositWasm,
      this.provingKeys.depositZkey,
    )
    const depositProof = (
      await snarkjs.groth16.exportSolidityCallData(
        utils.unstringifyBigInts(depositProofData),
        [],
      )
    ).split(',')[0]
    const { proof: inputRootProofData } = await snarkjs.groth16.fullProve(
      utils.stringifyBigInts(inputs[1]),
      this.provingKeys.inputRootWasm,
      this.provingKeys.inputRootZkey,
    )
    const inputRootProof = (
      await snarkjs.groth16.exportSolidityCallData(
        utils.unstringifyBigInts(inputRootProofData),
        [],
      )
    ).split(',')[0]
    const { proof: outputRootProofData } = await snarkjs.groth16.fullProve(
      utils.stringifyBigInts(inputs[2]),
      this.provingKeys.outputRootWasm,
      this.provingKeys.outputRootZkey,
    )
    const outputRootProof = (
      await snarkjs.groth16.exportSolidityCallData(
        utils.unstringifyBigInts(outputRootProofData),
        [],
      )
    ).split(',')[0]

    const args = {
      amount: toFixedHex(amount),
      debt: toFixedHex(debt),
      unitPerUnderlying: toFixedHex(unitPerUnderlying),
      extDataHash,
      extData: {
        encryptedAccount,
      },
      account: {
        inputRoot: toFixedHex(accountTreeUpdate.oldRoot),
        inputNullifierHash: toFixedHex(account.nullifierHash),
        inputAccountHash: toFixedHex(account.accountHash),
        outputRoot: toFixedHex(accountTreeUpdate.newRoot),
        outputPathIndices: toFixedHex(accountTreeUpdate.pathIndices),
        outputCommitment: toFixedHex(newAccount.commitment),
        outputAccountHash: toFixedHex(newAccount.accountHash),
      },
    }

    return {
      proofs: [depositProof, inputRootProof, outputRootProof],
      args,
      account: newAccount,
    }
  }

  async withdraw({
    account,
    amount: transferAmount,
    debt = toBN(0),
    publicKey,
    unitPerUnderlying = toBN(1),
    accountCommitments = null,
    recipient = toBN(0),
    fee = toBN(0),
    relayer = 0,
  }) {
    const amount = toBN(transferAmount).add(
      fee,
    )
    const newAmount = account.amount.sub(amount)
    const newDebt = account.debt.add(debt)
    const newAccount = new Account({ amount: newAmount, debt: newDebt })

    accountCommitments =
      accountCommitments || (await this._fetchAccountCommitments())
    const accountTree = new MerkleTree(
      this.merkleTreeHeight,
      accountCommitments,
      {
        hashFunction: poseidonHash2,
      },
    )
    const accountIndex = accountTree.indexOf(account.commitment, (a, b) =>
      a.eq(b),
    )
    if (accountIndex === -1) {
      throw new Error('No previous account found. Transfer will not work')
    }
    const accountPath = accountTree.path(accountIndex)
    const accountTreeUpdate = this._updateTree(
      accountTree,
      newAccount.commitment,
    )

    const encryptedAccount = packEncryptedMessage(newAccount.encrypt(publicKey))
    const extDataHash = getExtWithdrawArgsHash({
      fee,
      recipient,
      relayer,
      encryptedAccount,
    })

    const inputs = [{
      amount,
      debt,
      unitPerUnderlying,
      extDataHash,

      inputAmount: account.amount,
      inputDebt: account.debt,
      inputSecret: account.secret,
      inputNullifier: account.nullifier,
      inputSalt: account.salt,
      inputAccountHash: account.accountHash,

      outputAmount: newAccount.amount,
      outputDebt: newAccount.debt,
      outputSecret: newAccount.secret,
      outputNullifier: newAccount.nullifier,
      outputSalt: newAccount.salt,
      outputAccountHash: newAccount.accountHash,
    },
    {
      inputAmount: account.amount,
      inputDebt: account.debt,
      inputSecret: account.secret,
      inputNullifier: account.nullifier,
      inputSalt: account.salt,
      inputRoot: accountTreeUpdate.oldRoot,
      inputPathElements: accountPath.pathElements,
      inputPathIndices: bitsToNumber(accountPath.pathIndices),
      inputNullifierHash: account.nullifierHash,
      inputAccountHash: account.accountHash,
    },
    {
      inputRoot: accountTreeUpdate.oldRoot,

      outputAmount: newAccount.amount,
      outputDebt: newAccount.debt,
      outputSecret: newAccount.secret,
      outputNullifier: newAccount.nullifier,
      outputSalt: newAccount.salt,
      outputRoot: accountTreeUpdate.newRoot,
      outputPathIndices: accountTreeUpdate.pathIndices,
      outputPathElements: accountTreeUpdate.pathElements,
      outputCommitment: newAccount.commitment,
      outputAccountHash: newAccount.accountHash,
    }]

    const { proof: withdrawProofData } = await snarkjs.groth16.fullProve(
      utils.stringifyBigInts(inputs[0]),
      this.provingKeys.withdrawWasm,
      this.provingKeys.withdrawZkey,
    )
    const withdrawProof = (
      await snarkjs.groth16.exportSolidityCallData(
        utils.unstringifyBigInts(withdrawProofData),
        [],
      )
    ).split(',')[0]
    const { proof: inputRootProofData } = await snarkjs.groth16.fullProve(
      utils.stringifyBigInts(inputs[1]),
      this.provingKeys.inputRootWasm,
      this.provingKeys.inputRootZkey,
    )
    const inputRootProof = (
      await snarkjs.groth16.exportSolidityCallData(
        utils.unstringifyBigInts(inputRootProofData),
        [],
      )
    ).split(',')[0]
    const { proof: outputRootProofData } = await snarkjs.groth16.fullProve(
      utils.stringifyBigInts(inputs[2]),
      this.provingKeys.outputRootWasm,
      this.provingKeys.outputRootZkey,
    )
    const outputRootProof = (
      await snarkjs.groth16.exportSolidityCallData(
        utils.unstringifyBigInts(outputRootProofData),
        [],
      )
    ).split(',')[0]

    const args = {
      amount: toFixedHex(amount),
      debt: toFixedHex(debt),
      unitPerUnderlying: toFixedHex(unitPerUnderlying),
      extDataHash,
      extData: {
        fee: toFixedHex(fee),
        relayer: toFixedHex(relayer, 20),
        recipient: toFixedHex(recipient, 20),
        encryptedAccount,
      },
      account: {
        inputRoot: toFixedHex(accountTreeUpdate.oldRoot),
        inputNullifierHash: toFixedHex(account.nullifierHash),
        inputAccountHash: toFixedHex(account.accountHash),
        outputRoot: toFixedHex(accountTreeUpdate.newRoot),
        outputPathIndices: toFixedHex(accountTreeUpdate.pathIndices),
        outputCommitment: toFixedHex(newAccount.commitment),
        outputAccountHash: toFixedHex(newAccount.accountHash),
      },
    }

    return {
      proofs: [withdrawProof, inputRootProof, outputRootProof],
      args,
      account: newAccount,
    }
  }

  async treeUpdate(commitment, accountTree = null) {
    if (!accountTree) {
      const accountCommitments = await this._fetchAccountCommitments()
      accountTree = new MerkleTree(this.merkleTreeHeight, accountCommitments, {
        hashFunction: poseidonHash2,
      })
    }
    const accountTreeUpdate = this._updateTree(accountTree, commitment)

    const input = {
      oldRoot: accountTreeUpdate.oldRoot,
      newRoot: accountTreeUpdate.newRoot,
      leaf: commitment,
      pathIndices: accountTreeUpdate.pathIndices,
      pathElements: accountTreeUpdate.pathElements,
    }

    const { proof: proofData } = await snarkjs.groth16.fullProve(
      input,
      this.provingKeys.treeUpdateWasm,
      this.provingKeys.treeUpdateZkey,
    )
    const [proof] = (
      await snarkjs.groth16.exportSolidityCallData(
        utils.unstringifyBigInts(proofData),
        [],
      )
    ).split(',')

    const args = {
      oldRoot: toFixedHex(input.oldRoot),
      newRoot: toFixedHex(input.newRoot),
      leaf: toFixedHex(input.leaf),
      pathIndices: toFixedHex(input.pathIndices),
    }

    return {
      proof,
      args,
      nextAccountTree: accountTree,
    }
  }
}

module.exports = Controller
