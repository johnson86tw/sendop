import { Kernel } from '@/index'
import { setup } from 'test/utils'
import { describe, expect, it } from 'vitest'

const { logger, chainId } = await setup()

logger.info(`Chain ID: ${chainId}`)

describe('Smart Accounts', () => {
	describe('static methods', () => {
		it('should implement accountId', () => {
			expect(Kernel.accountId()).toBe('kernel.advanced.v0.3.1')
			// TODO: check MyAccount
		})
		it('should implement getNewAddress', async () => {
			// const newAddress = await Kernel.getNewAddress(client, {
			// 	salt: hexlify(randomBytes(32)),
			// 	validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			// 	owner: signer.address,
			// })
			// expect(newAddress).not.toBe(ZeroAddress)
		})
	})
})
