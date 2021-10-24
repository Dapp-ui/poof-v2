require('dotenv').config()

const waavaWAVAX = artifacts.require('waavaWAVAX')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['avalanche', 'fuji'].includes(network)) {
      await deployer.deploy(
        waavaWAVAX,
        network === 'avalanche'
          ? '0xDFE521292EcE2A4f44242efBcD66Bc594CA9714B'
          : '0xf8C78Ba24DD965487f4472dfb280c46800a0c9B6', // aavaWAVAX
        network === 'avalanche'
          ? '0x4F01AeD16D97E3aB5ab2B501154DC9bb0F1A5A2C'
          : '0x76cc67FF2CC77821A70ED14321111Ce381C2594D', // lendingPool
        network === 'avalanche'
          ? '0x8a47F74d1eE0e2edEB4F3A7e64EF3bD8e11D27C8'
          : '0x1648C14DbB6ccdd5846969cE23DeEC4C66a03335', // wethGateway
        network === 'avalanche'
          ? '0xF3B0aaBc017C306CF1364dBcDC9608Eedc605A3d'
          : '0xF3B0aaBc017C306CF1364dBcDC9608Eedc605A3d', // feeToSetter
      )
    }
  })
}
