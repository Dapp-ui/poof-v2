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
const WMCREAL = artifacts.require('wmcREAL')
const WGFTM = artifacts.require('wgFTM')
const wamMATIC = artifacts.require('wamMATIC')
const waWETH = artifacts.require('waWETH')
const PToken = artifacts.require('PToken')
const PoofMintableLendable = artifacts.require('PoofMintableLendable')
const PoofValMintableLendable = artifacts.require('PoofValMintableLendable')
const PoofValMintable = artifacts.require('PoofValMintable')

const { toFixedHex, poseidonHash2 } = require('../src/utils')

const emptyTree = new MerkleTree(process.env.MERKLE_TREE_HEIGHT, [], {
  hashFunction: poseidonHash2,
})

const config = {
  celo: [
    // { contract: PoofMintableLendable, wrapped: WMCELO, name: "Poof CELO", symbol: "pCELO" },
    // { contract: PoofMintableLendable, wrapped: WMCUSD, name: "Poof cUSD", symbol: "pUSD" },
    // { contract: PoofMintableLendable, wrapped: WMCEUR, name: "Poof cEUR", symbol: "pEUR" },
    { contract: PoofMintableLendable, wrapped: WMCREAL, name: "Poof cREAL", symbol: "pREAL" },
  ],
  alfajores: [
    // { contract: PoofMintableLendable, wrapped: WMCELO, name: "Poof CELO", symbol: "pCELO" },
    // { contract: PoofMintableLendable, wrapped: WMCUSD, name: "Poof cUSD", symbol: "pUSD" },
    // { contract: PoofMintableLendable, wrapped: WMCEUR, name: "Poof cEUR", symbol: "pEUR" },
    { contract: PoofMintableLendable, wrapped: WMCREAL, name: "Poof cREAL", symbol: "pREAL" },
  ],
  fantom: [
    { contract: PoofValMintableLendable, wrapped: WGFTM, name: "Poof FTM", symbol: "pFTM" },
  ],
  fantomtest: [
    { contract: PoofValMintable, name: "Poof FTM", symbol: "pFTM" },
  ],
  avalanche: [
    { contract: PoofValMintableLendable, wrapped: "0x71003ce2353c91e05293444a9c3225997ccd353c", name: "Poof AVAX", symbol: "pAVAX" },
  ],
  fuji: [
    { contract: PoofValMintableLendable, wrapped: "0xcb6b9b4b2d519c0adde2142cc695464c39369ab4", name: "Poof AVAX", symbol: "pAVAX" },
  ],
  polygon: [
    { contract: PoofValMintableLendable, wrapped: wamMATIC, name: "Poof MATIC", symbol: "pMATIC" },
  ],
  mumbai: [
    { contract: PoofValMintableLendable, wrapped: wamMATIC, name: "Poof MATIC", symbol: "pMATIC" },
  ],
  ethereum: [
    { contract: PoofValMintableLendable, wrapped: waWETH, name: "Poof ETH", symbol: "pETH" },
  ],
  kovan: [
    { contract: PoofValMintableLendable, wrapped: waWETH, name: "Poof ETH", symbol: "pETH" },
  ],
}

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (!config[network]) {
      return;
    }
    for (const pool of config[network]) {
      const depositVerifier = await DepositVerifier.deployed()
      const withdrawVerifier = await WithdrawVerifier.deployed()
      const inputRootVerifier = await InputRootVerifier.deployed()
      const outputRootVerifier = await OutputRootVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()

      const { contract, wrapped, name, symbol } = pool;

      let wrappedToken
      if (wrapped) {
        wrappedToken = wrapped.deployed ? (await wrapped.deployed()).address : wrapped
      }

      const pToken = await deployer.deploy(
        PToken,
        name,
        symbol
      )
      let poof
      if (
        contract === PoofMintableLendable ||
        contract === PoofValMintableLendable
      ) {
        poof = await deployer.deploy(
          contract,
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
      } else if (contract === PoofValMintable) {
        poof = await deployer.deploy(
          contract,
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
      }
      if (poof) {
        await pToken.addSupplyManager(poof.address)
      } else {
        throw new Error("Poof was undefined")
      }
    }
  })
}
