const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')

module.exports = function (deployer) {
  return deployer.then(async () => {
    await deployer.deploy(DepositVerifier)
    await deployer.deploy(WithdrawVerifier)
    await deployer.deploy(TreeUpdateVerifier)
  })
}
