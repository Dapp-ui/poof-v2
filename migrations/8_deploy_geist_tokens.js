require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const WGFTM = artifacts.require('wgFTM')
const PoofValMintableLendable = artifacts.require('PoofValMintableLendable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['fantom'].includes(network)) {
      const depositVerifier = await DepositVerifier.deployed()
      const withdrawVerifier = await WithdrawVerifier.deployed()
      const inputRootVerifier = await InputRootVerifier.deployed()
      const outputRootVerifier = await OutputRootVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()

      const wgFTM = await WGFTM.deployed()

      await deployer.deploy(
        PoofValMintableLendable,
        'Poof FTM',
        'pFTM',
        wgFTM.address,
        [
          depositVerifier.address,
          withdrawVerifier.address,
          treeUpdateVerifier.address,
          inputRootVerifier.address,
          outputRootVerifier.address,
        ],
        toFixedHex(emptyTree.root()),
      )
    }
  })
}
