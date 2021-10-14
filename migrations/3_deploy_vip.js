require('dotenv').config()

const VIP = artifacts.require('VIP')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (network === 'cmainnet') {
      await deployer.deploy(VIP)
    }
  })
}
