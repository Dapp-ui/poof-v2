require('dotenv').config()

const wmCELO = artifacts.require('wmCELO')
const wmcUSD = artifacts.require('wmcUSD')
const wmcEUR = artifacts.require('wmcEUR')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['cmainnet', 'alfajores'].includes(network)) {
      const lendingPool =
        network === 'cmainnet'
          ? '0x970b12522CA9b4054807a2c5B736149a5BE6f670'
          : '0x58ad305f1eCe49ca55ADE0D5cCC90114C3902E88'
      const mCELO =
        network === 'cmainnet'
          ? '0x7D00cd74FF385c955EA3d79e47BF06bD7386387D'
          : '0x653cC2Cc0Be398614BAd5d5328336dc79281e246'
      const CELO =
        network === 'cmainnet'
          ? '0x471EcE3750Da237f93B8E339c536989b8978a438'
          : '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9'
      const mcUSD =
        network === 'cmainnet'
          ? '0x918146359264C492BD6934071c6Bd31C854EDBc3'
          : '0x3a0EA4e0806805527C750AB9b34382642448468D'
      const cUSD =
        network === 'cmainnet'
          ? '0x765DE816845861e75A25fCA122bb6898B8B1282a'
          : '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'
      const mcEUR =
        network === 'cmainnet'
          ? '0xE273Ad7ee11dCfAA87383aD5977EE1504aC07568'
          : '0x0D9B4311657003251d1eFa085e74f761185F271c'
      const cEUR =
        network === 'cmainnet'
          ? '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73'
          : '0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F'

      await deployer.deploy(
        wmCELO,
        mCELO,
        CELO,
        lendingPool,
        process.env.FEE_TO_SETTER,
      )
      await deployer.deploy(
        wmcUSD,
        mcUSD,
        cUSD,
        lendingPool,
        process.env.FEE_TO_SETTER,
      )
      await deployer.deploy(
        wmcEUR,
        mcEUR,
        cEUR,
        lendingPool,
        process.env.FEE_TO_SETTER,
      )
    }
  })
}
