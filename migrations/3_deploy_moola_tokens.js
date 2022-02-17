require('dotenv').config()

const wmCELO = artifacts.require('wmCELO')
const wmcUSD = artifacts.require('wmcUSD')
const wmcEUR = artifacts.require('wmcEUR')

const deployments = {
  celo: [
    {
      contract: wmCELO,
      native: '0x471EcE3750Da237f93B8E339c536989b8978a438',
      moola: '0x7D00cd74FF385c955EA3d79e47BF06bD7386387D',
    },
    {
      contract: wmcUSD,
      native: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
      moola: '0x918146359264C492BD6934071c6Bd31C854EDBc3',
    },
    {
      contract: wmcEUR,
      native: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
      moola: '0xE273Ad7ee11dCfAA87383aD5977EE1504aC07568',
    },
  ],
  alfajores: [
    {
      contract: wmCELO,
      native: '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9',
      moola: '0x653cC2Cc0Be398614BAd5d5328336dc79281e246',
    },
    {
      contract: wmcUSD,
      native: '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1',
      moola: '0x3a0EA4e0806805527C750AB9b34382642448468D',
    },
    {
      contract: wmcEUR,
      native: '0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F',
      moola: '0x0D9B4311657003251d1eFa085e74f761185F271c',
    },
  ],
}

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['celo', 'alfajores'].includes(network)) {
      const lendingPool =
        network === 'celo'
          ? '0x970b12522CA9b4054807a2c5B736149a5BE6f670'
          : '0x58ad305f1eCe49ca55ADE0D5cCC90114C3902E88'
      const deployment = deployments[network]

      for (const { contract, native, moola } of deployment) {
        await deployer.deploy(
          contract,
          moola,
          native,
          lendingPool,
          process.env.FEE_TO_SETTER,
        )
      }
    }
  })
}
