/* global artifacts, web3, contract */
require('chai')
  .use(require('bn-chai')(web3.utils.BN))
  .use(require('chai-as-promised'))
  .should()

const { toBN, toWei, fromWei } = require('web3-utils')
const ERC20Mock = artifacts.require('ERC20Mock')
const WrappedMToken = artifacts.require('WrappedMToken')
const MockLendingPool = artifacts.require('MockLendingPool')

contract('WrappedMToken', (accounts) => {
  const sender = accounts[0]
  const feeToSetter = accounts[1]
  let token
  let wToken
  let lendingPool

  before(async () => {
    token = await ERC20Mock.new()
    lendingPool = await MockLendingPool.new(token.address)
    wToken = await WrappedMToken.new(
      'Wrapped',
      'W',
      lendingPool.address,
      token.address,
      lendingPool.address,
      feeToSetter,
    )
    await token.approve(wToken.address, 10000)
  })

  describe('#debtToUnderlying', () => {
    it('should work', async () => {
      let underlyingAmount = await wToken.debtToUnderlying(0)
      underlyingAmount.should.be.eq.BN(0)

      underlyingAmount = await wToken.debtToUnderlying(toWei('1'))
      underlyingAmount.should.be.eq.BN(1)
    })

    it('should be linear', async () => {
      const underlyingAmount1 = await wToken.debtToUnderlying(toWei('100'))
      const underlyingAmount2 = await wToken.debtToUnderlying(toWei('5'))
      const totalUnderlyingAmount = await wToken.debtToUnderlying(toWei('105'))
      totalUnderlyingAmount.should.be.eq.BN(
        underlyingAmount1.add(underlyingAmount2),
      )
    })
  })

  describe('#underlyingToDebt', () => {
    it('should work', async () => {
      let debtAmount = await wToken.underlyingToDebt(0)
      debtAmount.should.be.eq.BN(0)

      debtAmount = await wToken.underlyingToDebt(1)
      debtAmount.should.be.eq.BN(toWei('1'))
    })

    it('should be linear', async () => {
      const debtAmount1 = await wToken.underlyingToDebt(100)
      const debtAmount2 = await wToken.underlyingToDebt(5)
      const totalDebtAmount = await wToken.underlyingToDebt(105)
      totalDebtAmount.should.be.eq.BN(debtAmount1.add(debtAmount2))
    })
  })

  describe('#wrap', () => {
    it('should work', async () => {
      await wToken
        .wrap(0)
        .should.be.rejectedWith('underlyingAmount cannot be 0')

      const amount1 = toBN(500)
      const balanceBefore1 = await token.balanceOf(sender)
      const wBalanceBefore1 = await wToken.balanceOf(sender)
      await wToken.wrap(amount1)
      const balanceAfter1 = await token.balanceOf(sender)
      const wBalanceAfter1 = await wToken.balanceOf(sender)

      balanceBefore1.should.be.eq.BN(balanceAfter1.add(amount1))
      wBalanceAfter1.should.be.eq.BN(wBalanceBefore1.add(toWei(amount1)))

      const amount2 = toBN(1000)
      const balanceBefore2 = await token.balanceOf(sender)
      const wBalanceBefore2 = await wToken.balanceOf(sender)
      await wToken.wrap(amount2)
      const balanceAfter2 = await token.balanceOf(sender)
      const wBalanceAfter2 = await wToken.balanceOf(sender)

      balanceBefore2.should.be.eq.BN(balanceAfter2.add(amount2))
      wBalanceAfter2.should.be.eq.BN(wBalanceBefore2.add(toWei(amount2)))
    })
  })

  describe('interest bearing', () => {
    it('reflect interest earned in the underlying', async () => {
      // Double the amount in the pool
      await token.approve(lendingPool.address, 1500)
      await lendingPool.deposit(token.address, 1500, 0)
      await lendingPool.transfer(wToken.address, 1500)

      const underlyingAmount = await wToken.debtToUnderlying(toWei('1'))
      underlyingAmount.should.be.eq.BN(2)

      const debtAmount = await wToken.underlyingToDebt(2)
      debtAmount.should.be.eq.BN(toWei('1'))
    })
  })

  describe('#unwrap', () => {
    it('should work', async () => {
      await wToken.unwrap(0).should.be.rejectedWith('debtAmount cannot be 0')

      const amount1 = toBN(toWei('500'))
      const balanceBefore1 = await token.balanceOf(sender)
      const wBalanceBefore1 = await wToken.balanceOf(sender)
      await wToken.unwrap(amount1)
      const balanceAfter1 = await token.balanceOf(sender)
      const wBalanceAfter1 = await wToken.balanceOf(sender)

      // Should receive 200% - 1% return
      balanceAfter1.should.be.eq.BN(
        balanceBefore1.add(
          toBN(fromWei(amount1.mul(toBN(199)).div(toBN(100)))),
        ),
      )
      wBalanceBefore1.should.be.eq.BN(wBalanceAfter1.add(amount1))

      const amount2 = toBN(toWei('1000'))
      const balanceBefore2 = await token.balanceOf(sender)
      const wBalanceBefore2 = await wToken.balanceOf(sender)
      await wToken.unwrap(amount2)
      const balanceAfter2 = await token.balanceOf(sender)
      const wBalanceAfter2 = await wToken.balanceOf(sender)

      // Should receive 200% - 1% return
      balanceAfter2.should.be.eq.BN(
        balanceBefore2.add(
          toBN(fromWei(amount2.mul(toBN(199)).div(toBN(100)))),
        ),
      )
      wBalanceBefore2.should.be.eq.BN(wBalanceAfter2.add(amount2))
    })
  })
})
