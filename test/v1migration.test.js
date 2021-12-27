/* global artifacts, web3, contract */
require('chai')
  .use(require('bn-chai')(web3.utils.BN))
  .use(require('chai-as-promised'))
  .should()

const PToken = artifacts.require('PToken')
const ERC20Mock = artifacts.require('ERC20Mock')
const V1Migration = artifacts.require('V1Migration')

contract('V1Migration', (accounts) => {
  const sender = accounts[0]
  let pToken, token, v1Migration
  const amount = 1000

  before(async () => {
    token = await ERC20Mock.new()
    pToken = await PToken.new('Poof Mock', 'pMock')
    v1Migration = await V1Migration.new(token.address, pToken.address)
    await pToken.addSupplyManager(v1Migration.address)
  })

  describe('#mint', () => {
    it('should work', async () => {
      await token.approve(v1Migration.address, amount)
      const pBalanceBefore = await pToken.balanceOf(sender)
      const balanceBefore = await token.balanceOf(sender)
      await v1Migration.mint(amount)
      const pBalanceAfter = await pToken.balanceOf(sender)
      const balanceAfter = await token.balanceOf(sender)
      pBalanceAfter.sub(pBalanceBefore).should.be.eq.BN(amount)
      balanceBefore.sub(balanceAfter).should.be.eq.BN(amount)
    })
  })

  describe('#burn', () => {
    it('should work', async () => {
      const pBalanceBefore = await pToken.balanceOf(sender)
      const balanceBefore = await token.balanceOf(sender)
      await v1Migration.burn(amount)
      const pBalanceAfter = await pToken.balanceOf(sender)
      const balanceAfter = await token.balanceOf(sender)
      pBalanceBefore.sub(pBalanceAfter).should.be.eq.BN(amount)
      balanceAfter.sub(balanceBefore).should.be.eq.BN(amount)
    })
  })
})
