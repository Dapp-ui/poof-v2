require('dotenv').config()

const MerkleTree = require('fixed-merkle-tree')

const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const InputRootVerifier = artifacts.require('InputRootVerifier')
const OutputRootVerifier = artifacts.require('OutputRootVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')
const WMCELO = artifacts.require('wmCELO')
const WMCUSD = artifacts.require('wmcUSD')
const WMCEUR = artifacts.require('wmcEUR')
const WGFTM = artifacts.require('wgFTM')
const waavaWAVAX = artifacts.require('waavaWAVAX')
const wamMATIC = artifacts.require('wamMATIC')
const waWETH = artifacts.require('waWETH')
const PToken = artifacts.require('PToken')
const PoofMintableLendable = artifacts.require('PoofMintableLendable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

const config = {
  celo: [
    { wrapped: WMCELO, name: "Poof CELO", symbol: "pCELO" },
    { wrapped: WMCUSD, name: "Poof cUSD", symbol: "pUSD" },
    { wrapped: WMCEUR, name: "Poof cEUR", symbol: "pEUR" },
  ],
  alfajores: [
    { wrapped: WMCELO, name: "Poof CELO", symbol: "pCELO" },
    { wrapped: WMCUSD, name: "Poof cUSD", symbol: "pUSD" },
    { wrapped: WMCEUR, name: "Poof cEUR", symbol: "pEUR" },
  ],
  fantom: [
    { wrapped: WGFTM, name: "Poof FTM", symbol: "pFTM" },
  ],
  avalanche: [
    { wrapped: waavaWAVAX, name: "Poof AVAX", symbol: "pAVAX" },
  ],
  fuji: [
    { wrapped: waavaWAVAX, name: "Poof AVAX", symbol: "pAVAX" },
  ],
  polygon: [
    { wrapped: wamMATIC, name: "Poof MATIC", symbol: "pMATIC" },
  ],
  mumbai: [
    { wrapped: wamMATIC, name: "Poof MATIC", symbol: "pMATIC" },
  ],
  ethereum: [
    { wrapped: waWETH, name: "Poof ETH", symbol: "pETH" },
  ],
  kovan: [
    { wrapped: waWETH, name: "Poof ETH", symbol: "pETH" },
  ],
}

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    for (const pool of config[network]) {
      const depositVerifier = await DepositVerifier.deployed()
      const withdrawVerifier = await WithdrawVerifier.deployed()
      const inputRootVerifier = await InputRootVerifier.deployed()
      const outputRootVerifier = await OutputRootVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()

      const { wrapped, name, symbol } = pool;
      const wrappedToken = wrapped.deployed ? (await wrapped.deployed()).address : wrapped

      const pToken = await deployer.deploy(
        PToken,
        name,
        symbol
      )
      const poof = await deployer.deploy(
        PoofMintableLendable,
        wrappedToken,
        [
          depositVerifier.address,
          withdrawVerifier.address,
          inputRootVerifier.address,
          outputRootVerifier.address,
          treeUpdateVerifier.address,
        ],
        toFixedHex(emptyTree.root()),
        pToken.address
      )
      await pToken.addSupplyManager(poof.address)
    }
  })
}
