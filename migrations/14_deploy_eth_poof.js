require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const InputRootVerifier = artifacts.require('InputRootVerifier')
const OutputRootVerifier = artifacts.require('OutputRootVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const waWETH = artifacts.require('waWETH')
const PoofValMintableLendable = artifacts.require('PoofValMintableLendable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['ethereum', 'kovan'].includes(network)) {
      const depositVerifier = await DepositVerifier.deployed()
      const withdrawVerifier = await WithdrawVerifier.deployed()
      const inputRootVerifier = await InputRootVerifier.deployed()
      const outputRootVerifier = await OutputRootVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()

      const debtToken = await waWETH.deployed()

      await deployer.deploy(
        PoofValMintableLendable,
        'Poof ETH',
        'pETH',
        debtToken.address,
        [
          depositVerifier.address,
          withdrawVerifier.address,
          inputRootVerifier.address,
          outputRootVerifier.address,
          treeUpdateVerifier.address,
        ],
        toFixedHex(emptyTree.root()),
      )
    }
  })
}
