require('dotenv').config()

const VIP = artifacts.require('VIP')

module.exports = function (deployer) {
  return deployer.then(async () => {
    await deployer.deploy(VIP)
  })
}
