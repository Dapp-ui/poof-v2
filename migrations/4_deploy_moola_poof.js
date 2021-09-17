require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const wmcUSD = artifacts.require('wmcUSD')
const wmcEUR = artifacts.require('wmcEUR')
const PoofMintableLendable = artifacts.require('PoofMintableLendable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

module.exports = function (deployer) {
  return deployer.then(async () => {
    const depositVerifier = await DepositVerifier.deployed()
    const withdrawVerifier = await WithdrawVerifier.deployed()
    const treeUpdateVerifier = await TreeUpdateVerifier.deployed()
    const usd = await wmcUSD.deployed()
    const eur = await wmcEUR.deployed()

    await deployer.deploy(
      PoofMintableLendable,
      'Poof Interest Bearing USD',
      'pUSD',
      usd.address,
      [
        depositVerifier.address,
        withdrawVerifier.address,
        treeUpdateVerifier.address,
      ],
      toFixedHex(emptyTree.root()),
    )
    await deployer.deploy(
      PoofMintableLendable,
      'Poof Interest Bearing EUR',
      'pEUR',
      eur.address,
      [
        depositVerifier.address,
        withdrawVerifier.address,
        treeUpdateVerifier.address,
      ],
      toFixedHex(emptyTree.root()),
    )
  })
}
