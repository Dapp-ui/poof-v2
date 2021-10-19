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
      const inputRootVerifier = await InputRootVerifier.deployed()
      const outputRootVerifier = await OutputRootVerifier.deployed()
      const treeUpdateVerifier = await TreeUpdateVerifier.deployed()
      const wmCELO = await WMCELO.at(network === 'cmainnet' ? "0xe3305d2c398B6AD1f2228621154a3Daf2a47f478" : "0xa16663e35ab432bdB4dBB623f86AD395A3f90BA2")
      const wmcUSD = await WMCUSD.at(network === 'cmainnet' ? "0xC21984be83Af1e000ab04f63b61E0866Cb01e686" : "0x005603E4b5e2AC5533F2F6a8AB16867F9CA13977")
      const wmcEUR = await WMCEUR.at(network === 'cmainnet' ? "0x99319f8d95110fb26171B98fE24Af088f981c650" : "0x2eC0b1a93418fE3d7C1D43E85A8fbf95345bD947")

      await deployer.deploy(
        PoofMintableLendable,
        'Poof CELO',
        'pCELO',
        wmCELO.address,
        [
          depositVerifier.address,
          withdrawVerifier.address,
          inputRootVerifier.address,
          outputRootVerifier.address,
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
          inputRootVerifier.address,
          outputRootVerifier.address,
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
          inputRootVerifier.address,
          outputRootVerifier.address,
          treeUpdateVerifier.address,
        ],
        toFixedHex(emptyTree.root()),
      )
    }
  })
}
