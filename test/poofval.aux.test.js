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
} = require('../src/utils')
const { getEncryptionPublicKey } = require('eth-sig-util')
const ERC20Mock = artifacts.require('ERC20Mock')
const WERC20ValMock = artifacts.require('WERC20ValMock')
const PoofValMintableLendable = artifacts.require('PoofValMintableLendable')
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

contract('PoofValMintableLendableLendable', (accounts) => {
  let poof
  const amount = toBN(16)
  const debt = amount.div(toBN(2))
  // eslint-disable-next-line no-unused-vars
  const sender = accounts[0]
  const recipient = accounts[1]
  const relayer = accounts[2]
  // eslint-disable-next-line no-unused-vars
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
    uToken = await ERC20Mock.new()
    dToken = await WERC20ValMock.new(uToken.address)
    poof = await PoofValMintableLendable.new(
      'Poof ETH',
      'pETH',
      dToken.address,
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
        unitPerUnderlying: toBN(2),
      })
      const balanceBefore = toBN(await web3.eth.getBalance(sender))
      const { logs } = await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, {
        value: amount.div(toBN(2)),
        gasPrice: '0',
      })
      const balanceAfter = toBN(await web3.eth.getBalance(sender))
      balanceBefore.should.be.eq.BN(balanceAfter.add(amount.div(toBN(2)))) // debtToken only takes half

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
  })

  describe('#withdraw', () => {
    let proofs, args, account

    beforeEach(async () => {
      ; ({ proofs, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
        unitPerUnderlying: toBN(2),
      }))
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, {
        value: amount.div(toBN(2)),
        gasPrice: '0',
      })
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
        unitPerUnderlying: toBN(2),
        recipient,
        publicKey,
      })
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const { logs } = await poof.withdraw(
        withdrawSnark.proofs,
        withdrawSnark.args,
      )
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount.div(toBN(2)))) // Debt token only returns half
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
  })

  describe('#mint', () => {
    let proofs, args, account

    beforeEach(async () => {
      ; ({ proofs, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
        unitPerUnderlying: toBN(2),
      }))
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, {
        value: amount.div(toBN(2)),
        gasPrice: '0',
      })
    })

    it('should fail if amount is != fee', async () => {
      const mintSnark = await controller.withdraw({
        account,
        amount,
        unitPerUnderlying: toBN(2),
        recipient,
        publicKey,
      })
      await poof
        .mint(mintSnark.proofs, mintSnark.args)
        .should.be.rejectedWith('Amount can only be used for fee')
    })

    it('should fail if debt > user balance', async () => {
      const withdrawSnark = await controller
        .withdraw({
          account,
          amount: toBN(0),
          debt: debt.add(toBN(1)),
          unitPerUnderlying: toBN(2),
          recipient,
          publicKey,
        })
      await poof.withdraw(withdrawSnark.proofs, withdrawSnark.args).should.be.rejectedWith("Invalid withdrawal proof")
    })

    it('should fail if `unitPerUnderlying` is lower than expected', async () => {
      const mintSnark = await controller.withdraw({
        account,
        amount: toBN(0),
        debt: debt.add(toBN(1)),
        unitPerUnderlying: toBN(1),
        recipient,
        publicKey,
      })
      await poof
        .mint(mintSnark.proofs, mintSnark.args)
        .should.be.rejectedWith('Underlying per unit is overstated')
    })

    it('should work', async () => {
      const mintSnark = await controller.withdraw({
        account,
        amount: toBN(0),
        debt,
        unitPerUnderlying: toBN(2),
        recipient,
        publicKey,
      })
      let balanceBefore = await poof.balanceOf(recipient)
      await poof.mint(mintSnark.proofs, mintSnark.args)
      let balanceAfter = await poof.balanceOf(recipient)
      balanceAfter.should.be.eq.BN(balanceBefore.add(debt))

      const withdrawSnark = await controller
        .withdraw({
          account: mintSnark.account,
          amount: toBN(1),
          unitPerUnderlying: toBN(2),
          recipient,
          publicKey,
        })
      await poof.withdraw(withdrawSnark.proofs, withdrawSnark.args).should.be.rejectedWith("Invalid withdrawal proof")
    })

    it('should send fee to relayer', async () => {
      const fee = toBN(3)
      const mintSnark = await controller.withdraw({
        account,
        amount: toBN(0),
        debt: debt.sub(fee),
        unitPerUnderlying: toBN(2),
        recipient,
        publicKey,
        relayer,
        fee,
      })

      const relayerBalanceBefore = toBN(await web3.eth.getBalance(relayer))
      const recipientBalanceBefore = await poof.balanceOf(recipient)
      await poof.mint(mintSnark.proofs, mintSnark.args)
      const recipientBalanceAfter = await poof.balanceOf(recipient)
      const relayerBalanceAfter = toBN(await web3.eth.getBalance(relayer))

      recipientBalanceAfter.should.be.eq.BN(
        recipientBalanceBefore.add(debt.sub(fee)),
      )
      // fee is in units, so we divide it to get underlying
      relayerBalanceAfter.should.be.eq.BN(
        relayerBalanceBefore.add(fee.div(toBN(2))),
      )
    })
  })

  describe('#burn', () => {
    let proofs, args, account
    beforeEach(async () => {
      ; ({ proofs, args, account } = await controller.deposit({
        account: new Account(),
        publicKey,
        amount,
        unitPerUnderlying: toBN(2),
      }))
      await poof.methods['deposit(bytes[3],(uint256,uint256,uint256,bytes32,(bytes),(bytes32,bytes32,bytes32,bytes32,uint256,bytes32,bytes32)))'](proofs, args, { value: amount, gasPrice: '0' })
        ; ({ proofs, args, account } = await controller.withdraw({
          account,
          amount: toBN(0),
          debt,
          unitPerUnderlying: toBN(2),
          recipient: sender,
          publicKey,
        }))
      await poof.mint(proofs, args)
    })

    it('should fail if amount is > 0', async () => {
      const burnSnark = await controller.deposit({
        account,
        amount,
        unitPerUnderlying: toBN(2),
        publicKey,
      })
      await poof
        .burn(burnSnark.proofs, burnSnark.args)
        .should.be.rejectedWith('Cannot use amount for burning')
    })

    it('should fail if debt > user debt', async () => {
      await controller
        .deposit({
          account,
          amount: toBN(0),
          debt: debt.add(toBN(1)),
          unitPerUnderlying: toBN(2),
          publicKey,
        })
        .should.be.rejectedWith('Cannot create an account with negative debt')
    })

    it('should fail if `unitPerUnderlying` is lower than expected', async () => {
      const burnSnark = await controller.deposit({
        account,
        amount: toBN(0),
        debt,
        unitPerUnderlying: toBN(1),
        publicKey,
      })
      await poof
        .burn(burnSnark.proofs, burnSnark.args)
        .should.be.rejectedWith('Underlying per unit is overstated')
    })

    it('should work', async () => {
      const burnSnark = await controller.deposit({
        account,
        amount: toBN(0),
        debt,
        unitPerUnderlying: toBN(2),
        publicKey,
      })
      let balanceBefore = await poof.balanceOf(sender)
      await poof.burn(burnSnark.proofs, burnSnark.args)
      let balanceAfter = await poof.balanceOf(sender)
      balanceBefore.should.be.eq.BN(balanceAfter.add(debt))

      const withdrawSnark = await controller.withdraw({
        account: burnSnark.account,
        amount,
        unitPerUnderlying: toBN(2),
        recipient,
        publicKey,
      })
      balanceBefore = toBN(await web3.eth.getBalance(recipient))
      await poof.withdraw(withdrawSnark.proofs, withdrawSnark.args)
      balanceAfter = toBN(await web3.eth.getBalance(recipient))
      // `amount` is denominated in dToken which trades at 2:1 with uToken
      balanceAfter.should.be.eq.BN(balanceBefore.add(amount.div(toBN(2))))
    })
  })

  afterEach(async () => {
    await revertSnapshot(snapshotId.result)
    // eslint-disable-next-line require-atomic-updates
    snapshotId = await takeSnapshot()
  })
})
