require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
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
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()
      const wgFTM = await WGFTM.deploy(
        '0x39b3bd37208cbade74d0fcbdbb12d606295b430a',
        '0x9FAD24f572045c7869117160A571B2e50b10d068',
        '0x47102245FEa0F8D35a6b28E54505e9FfD83d0704',
        '0x21ff58441e39278cf73D71850093db06AD02F076',
      )

      await deployer.deploy(
        PoofValMintableLendable,
        'Poof gFTM',
        'pgFTM',
        wgFTM.address,
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
