require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const Poof = artifacts.require('Poof')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})
const FEE_MANAGER = "0x7DA532a6F59232936320011106585521B9F18362"

module.exports = function (deployer) {
  return deployer.then(async () => {
    const depositVerifier = await DepositVerifier.deployed()
    const withdrawVerifier = await WithdrawVerifier.deployed()
    const treeUpdateVerifier = await TreeUpdateVerifier.deployed()

    await deployer.deploy(
      Poof,
      process.env.ERC20,
      FEE_MANAGER,
      [
        depositVerifier.address,
        withdrawVerifier.address,
        treeUpdateVerifier.address,
      ],
      toFixedHex(emptyTree.root()),
    )
  })
}
