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
  unpackEncryptedMessage,
  getExtWithdrawArgsHash,
} = require('../src/utils')
const { getEncryptionPublicKey } = require('eth-sig-util')
const PoofVal = artifacts.require('PoofVal')
const DepositVerifier = artifacts.require('DepositMiniVerifier')
const WithdrawVerifier = artifacts.require('WithdrawMiniVerifier')
const InputRootVerifier = artifacts.require('InputRootMiniVerifier')
const OutputRootVerifier = artifacts.require('OutputRootMiniVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateMiniVerifier')
const MerkleTree = require('fixed-merkle-tree')

// Set time to beginning of a second
async function timeReset() {
  const delay = 1000 - new Date().getMilliseconds()
  await new Promise((resolve) => setTimeout(resolve, delay))
  await mineBlock()
}

contract('PoofVal', (accounts) => {
  let poof
  const amount = toBN(15)
  // eslint-disable-next-line no-unused-vars
  const sender = accounts[0]
  const recipient = accounts[1]
  // eslint-disable-next-line no-unused-vars
  const relayer = accounts[2]
  const merkleTreeHeight = 3
  let snapshotId
  const AnotherWeb3 = require('web3')
  let contract
  let controller

  const emptyTree = new MerkleTree(merkleTreeHeight, [], {
    hashFunction: poseidonHash2,
  })
  const privateKey = web3.eth.accounts.create().privateKey.slice(2)
  const publicKey = getEncryptionPublicKey(privateKey)

  before(async () => {
    const depositVerifier = await DepositVerifier.new()
    const withdrawVerifier = await WithdrawVerifier.new()
    const inputRootVerifier = await InputRootVerifier.new()
    const outputRootVerifier = await OutputRootVerifier.new()
    const treeUpdateVerifier = await TreeUpdateVerifier.new()
    poof = await PoofVal.new(
      [
        depositVerifier.address,
        withdrawVerifier.address,
        inputRootVerifier.address,
        outputRootVerifier.address,
        treeUpdateVerifier.address,
      ],
      toFixedHex(emptyTree.root()),
    )

    const anotherWeb3 = new AnotherWeb3(web3.currentProvider)
    contract = new anotherWeb3.eth.Contract(poof.abi, poof.address)
    const provingKeys = {
      depositWasm: fs.readFileSync('./build/circuits/DepositMini.wasm'),
      depositZkey: fs.readFileSync(
        './build/circuits/DepositMini_circuit_final.zkey',
      ),
      withdrawWasm: fs.readFileSync('./build/circuits/WithdrawMini.wasm'),
      withdrawZkey: fs.readFileSync(
        './build/circuits/WithdrawMini_circuit_final.zkey',
      ),
      inputRootWasm: fs.readFileSync('./build/circuits/InputRootMini.wasm'),
      inputRootZkey: fs.readFileSync(
        './build/circuits/InputRootMini_circuit_final.zkey',
      ),
      outputRootWasm: fs.readFileSync('./build/circuits/OutputRootMini.wasm'),
      outputRootZkey: fs.readFileSync(
        './build/circuits/OutputRootMini_circuit_final.zkey',
      ),
      treeUpdateWasm: fs.readFileSync('./build/circuits/TreeUpdateMini.wasm'),
      treeUpdateZkey: fs.readFileSync(
        './build/circuits/TreeUpdateMini_circuit_final.zkey',
      ),
    }
    controller = new Controller({
      contract,
      merkleTreeHeight,
      provingKeys,
    })
    snapshotId = await takeSnapshot()
  })

  beforeEach(async () => {
    await timeReset()
  })

  describe('#deposit', () => {
    it('should work', async () => {
      const zeroAccount = new Account()
      const accountCount = await poof.accountCount()

      zeroAccount.amount.should.be.eq.BN(toBN(0))

      const { proofs, args, account } = await controller.deposit({
        account: zeroAccount,
        publicKey,
        amount,
      })
      const balanceBefore = toBN(await web3.eth.getBalance(sender))
      const { logs } = await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, {
        value: amount,
        gasPrice: '0',
      })
      const balanceAfter = toBN(await web3.eth.getBalance(sender))
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
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](deposit.proofs, deposit.args, {
        value: amount,
        gasPrice: '0',
      })

      const fee = toBN(3)
      const withdrawal = await controller.withdraw({
        account: deposit.account,
        amount: amount.sub(fee),
        recipient,
        publicKey,
        relayer,
        fee,
      })

      const relayerBalanceBefore = toBN(await web3.eth.getBalance(relayer))
      const recipientBalanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(withdrawal.proofs, withdrawal.args)
      const recipientBalanceAfter = toBN(await web3.eth.getBalance(recipient))
      const relayerBalanceAfter = toBN(await web3.eth.getBalance(relayer))

      recipientBalanceAfter.should.be.eq.BN(
        recipientBalanceBefore.add(amount.sub(fee)),
      )
      relayerBalanceAfter.should.be.eq.BN(relayerBalanceBefore.add(fee))
    })

    it('should use fallback with outdated tree', async () => {
      const { proofs, args } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmp.proofs, tmp.args, { value: amount, gasPrice: '0' })

      await poof
        .deposit(proofs, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(args.account.outputCommitment)
      await poof.methods[
        'deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)),bytes,(bytes32,bytes32,bytes32,uint256))'
      ](proofs, args, update.proof, update.args, {
        value: amount,
        gasPrice: '0',
      })
      const rootAfter = await poof.getLastAccountRoot()
      rootAfter.should.be.equal(update.args.newRoot)
    })

    it('should reject with incorrect insert position', async () => {
      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmp.proofs, tmp.args, { value: amount, gasPrice: '0' })

      const { proofs, args } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))

      let fakeIndex = toBN(args.account.outputPathIndices).sub(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .deposit(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')

      fakeIndex = toBN(args.account.outputPathIndices).add(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .deposit(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')

      fakeIndex = toBN(args.account.outputPathIndices).add(
        toBN('10000000000000000000000000'),
      )
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .deposit(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')

      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, { value: amount, gasPrice: '0' }).should
        .be.fulfilled
    })

    it('should reject with incorrect external data hash', async () => {
      const { proofs, args } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))

      malformedArgs.extDataHash = toFixedHex('0xdeadbeef')
      await poof
        .deposit(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')

      malformedArgs.extDataHash = toFixedHex('0x00')
      await poof
        .deposit(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')

      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, { value: amount, gasPrice: '0' }).should
        .be.fulfilled
    })

    it('should reject for invalid proofs', async () => {
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
        .deposit(claim2.proofs, claim1.args)
        .should.be.rejectedWith('Invalid deposit proof')
    })

    it('should reject for invalid account root', async () => {
      const account1 = new Account()
      const account2 = new Account()
      const account3 = new Account()

      const fakeTree = new MerkleTree(
        merkleTreeHeight,
        [account1.commitment, account2.commitment, account3.commitment],
        { hashFunction: poseidonHash2 },
      )
      const { proofs, args } = await controller.deposit({
        account: account1,
        publicKey,
        amount,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.account.inputRoot = toFixedHex(fakeTree.root())
      await poof
        .deposit(proofs, malformedArgs)
        .should.be.rejectedWith('Invalid account root')
    })

    it('should reject with outdated account root (treeUpdate proofs validation)', async () => {
      const { proofs, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmp.proofs, tmp.args, { value: amount, gasPrice: '0' })

      await poof
        .deposit(proofs, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(account.commitment)

      const tmp2 = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmp2.proofs, tmp2.args, {
        value: amount,
        gasPrice: '0',
      })

      await poof
        .deposit(proofs, args, update.proof, update.args)
        .should.be.rejectedWith('Outdated tree update merkle root')
    })

    it('should reject for incorrect commitment (treeUpdate proofs validation)', async () => {
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
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmp.proofs, tmp.args, { value: amount, gasPrice: '0' })

      await poof
        .deposit(claim.proofs, claim.args)
        .should.be.rejectedWith('Outdated account merkle root')
      const anotherAccount = new Account()
      const update = await controller.treeUpdate(anotherAccount.commitment)

      await poof
        .deposit(claim.proofs, claim.args, update.proof, update.args)
        .should.be.rejectedWith('Incorrect commitment inserted')

      claim.args.account.outputCommitment = update.args.leaf
      await poof
        .deposit(claim.proofs, claim.args, update.proof, update.args)
        .should.be.rejectedWith('Invalid output root proof')
    })

    it('should reject for incorrect account insert index (treeUpdate proofs validation)', async () => {
      const { proofs, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmp.proofs, tmp.args, { value: amount, gasPrice: '0' })

      await poof
        .deposit(proofs, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(account.commitment)
      const malformedArgs = JSON.parse(JSON.stringify(update.args))

      let fakeIndex = toBN(update.args.pathIndices).sub(toBN('1'))
      malformedArgs.pathIndices = toFixedHex(fakeIndex)

      await poof
        .deposit(proofs, args, update.proof, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
    })

    it('should reject for invalid tree update proofs (treeUpdate proofs validation)', async () => {
      const { proofs, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })

      const tmp = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmp.proofs, tmp.args, { value: amount, gasPrice: '0' })

      await poof
        .deposit(proofs, args)
        .should.be.rejectedWith('Outdated account merkle root')

      const update = await controller.treeUpdate(account.commitment)
      await poof
        .deposit(proofs, args, tmp.proofs[0], update.args)
        .should.be.rejectedWith('Invalid tree update proof')
    })
  })

  describe('#withdraw', () => {
    let proofs, args, account

    beforeEach(async () => {
      ; ({ proofs, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      }))
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, { value: amount, gasPrice: '0' })
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
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const { logs } = await poof.withdraw(
        withdrawSnark.proofs,
        withdrawSnark.args,
      )
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
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
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(withdrawSnark.proofs, withdrawSnark.args)
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
      await poof
        .withdraw(withdrawSnark.proofs, withdrawSnark.args)
        .should.be.rejectedWith('Outdated account state')
    })

    it('should reject with incorrect insert position', async () => {
      const { proofs, args } = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      let fakeIndex = toBN(args.account.outputPathIndices).sub(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
      fakeIndex = toBN(args.account.outputPathIndices).add(toBN('1'))
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
      fakeIndex = toBN(args.account.outputPathIndices).add(
        toBN('10000000000000000000000000'),
      )
      malformedArgs.account.outputPathIndices = toFixedHex(fakeIndex)
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect account insert index')
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(proofs, args)
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
    })

    it('should reject with incorrect external data hash', async () => {
      const { proofs, args } = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.extDataHash = toFixedHex('0xdeadbeef')
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      malformedArgs.extDataHash = toFixedHex('0x00')
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(proofs, args)
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
    })

    it('should reject for amount overflow', async () => {
      const { proofs, args } = await controller.withdraw({
        account,
        amount,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.amount = toFixedHex(toBN(2).pow(toBN(248)))
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Amount value out of range')
      malformedArgs.amount = toFixedHex(toBN(2).pow(toBN(256)).sub(toBN(1)))
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Amount value out of range')
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(proofs, args)
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
    })

    it('should reject for fee overflow', async () => {
      const fee = account.amount.add(toBN(5))
      const fakeAmount = toBN(-5)
      const { proofs, args } = await controller.withdraw({
        account,
        amount: fakeAmount,
        recipient,
        publicKey,
        fee,
      })
      await poof
        .withdraw(proofs, args)
        .should.be.rejectedWith('Amount should be >= than fee')
    })

    it('should reject for unfair amount', async () => {
      const fee = toBN(3)
      const amountToWithdraw = amount.sub(fee)
      const { proofs, args } = await controller.withdraw({
        account,
        amount: amountToWithdraw,
        recipient,
        publicKey,
      })
      const malformedArgs = JSON.parse(JSON.stringify(args))
      malformedArgs.amount = toFixedHex(amountToWithdraw.add(amountToWithdraw))
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Invalid withdrawal proof')
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(proofs, args)
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.eq.BN(balanceBefore.add(amountToWithdraw))
    })

    it('can use fallback with outdated tree', async () => {
      const tmpReward = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmpReward.proofs, tmpReward.args, {
        value: amount,
        gasPrice: '0',
      })
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
      await poof.withdraw(tmpWithdraw.proofs, tmpWithdraw.args)
      await poof
        .withdraw(withdrawal.proofs, withdrawal.args)
        .should.be.rejectedWith('Outdated account merkle root')
      const update = await controller.treeUpdate(withdrawal.account.commitment)
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(
        withdrawal.proofs,
        withdrawal.args,
        update.proof,
        update.args,
      )
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount))
      const rootAfter = await poof.getLastAccountRoot()
      rootAfter.should.be.equal(update.args.newRoot)
    })

    it('should reject for invalid proofs', async () => {
      const tmpReward = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](tmpReward.proofs, tmpReward.args, {
        value: amount,
        gasPrice: '0',
      })
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
        .withdraw(tmpWithdraw.proofs, withdrawal.args)
        .should.be.rejectedWith('Invalid withdrawal proof')
    })

    it('should reject for malformed relayer and recipient address and fee', async () => {
      const fakeRelayer = accounts[6]
      const fakeRecipient = accounts[7]
      const fee = toBN(12)
      const fakeFee = 123
      const amountToWithdraw = amount.sub(fee)
      const { proofs, args } = await controller.withdraw({
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
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      malformedArgs.extData.recipient = recipient
      malformedArgs.extData.relayer = fakeRelayer
      await poof
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Incorrect external data hash')
      malformedArgs.extData.relayer = relayer
      malformedArgs.extData.fee = fakeFee
      await poof
        .withdraw(proofs, malformedArgs)
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
        .withdraw(proofs, malformedArgs)
        .should.be.rejectedWith('Amount should be >= than fee')
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(proofs, args)
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
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
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](claim1.proofs, claim1.args, {
        value: amount,
        gasPrice: '0',
      })

      const claim2 = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
      })
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](claim2.proofs, claim2.args, {
        value: amount,
        gasPrice: '0',
      })

      const tree = new MerkleTree(merkleTreeHeight, [], {
        hashFunction: poseidonHash2,
      })
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

  afterEach(async () => {
    await revertSnapshot(snapshotId.result)
    // eslint-disable-next-line require-atomic-updates
    snapshotId = await takeSnapshot()
  })
})
