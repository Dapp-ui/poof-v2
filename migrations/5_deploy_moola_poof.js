require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const WMCELO = artifacts.require('wmCELO')
const WMCUSD = artifacts.require('wmcUSD')
const WMCEUR = artifacts.require('wmcEUR')
const PoofMintableLendable = artifacts.require('PoofMintableLendable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['cmainnet', 'alfajores'].includes(network)) {
      const depositVerifier = await DepositVerifier.deployed()
      const withdrawVerifier = await WithdrawVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()
      const wmCELO = await WMCELO.deployed()
      const wmcUSD = await WMCUSD.deployed()
      const wmcEUR = await WMCEUR.deployed()

      await deployer.deploy(
        PoofMintableLendable,
        'Poof CELO',
        'pCELO',
        wmCELO.address,
        [
          depositVerifier.address,
          withdrawVerifier.address,
          treeUpdateVerifier.address,
        ],
        toFixedHex(emptyTree.root()),
      )
      await deployer.deploy(
        PoofMintableLendable,
        'Poof USD',
        'pUSD',
        wmcUSD.address,
        [
          depositVerifier.address,
          withdrawVerifier.address,
          treeUpdateVerifier.address,
        ],
        toFixedHex(emptyTree.root()),
      )
      await deployer.deploy(
        PoofMintableLendable,
        'Poof EUR',
        'pEUR',
        wmcEUR.address,
        [
          depositVerifier.address,
          withdrawVerifier.address,
          treeUpdateVerifier.address,
        ],
        toFixedHex(emptyTree.root()),
      )
    }
  })
}
