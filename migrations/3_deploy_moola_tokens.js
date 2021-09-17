require('dotenv').config()

const wmcUSD = artifacts.require('wmcUSD')
const wmcEUR = artifacts.require('wmcEUR')

module.exports = function (deployer, network) {
  return deployer.then(async () => {
    const lendingPool =
      network === 'mainnet'
        ? '0xc1548F5AA1D76CDcAB7385FA6B5cEA70f941e535'
        : '0x0886f74eEEc443fBb6907fB5528B57C28E813129'
    const mcUSD =
      network === 'mainnet'
        ? '0x64dEFa3544c695db8c535D289d843a189aa26b98'
        : '0x71DB38719f9113A36e14F409bAD4F07B58b4730b'
    const cUSD =
      network === 'mainnet'
        ? '0x765DE816845861e75A25fCA122bb6898B8B1282a'
        : '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'
    const mcEUR =
      network === 'mainnet'
        ? '0xa8d0E6799FF3Fd19c6459bf02689aE09c4d78Ba7'
        : '0x32974C7335e649932b5766c5aE15595aFC269160'
    const cEUR =
      network === 'mainnet'
        ? '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73'
        : '0x10c892A6EC43a53E45D0B916B4b7D383B1b78C0F'

    await deployer.deploy(wmcUSD, mcUSD, cUSD, lendingPool, process.env.FEE_TO_SETTER)
    await deployer.deploy(wmcEUR, mcEUR, cEUR, lendingPool, process.env.FEE_TO_SETTER)
  })
}
