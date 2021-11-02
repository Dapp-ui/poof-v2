require('dotenv').config()

const waWETH = artifacts.require('waWETH')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['ethereum', 'kovan'].includes(network)) {
      await deployer.deploy(
        waWETH,
        network === 'ethereum'
          ? '0x030ba81f1c18d280636f32af80b9aad02cf0854e'
          : '0x87b1f4cf9bd63f7bbd3ee1ad04e8f52540349347', // aWETH
        network === 'ethereum'
          ? '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9'
          : '0xe0fba4fc209b4948668006b2be61711b7f465bae', // lendingPool
        network === 'ethereum'
          ? '0xcc9a0B7c43DC2a5F023Bb9b738E45B0Ef6B06E04'
          : '0xA61ca04DF33B72b235a8A28CfB535bb7A5271B70', // wethGateway
        network === 'ethereum'
          ? '0x16D4DEEfb31E1A10d4C8ba80454bDef7ad83B23c'
          : '0x16D4DEEfb31E1A10d4C8ba80454bDef7ad83B23c', // feeToSetter
      )
    }
  })
}
