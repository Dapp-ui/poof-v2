require('dotenv').config()

const wmCELO = artifacts.require('wmCELO')
const wmcUSD = artifacts.require('wmcUSD')
const wmcEUR = artifacts.require('wmcEUR')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    if (['cmainnet', 'alfajores'].includes(network)) {
      const lendingPool =
        network === 'cmainnet'
          ? '0xc1548F5AA1D76CDcAB7385FA6B5cEA70f941e535'
          : '0x0886f74eEEc443fBb6907fB5528B57C28E813129'
      const mCELO =
        network === 'cmainnet'
          ? '0x7037F7296B2fc7908de7b57a89efaa8319f0C500'
          : '0x86f61EB83e10e914fc6F321F5dD3c2dD4860a003'
      const CELO =
        network === 'cmainnet'
          ? '0x471EcE3750Da237f93B8E339c536989b8978a438'
          : '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9'
      const mcUSD =
        network === 'cmainnet'
          ? '0x64dEFa3544c695db8c535D289d843a189aa26b98'
          : '0x71DB38719f9113A36e14F409bAD4F07B58b4730b'
      const cUSD =
        network === 'cmainnet'
          ? '0x765DE816845861e75A25fCA122bb6898B8B1282a'
          : '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'
      const mcEUR =
        network === 'cmainnet'
          ? '0xa8d0E6799FF3Fd19c6459bf02689aE09c4d78Ba7'
          : '0x32974C7335e649932b5766c5aE15595aFC269160'
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
