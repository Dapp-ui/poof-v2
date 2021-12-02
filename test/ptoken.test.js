/* global artifacts, web3, contract */
require('chai')
  .use(require('bn-chai')(web3.utils.BN))
  .use(require('chai-as-promised'))
  .should()

const PToken = artifacts.require('PToken')

contract('PToken', (accounts) => {
  const sender = accounts[0]
  const friend = accounts[1]
  let pToken
  const amount = 1000

  before(async () => {
    pToken = await PToken.new("Poof Mock", "pMock")
  })

  describe('#constructor', () => {
    it('should initialize properly', async () => {
      const owner = await pToken.owner()
      owner.should.be.equal(sender)
      const isSupplyManager = await pToken.supplyManagers(friend)
      isSupplyManager.should.be.equal(false)
    })
  })

  describe('#addSupplyManager', () => {
    it('should fail for unauthorized', async () => {
      await pToken
        .addSupplyManager(friend, { from: friend })
        .should.be.rejectedWith('Ownable: caller is not the owner')
    })
    it('should work', async () => {
      await pToken
        .addSupplyManager(friend, { from: sender })
      const isSupplyManager = await pToken.supplyManagers(friend)
      isSupplyManager.should.be.equal(true)
    })
  })

  describe('#renounceSupplyManager', () => {
    it('should fail for unauthorized', async () => {
      await pToken
        .renounceSupplyManager(friend, { from: friend })
        .should.be.rejectedWith('Ownable: caller is not the owner')
    })
    it('should work', async () => {
      await pToken
        .renounceSupplyManager(friend, { from: sender })
      const isSupplyManager = await pToken.supplyManagers(friend)
      isSupplyManager.should.be.equal(false)
    })
  })

  describe('#mint', () => {
    it('should fail for non supply manager', async () => {
      await pToken
        .mint(friend, amount, { from: friend })
        .should.be.rejectedWith('PToken: caller is not a supply manager')
    })
    it('should work', async () => {
      await pToken
        .addSupplyManager(friend)
      const balanceBefore = await pToken.balanceOf(friend)
      await pToken
        .mint(friend, amount, { from: friend })
      const balanceAfter = await pToken.balanceOf(friend)
      balanceAfter.sub(balanceBefore).should.be.eq.BN(amount)
      await pToken
        .renounceSupplyManager(friend)
    })
  })

  describe('#burn', () => {
    it('should fail for non supply manager', async () => {
      await pToken
        .burn(friend, amount, { from: friend })
        .should.be.rejectedWith('PToken: caller is not a supply manager')
    })
    it('should work', async () => {
      await pToken
        .addSupplyManager(friend)
      const balanceBefore = await pToken.balanceOf(friend)
      await pToken
        .burn(friend, amount, { from: friend })
      const balanceAfter = await pToken.balanceOf(friend)
      balanceBefore.sub(balanceAfter).should.be.eq.BN(amount)
      await pToken
        .renounceSupplyManager(friend)
    })
  })
})
