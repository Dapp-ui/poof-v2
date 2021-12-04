require('dotenv').config()

const waWETH = artifacts.require('waWETH')
const waavaWAVAX = artifacts.require('waavaWAVAX')
const wamMATIC = artifacts.require('wamMATIC')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    let contract, token, lendingPool, wethGateway, feeToSetter
    if (network === "ethereum") {
      contract = waWETH
      token = "0x030ba81f1c18d280636f32af80b9aad02cf0854e"
      lendingPool = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9"
      wethGateway = "0xcc9a0B7c43DC2a5F023Bb9b738E45B0Ef6B06E04"
      feeToSetter = "0x16D4DEEfb31E1A10d4C8ba80454bDef7ad83B23c"
    } else if (network === "kovan") {
      contract = waWETH
      token = "0x87b1f4cf9bd63f7bbd3ee1ad04e8f52540349347"
      lendingPool = "0xe0fba4fc209b4948668006b2be61711b7f465bae"
      wethGateway = "0xA61ca04DF33B72b235a8A28CfB535bb7A5271B70"
      feeToSetter = "0x16D4DEEfb31E1A10d4C8ba80454bDef7ad83B23c"
      // } else if (network === "avalanche") {
      //   contract = waavaWAVAX
      //   token = "0xDFE521292EcE2A4f44242efBcD66Bc594CA9714B"
      //   lendingPool = "0x4F01AeD16D97E3aB5ab2B501154DC9bb0F1A5A2C"
      //   wethGateway = "0x8a47F74d1eE0e2edEB4F3A7e64EF3bD8e11D27C8"
      //   feeToSetter = "0xF3B0aaBc017C306CF1364dBcDC9608Eedc605A3d"
      // } else if (network === "fuji") {
      //   contract = waavaWAVAX
      //   token = "0xf8C78Ba24DD965487f4472dfb280c46800a0c9B6"
      //   lendingPool = "0x76cc67FF2CC77821A70ED14321111Ce381C2594D"
      //   wethGateway = "0x1648C14DbB6ccdd5846969cE23DeEC4C66a03335"
      //   feeToSetter = "0xF3B0aaBc017C306CF1364dBcDC9608Eedc605A3d"
    } else if (network === "polygon") {
      contract = wamMATIC
      token = "0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4"
      lendingPool = "0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf"
      wethGateway = "0xbEadf48d62aCC944a06EEaE0A9054A90E5A7dc97"
      feeToSetter = "0x9D6266D572B5eC6c8528266e009cf732E6803033"
    } else if (network === "mumbai") {
      contract = wamMATIC
      token = "0xF45444171435d0aCB08a8af493837eF18e86EE27"
      lendingPool = "0x9198F13B08E299d85E096929fA9781A1E3d5d827"
      wethGateway = "0xee9eE614Ad26963bEc1Bec0D2c92879ae1F209fA"
      feeToSetter = "0x9D6266D572B5eC6c8528266e009cf732E6803033"
    }
    if (contract) {
      await deployer.deploy(
        contract,
        token,
        lendingPool,
        wethGateway,
        feeToSetter
      )
    }
  })
}
