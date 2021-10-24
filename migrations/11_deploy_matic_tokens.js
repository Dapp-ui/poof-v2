require('dotenv').config()

const wamMATIC = artifacts.require('wamMATIC')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['matic', 'mumbai'].includes(network)) {
      await deployer.deploy(
        wamMATIC,
        network === 'matic'
          ? '0x8dF3aad3a84da6b69A4DA8aeC3eA40d9091B2Ac4'
          : '0xF45444171435d0aCB08a8af493837eF18e86EE27', // amMATIC
        network === 'matic'
          ? '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf'
          : '0x9198F13B08E299d85E096929fA9781A1E3d5d827', // lendingPool
        network === 'matic'
          ? '0xbEadf48d62aCC944a06EEaE0A9054A90E5A7dc97'
          : '0xee9eE614Ad26963bEc1Bec0D2c92879ae1F209fA', // wethGateway
        network === 'matic'
          ? '0x9D6266D572B5eC6c8528266e009cf732E6803033'
          : '0x9D6266D572B5eC6c8528266e009cf732E6803033', // feeToSetter
      )
    }
  })
}
