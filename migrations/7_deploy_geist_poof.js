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
      const wgFTM = await deployer.deploy(
        WGFTM,
        '0x39b3bd37208cbade74d0fcbdbb12d606295b430a', // gFTM
        '0x9FAD24f572045c7869117160A571B2e50b10d068', // lendingPool
        '0x47102245FEa0F8D35a6b28E54505e9FfD83d0704', // wethGateway
        '0x21ff58441e39278cf73D71850093db06AD02F076', // feeToSetter
      )

      await deployer.deploy(
        PoofValMintableLendable,
        'Poof gFTM',
        'pgFTM',
        wgFTM.address,
        [
          '0x64c895915AbFdc7BE9Fd834fE4b10d3a8f19cF62', // DepositVerifier
          '0xEDf1B63354634835A8C856682c05aB20292f0cfc', // WithdrawVerifier
          '0xb48Be19dD3c46227D16EdC5eEfb363516D5Ab6B3', // TreeUpdateVerifier
        ],
        toFixedHex(emptyTree.root()),
      )
    }
  })
}
