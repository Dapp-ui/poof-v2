require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const InputRootVerifier = artifacts.require('InputRootVerifier')
const OutputRootVerifier = artifacts.require('OutputRootVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const PoofValMintable = artifacts.require('PoofValMintable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    const isPolygon = ['mumbai'].includes(network)
    const isAvalanche = ['fuji'].includes(network)
    const isEthereum = ['kovan'].includes(network)
    const isFantom = ['opera'].includes(network)
    let name, symbol;
    if (isPolygon) {
      name = "Poof MATIC"
      symbol = "pMATIC"
    } else if (isAvalanche) {
      name = "Poof AVAX"
      symbol = "pAVAX"
    } else if (isEthereum) {
      name = "Poof ETH"
      symbol = "pETH"
    } else if (isFantom) {
      name = "Poof FTM"
      symbol = "pFTM"
    }
    if (name && symbol) {
      const depositVerifier = await DepositVerifier.deployed()
      const withdrawVerifier = await WithdrawVerifier.deployed()
      const inputRootVerifier = await InputRootVerifier.deployed()
      const outputRootVerifier = await OutputRootVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()

      await deployer.deploy(
        PoofValMintable,
        name,
        symbol,
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
