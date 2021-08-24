/* global artifacts, web3, contract */
require('chai')
  .use(require('bn-chai')(web3.utils.BN))
  .use(require('chai-as-promised'))
  .should()

const fs = require('fs')
const { toBN } = require('web3-utils')
const {
  takeSnapshot,
  revertSnapshot,
  mineBlock,
} = require('../scripts/ganacheHelper')
const Controller = require('../src/controller')
const Account = require('../src/account')
const {
  toFixedHex,
  poseidonHash2,
  packEncryptedMessage,
  unpackEncryptedMessage,
  getExtWithdrawArgsHash,
} = require('../src/utils')
const { getEncryptionPublicKey } = require('eth-sig-util')
const ERC20Mock = artifacts.require('ERC20Mock')
const FeeManager = artifacts.require('FeeManager')
const Poof = artifacts.require('Poof')
const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const provingKeys = {
  depositCircuit: require('../build/circuits/Deposit.json'),
  withdrawCircuit: require('../build/circuits/Withdraw.json'),
  treeUpdateCircuit: require('../build/circuits/TreeUpdate.json'),
  depositProvingKey: fs.readFileSync('./build/circuits/Deposit_proving_key.bin')
    .buffer,
  withdrawProvingKey: fs.readFileSync(
    './build/circuits/Withdraw_proving_key.bin',
  ).buffer,
  treeUpdateProvingKey: fs.readFileSync(
    './build/circuits/TreeUpdate_proving_key.bin',
  ).buffer,
}
const MerkleTree = require('fixed-merkle-tree')

// Set time to beginning of a second
async function timeReset() {
  const delay = 1000 - new Date().getMilliseconds()
  await new Promise((resolve) => setTimeout(resolve, delay))
  await mineBlock()
}

contract('Poof', (accounts) => {
  let token
  let poof
  const amount = toBN(15)
  // eslint-disable-next-line no-unused-vars
  const sender = accounts[0]
  const recipient = accounts[1]
  // eslint-disable-next-line no-unused-vars
  const relayer = accounts[2]
  const levels = 20
  let snapshotId
  const AnotherWeb3 = require('web3')
  let contract
  let controller

  const emptyTree = new MerkleTree(levels, [], { hashFunction: poseidonHash2 })
  const privateKey = web3.eth.accounts.create().privateKey.slice(2)
  const publicKey = getEncryptionPublicKey(privateKey)

  before(async () => {
    const depositVerifier = await DepositVerifier.new()
    const withdrawVerifier = await WithdrawVerifier.new()
    const treeUpdateVerifier = await TreeUpdateVerifier.new()
    token = await ERC20Mock.new()
    feeManager = await FeeManager.new(sender)
    poof = await Poof.new(
      token.address,
      feeManager.address,
      [
        depositVerifier.address,
        withdrawVerifier.address,
        treeUpdateVerifier.address,
      ],
      toFixedHex(emptyTree.root()),
    )
    // Approve 100 deposits. 100 is arbitrary and is just meant to max approve
    await token.approve(poof.address, amount.mul(toBN(100)))

    const anotherWeb3 = new AnotherWeb3(web3.currentProvider)
    contract = new anotherWeb3.eth.Contract(poof.abi, poof.address)
    controller = new Controller({
      contract,
      merkleTreeHeight: levels,
      provingKeys,
    })
    await controller.init()
    snapshotId = await takeSnapshot()
  })

  beforeEach(async () => {
    await timeReset()
  })

  describe('#Account', () => {
    it('should throw on negative amount', () => {
      ;(() => new Account({ amount: toBN(-1) })).should.throw(
        'Cannot create an account with negative amount',
      )
    })
  })

  describe('#encrypt', () => {
    it('should work', () => {
      const account = new Account()
      const encryptedAccount = account.encrypt(publicKey)
      const encryptedMessage = packEncryptedMessage(encryptedAccount)
      const unpackedMessage = unpackEncryptedMessage(encryptedMessage)
      const account2 = Account.decrypt(privateKey, unpackedMessage)

      account.amount.should.be.eq.BN(account2.amount)
      account.secret.should.be.eq.BN(account2.secret)
      account.nullifier.should.be.eq.BN(account2.nullifier)
      account.commitment.should.be.eq.BN(account2.commitment)
    })
  })

  describe('#deposit', () => {
    it('should fail if no approval', async () => {
      const zeroAccount = new Account()

      zeroAccount.amount.should.be.eq.BN(toBN(0))

      await token.approve(poof.address, 0)
      const { proof, args } = await controller.deposit({
        account: zeroAccount,
        publicKey,
        amount,
      })
      await poof
        .deposit(proof, args)
        .should.be.rejectedWith('transfer amount exceeds allowance')
    })

    it('should work', async () => {
      const zeroAccount = new Account()
      const accountCount = await poof.accountCount()

      zeroAccount.amount.should.be.eq.BN(toBN(0))

      const { proof, args, account } = await controller.deposit({
        account: zeroAccount,
        publicKey,
        amount,
      })
      const balanceBefore = await token.balanceOf(sender)
      const { logs } = await poof.deposit(proof, args)
      const balanceAfter = await token.balanceOf(sender)
      balanceBefore.should.be.eq.BN(balanceAfter.add(amount))

      logs[0].event.should.be.equal('NewAccount')
      logs[0].args.commitment.should.be.equal(toFixedHex(account.commitment))
      logs[0].args.index.should.be.eq.BN(accountCount)

      logs[0].args.nullifier.should.be.equal(
        toFixedHex(zeroAccount.nullifierHash),
      )

      const encryptedAccount = logs[0].args.encryptedAccount
      const account2 = Account.decrypt(
        privateKey,
        unpackEncryptedMessage(encryptedAccount),
      )
      account.amount.should.be.eq.BN(account2.amount)
      account.secret.should.be.eq.BN(account2.secret)
      account.nullifier.should.be.eq.BN(account2.nullifier)
      account.commitment.should.be.eq.BN(account2.commitment)

      const accountCountAfter = await poof.accountCount()
      accountCountAfter.should.be.eq.BN(accountCount.add(toBN(1)))
      const rootAfter = await poof.getLastAccountRoot()
      rootAfter.should.be.equal(args.account.outputRoot)
      const accountNullifierAfter = await poof.accountNullifiers(
        toFixedHex(zeroAccount.nullifierHash),
      )
      accountNullifierAfter.should.be.true

      account.amount.should.be.eq.BN(amount)
    })

    it('should send fee to relayer', async () => {
      const amount = toBN(44)

      const deposit = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await timeReset()
      await poof.deposit(deposit.proof, deposit.args)

      const fee = toBN(3)
      const withdrawal = await controller.withdraw({
        account: deposit.account,
        amount: amount.sub(fee),
        recipient,
        publicKey,
        relayer,
        fee,
      })
      await timeReset()

      const relayerBalanceBefore = await token.balanceOf(relayer)
      const recipientBalanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(withdrawal.proof, withdrawal.args)
      const recipientBalanceAfter = await token.balanceOf(recipient)
      const relayerBalanceAfter = await token.balanceOf(relayer)

      recipientBalanceAfter.should.be.eq.BN(
        recipientBalanceBefore.add(amount.sub(fee)),
      )
      relayerBalanceAfter.should.be.eq.BN(relayerBalanceBefore.add(fee))
    })

    it('should use fallback with outdated tree', async () => {
      const { proof, args } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmp.proof, tmp.args)

      await poof
        .deposit(proof, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(args.account.outputCommitment)
      await poof.deposit(proof, args, update.proof, update.args)

      const rootAfter = await poof.getLastAccountRoot()
      rootAfter.should.be.equal(update.args.newRoot)
    })

    it('should reject with incorrect insert position', async () => {
      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmp.proof, tmp.args)

      const { proof, args } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))

      let fakeIndex = toBN(args.account.outputPathIndices).sub(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .deposit(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')

      fakeIndex = toBN(args.account.outputPathIndices).add(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .deposit(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')

      fakeIndex = toBN(args.account.outputPathIndices).add(
        toBN('10000000000000000000000000'),
      )
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .deposit(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')

      await poof.deposit(proof, args).should.be.fulfilled
    })

    it('should reject with incorrect external data hash', async () => {
      const { proof, args } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))

      malformedArgs.extDataHash = toFixedHex('0xdeadbeef')
      await poof
        .deposit(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')

      malformedArgs.extDataHash = toFixedHex('0x00')
      await poof
        .deposit(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')

      await poof.deposit(proof, args).should.be.fulfilled
    })

    it('should reject for invalid proof', async () => {
      const claim1 = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      const claim2 = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      await poof
        .deposit(claim2.proof, claim1.args)
        .should.be.rejectedWith('Invalid deposit proof')
    })

    it('should reject for invalid account root', async () => {
      const account1 = new Account()
      const account2 = new Account()
      const account3 = new Account()

      const fakeTree = new MerkleTree(
        levels,
        [account1.commitment, account2.commitment, account3.commitment],
        { hashFunction: poseidonHash2 },
      )
      const { proof, args } = await controller.deposit({
        account: account1,
        publicKey,
        amount,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.account.inputRoot = toFixedHex(fakeTree.root())
      await poof
        .deposit(proof, malformedArgs)
        .should.be.rejectedWith('Invalid account root')
    })

    it('should reject with outdated account root (treeUpdate proof validation)', async () => {
      const { proof, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmp.proof, tmp.args)

      await poof
        .deposit(proof, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(account.commitment)

      const tmp2 = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmp2.proof, tmp2.args)

      await poof
        .deposit(proof, args, update.proof, update.args)
        .should.be.rejectedWith('Outdated tree update merkle root')
    })

    it('should reject for incorrect commitment (treeUpdate proof validation)', async () => {
      const claim = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmp.proof, tmp.args)

      await poof
        .deposit(claim.proof, claim.args)
        .should.be.rejectedWith('Outdated account merkle root')
      const anotherAccount = new Account()
      const update = await controller.treeUpdate(anotherAccount.commitment)

      await poof
        .deposit(claim.proof, claim.args, update.proof, update.args)
        .should.be.rejectedWith('Incorrect commitment inserted')

      claim.args.account.outputCommitment = update.args.leaf
      await poof
        .deposit(claim.proof, claim.args, update.proof, update.args)
        .should.be.rejectedWith('Invalid deposit proof')
    })

    it('should reject for incorrect account insert index (treeUpdate proof validation)', async () => {
      const { proof, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmp.proof, tmp.args)

      await poof
        .deposit(proof, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(account.commitment)
      const malformedArgs = JSON.parse(JSON.stringify(update.args))

      let fakeIndex = toBN(update.args.pathIndices).sub(toBN('1'))
      malformedArgs.pathIndices = toFixedHex(fakeIndex)

      await poof
        .deposit(proof, args, update.proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
    })

    it('should reject for invalid tree update proof (treeUpdate proof validation)', async () => {
      const { proof, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmp.proof, tmp.args)

      await poof
        .deposit(proof, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(account.commitment)
      await poof
        .deposit(proof, args, tmp.proof, update.args)
        .should.be.rejectedWith('Invalid tree update proof')
    })
  })

  describe('#transfer', () => {
    let fromAccount
    beforeEach(async () => {
      const zeroAccount = new Account()

      zeroAccount.amount.should.be.eq.BN(toBN(0))

      const { proof, args, account } = await controller.deposit({
        account: zeroAccount,
        publicKey,
        amount,
      })
      await poof.deposit(proof, args)
      fromAccount = account
    })

    it('should work', async () => {
      const toAccount = new Account()
      const {
        proof: toProof,
        args: toArgs,
        account: outputToAccount,
      } = await controller.deposit({
        account: toAccount,
        amount,
        publicKey,
      })

      const {
        proof: fromProof,
        args: fromArgs,
        account: outputFromAccount,
      } = await controller.transfer({
        account: fromAccount,
        publicKey,
        depositProof: toProof,
        depositArgs: toArgs,
      })
      const {
        proof: toTreeUpdateProof,
        args: toTreeUpdateArgs,
        nextAccountTree,
      } = await controller.treeUpdate(toArgs.account.outputCommitment)
      const { proof: fromTreeUpdateProof, args: fromTreeUpdateArgs } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          nextAccountTree,
        )
      const { logs } = await poof.transfer(
        fromProof,
        fromArgs,
        toProof,
        toArgs,
        fromTreeUpdateProof,
        fromTreeUpdateArgs,
        toTreeUpdateProof,
        toTreeUpdateArgs,
      )

      const [toAccountLog, fromAccountLog] = logs

      // Verify toAccountLog
      toAccountLog.event.should.be.equal('NewAccount')
      toAccountLog.args.commitment.should.be.equal(
        toFixedHex(outputToAccount.commitment),
      )
      toAccountLog.args.index.should.be.eq.BN(1)

      // Verify fromAccountLog
      fromAccountLog.event.should.be.equal('NewAccount')
      fromAccountLog.args.commitment.should.be.equal(
        toFixedHex(outputFromAccount.commitment),
      )
      fromAccountLog.args.index.should.be.eq.BN(2)
    })

    it('should reject for double spend', async () => {
      const toAccount = new Account()
      const { proof: toProof, args: toArgs } = await controller.deposit({
        account: toAccount,
        amount,
        publicKey,
      })

      const { proof: fromProof, args: fromArgs } = await controller.transfer({
        account: fromAccount,
        publicKey,
        depositProof: toProof,
        depositArgs: toArgs,
      })
      const {
        proof: toTreeUpdateProof,
        args: toTreeUpdateArgs,
        nextAccountTree,
      } = await controller.treeUpdate(toArgs.account.outputCommitment)
      const { proof: fromTreeUpdateProof, args: fromTreeUpdateArgs } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          nextAccountTree,
        )
      await poof.transfer(
        fromProof,
        fromArgs,
        toProof,
        toArgs,
        fromTreeUpdateProof,
        fromTreeUpdateArgs,
        toTreeUpdateProof,
        toTreeUpdateArgs,
      )

      await poof
        .transfer(
          fromProof,
          fromArgs,
          toProof,
          toArgs,
          fromTreeUpdateProof,
          fromTreeUpdateArgs,
          toTreeUpdateProof,
          toTreeUpdateArgs,
        )
        .should.be.rejectedWith('Outdated account state')
    })

    it('should reject with incorrect insert position', async () => {
      const toAccount = new Account()
      const { proof: toProof, args: toArgs } = await controller.deposit({
        account: toAccount,
        amount,
        publicKey,
      })

      const { proof: fromProof, args: fromArgs } = await controller.transfer({
        account: fromAccount,
        publicKey,
        depositProof: toProof,
        depositArgs: toArgs,
      })
      const {
        proof: toTreeUpdateProof,
        args: toTreeUpdateArgs,
        nextAccountTree,
      } = await controller.treeUpdate(toArgs.account.outputCommitment)
      const { proof: fromTreeUpdateProof, args: fromTreeUpdateArgs } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          nextAccountTree,
        )

      const malformedArgs = JSON.parse(JSON.stringify(fromArgs))
      let fakeIndex = toBN(fromArgs.account.outputPathIndices).sub(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .transfer(
          fromProof,
          malformedArgs,
          toProof,
          toArgs,
          fromTreeUpdateProof,
          fromTreeUpdateArgs,
          toTreeUpdateProof,
          toTreeUpdateArgs,
        )
        .should.be.rejectedWith('Invalid account root')
      fakeIndex = toBN(fromArgs.account.outputPathIndices).add(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .transfer(
          fromProof,
          malformedArgs,
          toProof,
          toArgs,
          fromTreeUpdateProof,
          fromTreeUpdateArgs,
          toTreeUpdateProof,
          toTreeUpdateArgs,
        )
        .should.be.rejectedWith('Invalid account root')
      fakeIndex = toBN(fromArgs.account.outputPathIndices).add(
        toBN('10000000000000000000000000'),
      )
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      // Modulo function results in the same outputPathIndex. This malformation gets caught at proof verification
      await poof
        .transfer(
          fromProof,
          malformedArgs,
          toProof,
          toArgs,
          fromTreeUpdateProof,
          fromTreeUpdateArgs,
          toTreeUpdateProof,
          toTreeUpdateArgs,
        )
        .should.be.rejectedWith('Invalid withdrawal proof')

      await poof.transfer(
        fromProof,
        fromArgs,
        toProof,
        toArgs,
        fromTreeUpdateProof,
        fromTreeUpdateArgs,
        toTreeUpdateProof,
        toTreeUpdateArgs,
      )
    })

    it('should reject with incorrect external data hash', async () => {
      const toAccount = new Account()
      const { proof: toProof, args: toArgs } = await controller.deposit({
        account: toAccount,
        amount,
        publicKey,
      })

      const { proof: fromProof, args: fromArgs } = await controller.transfer({
        account: fromAccount,
        publicKey,
        depositProof: toProof,
        depositArgs: toArgs,
      })
      const {
        proof: toTreeUpdateProof,
        args: toTreeUpdateArgs,
        nextAccountTree,
      } = await controller.treeUpdate(toArgs.account.outputCommitment)
      const { proof: fromTreeUpdateProof, args: fromTreeUpdateArgs } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          nextAccountTree,
        )

      const malformedArgs = JSON.parse(JSON.stringify(fromArgs))
      malformedArgs.extDataHash = toFixedHex('0xdeadbeef')
      await poof
        .transfer(
          fromProof,
          malformedArgs,
          toProof,
          toArgs,
          fromTreeUpdateProof,
          fromTreeUpdateArgs,
          toTreeUpdateProof,
          toTreeUpdateArgs,
        )
        .should.be.rejectedWith("Incorrect 'from' external data hash")
      malformedArgs.extDataHash = toFixedHex('0x00')
      await poof
        .transfer(
          fromProof,
          malformedArgs,
          toProof,
          toArgs,
          fromTreeUpdateProof,
          fromTreeUpdateArgs,
          toTreeUpdateProof,
          toTreeUpdateArgs,
        )
        .should.be.rejectedWith("Incorrect 'from' external data hash")

      await poof.transfer(
        fromProof,
        fromArgs,
        toProof,
        toArgs,
        fromTreeUpdateProof,
        fromTreeUpdateArgs,
        toTreeUpdateProof,
        toTreeUpdateArgs,
      )
    })

    it('should reject with incorrect "to" params', async () => {
      const toAccount = new Account()
      const { proof: toProof, args: toArgs } = await controller.deposit({
        account: toAccount,
        amount,
        publicKey,
      })

      const { proof: fromProof, args: fromArgs } = await controller.transfer({
        account: fromAccount,
        publicKey,
        depositProof: toProof,
        depositArgs: toArgs,
      })
      const {
        proof: toTreeUpdateProof,
        args: toTreeUpdateArgs,
        nextAccountTree,
      } = await controller.treeUpdate(toArgs.account.outputCommitment)
      const { proof: fromTreeUpdateProof, args: fromTreeUpdateArgs } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          nextAccountTree,
        )

      // Try to change the 'to' params
      const { proof: malToProof, args: malToArgs } = await controller.deposit({
        account: new Account(),
        amount,
        publicKey,
      })
      const {
        proof: malToTreeUpdateProof1,
        args: malToTreeUpdateArgs1,
        nextAccountTree: malNextAccountTree1,
      } = await controller.treeUpdate(malToArgs.account.outputCommitment)
      const { proof: malFromTreeUpdateProof1, args: malFromTreeUpdateArgs1 } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          malNextAccountTree1,
        )
      await poof
        .transfer(
          fromProof,
          fromArgs,
          malToProof,
          malToArgs,
          malFromTreeUpdateProof1,
          malFromTreeUpdateArgs1,
          malToTreeUpdateProof1,
          malToTreeUpdateArgs1,
        )
        .should.be.rejectedWith(
          "'from' proof hash does not match 'to' proof hash",
        )

      // Also try to edit depositProofHash
      const { args: malFromArgs } = await controller.transfer({
        account: fromAccount,
        publicKey,
        depositProof: malToProof,
        depositArgs: malToArgs,
      })
      const {
        proof: malToTreeUpdateProof2,
        args: malToTreeUpdateArgs2,
        nextAccountTree: malNextAccountTree2,
      } = await controller.treeUpdate(malToArgs.account.outputCommitment)
      const { proof: malFromTreeUpdateProof2, args: malFromTreeUpdateArgs2 } =
        await controller.treeUpdate(
          malFromArgs.account.outputCommitment,
          malNextAccountTree2,
        )
      await poof
        .transfer(
          fromProof,
          malFromArgs,
          malToProof,
          malToArgs,
          malFromTreeUpdateProof2,
          malFromTreeUpdateArgs2,
          malToTreeUpdateProof2,
          malToTreeUpdateArgs2,
        )
        .should.be.rejectedWith('Invalid withdrawal proof')

      await poof.transfer(
        fromProof,
        fromArgs,
        toProof,
        toArgs,
        fromTreeUpdateProof,
        fromTreeUpdateArgs,
        toTreeUpdateProof,
        toTreeUpdateArgs,
      )
    })

    it("should reject for invalid 'from' proof", async () => {
      const { proof: toProof1, args: toArgs1 } = await controller.deposit({
        account: new Account(),
        amount,
        publicKey,
      })
      const { args: toArgs2 } = await controller.deposit({
        account: new Account(),
        amount,
        publicKey,
      })

      const { proof: fromProof, args: fromArgs } = await controller.transfer({
        account: fromAccount,
        publicKey,
        depositProof: toProof1,
        depositArgs: toArgs1,
      })
      const {
        proof: toTreeUpdateProof,
        args: toTreeUpdateArgs,
        nextAccountTree,
      } = await controller.treeUpdate(toArgs2.account.outputCommitment)
      const { proof: fromTreeUpdateProof, args: fromTreeUpdateArgs } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          nextAccountTree,
        )

      await poof
        .transfer(
          fromProof,
          fromArgs,
          toProof1,
          toArgs2,
          fromTreeUpdateProof,
          fromTreeUpdateArgs,
          toTreeUpdateProof,
          toTreeUpdateArgs,
        )
        .should.be.rejectedWith('Invalid deposit proof')
    })

    it('should send fee to relayer', async () => {
      const fee = toBN(3)

      const { proof: toProof, args: toArgs } = await controller.deposit({
        account: new Account(),
        amount: amount.sub(fee),
        publicKey,
      })

      const { proof: fromProof, args: fromArgs } = await controller.transfer({
        account: fromAccount,
        amount: toBN(toArgs.amount).sub(fee),
        publicKey,
        depositProof: toProof,
        depositArgs: toArgs,
        fee,
        relayer,
      })

      const {
        proof: toTreeUpdateProof,
        args: toTreeUpdateArgs,
        nextAccountTree,
      } = await controller.treeUpdate(toArgs.account.outputCommitment)
      const { proof: fromTreeUpdateProof, args: fromTreeUpdateArgs } =
        await controller.treeUpdate(
          fromArgs.account.outputCommitment,
          nextAccountTree,
        )
      const relayerBalanceBefore = await token.balanceOf(relayer)
      await poof.transfer(
        fromProof,
        fromArgs,
        toProof,
        toArgs,
        fromTreeUpdateProof,
        fromTreeUpdateArgs,
        toTreeUpdateProof,
        toTreeUpdateArgs,
      )
      const relayerBalanceAfter = await token.balanceOf(relayer)

      relayerBalanceAfter.should.be.eq.BN(relayerBalanceBefore.add(fee))
    })
  })

  describe('#withdraw', () => {
    let proof, args, account

    beforeEach(async () => {
      ;({ proof, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      }))
      await poof.deposit(proof, args)
    })

    it('should work', async () => {
      const accountNullifierBefore = await poof.accountNullifiers(
        toFixedHex(account.nullifierHash),
      )
      accountNullifierBefore.should.be.false
      const accountCount = await poof.accountCount()
      const withdrawSnark = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      await timeReset()
      const balanceBefore = await token.balanceOf(recipient)
      const { logs } = await poof.withdraw(
        withdrawSnark.proof,
        withdrawSnark.args,
      )
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
      const accountCountAfter = await poof.accountCount()
      accountCountAfter.should.be.eq.BN(accountCount.add(toBN(1)))
      const rootAfter = await poof.getLastAccountRoot()
      rootAfter.should.be.equal(withdrawSnark.args.account.outputRoot)
      const accountNullifierAfter = await poof.accountNullifiers(
        toFixedHex(account.nullifierHash),
      )
      accountNullifierAfter.should.be.true
      logs[0].event.should.be.equal('NewAccount')
      logs[0].args.commitment.should.be.equal(
        toFixedHex(withdrawSnark.account.commitment),
      )
      logs[0].args.index.should.be.eq.BN(accountCount)
      logs[0].args.nullifier.should.be.equal(toFixedHex(account.nullifierHash))
      const encryptedAccount = logs[0].args.encryptedAccount
      const account2 = Account.decrypt(
        privateKey,
        unpackEncryptedMessage(encryptedAccount),
      )
      withdrawSnark.account.amount.should.be.eq.BN(account2.amount)
      withdrawSnark.account.secret.should.be.eq.BN(account2.secret)
      withdrawSnark.account.nullifier.should.be.eq.BN(account2.nullifier)
      withdrawSnark.account.commitment.should.be.eq.BN(account2.commitment)
    })

    it('should reject for double spend', async () => {
      const withdrawSnark = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      await timeReset()
      const balanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(withdrawSnark.proof, withdrawSnark.args)
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
      await poof
        .withdraw(withdrawSnark.proof, withdrawSnark.args)
        .should.be.rejectedWith('Outdated account state')
    })

    it('should reject with incorrect insert position', async () => {
      const { proof, args } = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      let fakeIndex = toBN(args.account.outputPathIndices).sub(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
      fakeIndex = toBN(args.account.outputPathIndices).add(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
      fakeIndex = toBN(args.account.outputPathIndices).add(
        toBN('10000000000000000000000000'),
      )
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
      const balanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(proof, args)
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
    })

    it('should reject with incorrect external data hash', async () => {
      const { proof, args } = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.extDataHash = toFixedHex('0xdeadbeef')
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      malformedArgs.extDataHash = toFixedHex('0x00')
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      const balanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(proof, args)
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
    })

    it('should reject for amount overflow', async () => {
      const { proof, args } = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.amount = toFixedHex(toBN(2).pow(toBN(248)))
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Amount value out of range')
      malformedArgs.amount = toFixedHex(toBN(2).pow(toBN(256)).sub(toBN(1)))
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Amount value out of range')
      const balanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(proof, args)
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
    })

    it('should reject for fee overflow', async () => {
      const fee = account.amount.add(toBN(5))
      const fakeAmount = toBN(-5)
      const { proof, args } = await controller.withdraw({
        account,
        amount: fakeAmount,
        recipient,
        publicKey,
        fee,
      })
      await poof
        .withdraw(proof, args)
        .should.be.rejectedWith('Amount should be greater than fee')
    })

    it('should reject for unfair amount', async () => {
      const fee = toBN(3)
      const amountToWithdraw = amount.sub(fee)
      const { proof, args } = await controller.withdraw({
        account,
        amount: amountToWithdraw,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.amount = toFixedHex(amountToWithdraw.add(amountToWithdraw))
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Invalid withdrawal proof')
      await timeReset()
      const balanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(proof, args)
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amountToWithdraw))
    })

    it('can use fallback with outdated tree', async () => {
      const tmpReward = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmpReward.proof, tmpReward.args)
      const withdrawal = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const tmpWithdraw = await controller.withdraw({
        account: tmpReward.account,
        amount,
        recipient,
        publicKey,
      })
      await poof.withdraw(tmpWithdraw.proof, tmpWithdraw.args)
      await poof
        .withdraw(withdrawal.proof, withdrawal.args)
        .should.be.rejectedWith('Outdated account merkle root')
      const update = await controller.treeUpdate(withdrawal.account.commitment)
      await timeReset()
      const balanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(
        withdrawal.proof,
        withdrawal.args,
        update.proof,
        update.args,
      )
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
      const rootAfter = await poof.getLastAccountRoot()
      rootAfter.should.be.equal(update.args.newRoot)
    })

    it('should reject for invalid proof', async () => {
      const tmpReward = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(tmpReward.proof, tmpReward.args)
      const withdrawal = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const tmpWithdraw = await controller.withdraw({
        account: tmpReward.account,
        amount,
        recipient,
        publicKey,
      })
      await poof
        .withdraw(tmpWithdraw.proof, withdrawal.args)
        .should.be.rejectedWith('Invalid withdrawal proof')
    })

    it('should reject for malformed relayer and recipient address and fee', async () => {
      const fakeRelayer = accounts[6]
      const fakeRecipient = accounts[7]
      const fee = toBN(12)
      const fakeFee = 123
      const amountToWithdraw = amount.sub(fee)
      const { proof, args } = await controller.withdraw({
        account,
        amount: amountToWithdraw,
        recipient,
        publicKey,
        fee,
        relayer,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.extData.recipient = fakeRecipient
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      malformedArgs.extData.recipient = recipient
      malformedArgs.extData.relayer = fakeRelayer
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      malformedArgs.extData.relayer = relayer
      malformedArgs.extData.fee = fakeFee
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      const extDataHash = getExtWithdrawArgsHash({
        fee: fakeFee,
        recipient: fakeRecipient,
        relayer: fakeRelayer,
        encryptedAccount: malformedArgs.extData.encryptedAccount,
      })
      malformedArgs.extData.fee = fakeFee
      malformedArgs.extData.relayer = fakeRelayer
      malformedArgs.extData.recipient = fakeRecipient
      malformedArgs.extDataHash = extDataHash
      await poof
        .withdraw(proof, malformedArgs)
        .should.be.rejectedWith('Invalid withdrawal proof')
      await timeReset()
      const balanceBefore = await token.balanceOf(recipient)
      await poof.withdraw(proof, args)
      const balanceAfter = await token.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(amountToWithdraw))
    })
  })

  describe('#isKnownAccountRoot', () => {
    it('should work', async () => {
      const claim1 = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(claim1.proof, claim1.args)

      const claim2 = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.deposit(claim2.proof, claim2.args)

      const tree = new MerkleTree(levels, [], { hashFunction: poseidonHash2 })
      await poof.isKnownAccountRoot(toFixedHex(tree.root()), 0).should
        .eventually.be.true

      tree.insert(claim1.account.commitment)
      await poof.isKnownAccountRoot(toFixedHex(tree.root()), 1).should
        .eventually.be.true

      tree.insert(claim2.account.commitment)
      await poof.isKnownAccountRoot(toFixedHex(tree.root()), 2).should
        .eventually.be.true

      await poof.isKnownAccountRoot(toFixedHex(tree.root()), 1).should
        .eventually.be.false
      await poof.isKnownAccountRoot(toFixedHex(tree.root()), 5).should
        .eventually.be.false
      await poof.isKnownAccountRoot(toFixedHex(1234), 1).should.eventually.be
        .false
      await poof.isKnownAccountRoot(toFixedHex(0), 0).should.eventually.be.false
      await poof.isKnownAccountRoot(toFixedHex(0), 5).should.eventually.be.false
    })
  })

  describe('#setVerifiers', () => {
    it('onlyOwner can set new verifiers', async () => {
      const verifiers = [
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000003',
      ]
      await poof
        .setVerifiers(verifiers, { from: accounts[1] })
        .should.be.rejectedWith('caller is not the owner')
      await poof.setVerifiers(verifiers, { from: accounts[0] })

      const depositVerifier = await poof.depositVerifier()
      depositVerifier.should.be.equal(verifiers[0])
      const withdrawVerifier = await poof.withdrawVerifier()
      withdrawVerifier.should.be.equal(verifiers[1])
      const treeUpdateVerifier = await poof.treeUpdateVerifier()
      treeUpdateVerifier.should.be.equal(verifiers[2])
    })
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId.result)
    // eslint-disable-next-line require-atomic-updates
    snapshotId = await takeSnapshot()
  })
})
