require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const PoofValMintable = artifacts.require('PoofValMintable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    const isEthereum = ['emainnet', 'kovan'].includes(network)
    const isFantom = ['fantom', 'fantomtest'].includes(network)
    if (isFantom || isEthereum) {
      const depositVerifier = await DepositVerifier.deployed()
      const withdrawVerifier = await WithdrawVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()

      await deployer.deploy(
        PoofValMintable,
        isFantom ? 'Poof FTM' : 'Poof ETH',
        isFantom ? 'pFTM' : 'pETH',
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
