const DepositVerifier = artifacts.require('DepositVerifier')
const WithdrawVerifier = artifacts.require('WithdrawVerifier')
const InputRootVerifier = artifacts.require('InputRootVerifier')
const OutputRootVerifier = artifacts.require('OutputRootVerifier')
const TreeUpdateVerifier = artifacts.require('TreeUpdateVerifier')

module.exports = function (deployer) {
  return deployer.then(async () => {
    await deployer.deploy(DepositVerifier)
    await deployer.deploy(WithdrawVerifier)
    await deployer.deploy(InputRootVerifier)
    await deployer.deploy(OutputRootVerifier)
    await deployer.deploy(TreeUpdateVerifier)
  })
}
