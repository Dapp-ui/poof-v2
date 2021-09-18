/* global artifacts, web3, contract */
require('chai')
  .use(require('bn-chai')(web3.utils.BN))
  .use(require('chai-as-promised'))
  .should()

const FeeBase = artifacts.require('FeeBase')

contract('FeeBase', (accounts) => {
  const sender = accounts[0]
  const friend = accounts[1]
  let feeBase

  before(async () => {
    feeBase = await FeeBase.new(sender)
  })

  describe('#constructor', () => {
    it('should initialize properly', async () => {
      const feeToSetter = await feeBase.feeToSetter()
      feeToSetter.should.be.equal(sender)
      const feeTo = await feeBase.feeTo()
      feeTo.should.be.equal(sender)
      const feeDivisor = await feeBase.feeDivisor()
      feeDivisor.should.be.eq.BN(10)
      const hasFee = await feeBase.hasFee()
      hasFee.should.be.equal(true)
    })
  })

  describe('#setFeeToSetter', () => {
    it('should work', async () => {
      await feeBase
        .setFeeToSetter(friend, { from: friend })
        .should.be.rejectedWith('Sender not authorized to update feeToSetter')

      await feeBase.setFeeToSetter(friend)
      let newFeeToSetter = await feeBase.feeToSetter()
      newFeeToSetter.should.be.equal(friend)

      await feeBase.setFeeToSetter(sender, { from: friend })
      newFeeToSetter = await feeBase.feeToSetter()
      newFeeToSetter.should.be.equal(sender)
    })
  })

  describe('#setFeeTo', () => {
    it('should work', async () => {
      await feeBase
        .setFeeTo(friend, { from: friend })
        .should.be.rejectedWith('Sender not authorized to update feeTo')

      await feeBase.setFeeTo(friend)
      let newFeeTo = await feeBase.feeTo()
      newFeeTo.should.be.equal(friend)

      await feeBase.setFeeTo(sender)
      newFeeTo = await feeBase.feeTo()
      newFeeTo.should.be.equal(sender)
    })
  })

  describe('#setFeeDivisor', () => {
    it('should work', async () => {
      await feeBase
        .setFeeDivisor(1, { from: friend })
        .should.be.rejectedWith('Sender not authorized to update feeDivisor')

      await feeBase.setFeeDivisor(100)
      let newFeeDivisor = await feeBase.feeDivisor()
      newFeeDivisor.should.be.eq.BN(100)

      await feeBase.setFeeDivisor(0)
      newFeeDivisor = await feeBase.feeDivisor()
      newFeeDivisor.should.be.eq.BN(0)
    })
  })

  describe('#hasFee', () => {
    it('should work', async () => {
      let hasFee = await feeBase.hasFee()
      hasFee.should.be.equal(false) // feeDivisor is 0

      await feeBase.setFeeTo('0x0000000000000000000000000000000000000000')
      hasFee = await feeBase.hasFee()
      hasFee.should.be.equal(false) // feeDivisor is 0 and feeTo is 0

      await feeBase.setFeeDivisor(1000)
      hasFee = await feeBase.hasFee()
      hasFee.should.be.equal(false) // feeTo is 0

      await feeBase.setFeeTo(sender)
      hasFee = await feeBase.hasFee()
      hasFee.should.be.equal(true)
    })
  })
})
