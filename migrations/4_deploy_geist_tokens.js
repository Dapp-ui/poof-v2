require('dotenv').config()

const WGFTM = artifacts.require('wgFTM')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['fantom'].includes(network)) {
      await deployer.deploy(
        WGFTM,
        '0x39b3bd37208cbade74d0fcbdbb12d606295b430a', // gFTM
        '0x9FAD24f572045c7869117160A571B2e50b10d068', // lendingPool
        '0x47102245FEa0F8D35a6b28E54505e9FfD83d0704', // wethGateway
        '0x21ff58441e39278cf73D71850093db06AD02F076', // feeToSetter
      )
    }
  })
}
