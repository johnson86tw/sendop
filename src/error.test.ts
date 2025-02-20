import { describe, expect, it } from 'vitest'
import { RpcProvider } from './RpcProvider'
import { setup } from 'test/utils'
import { PACKAGE_VERSION, SendopError } from './error'

const { BUNDLER_URL } = await setup()

describe('Error', () => {
	it('should contain sendop version in error message', async () => {
		const provider = new RpcProvider(BUNDLER_URL)
		let result
		try {
			await provider.send({
				method: 'invalid_method',
				params: [],
			})
		} catch (err: unknown) {
			if (err instanceof SendopError) {
				result = err.message
			} else {
				throw err
			}
		}
		expect(result).toContain(`(sendop@${PACKAGE_VERSION})`)
	})

	// TODO:
	it.skip('pimlico', () => {
		const errMsg = 'eth_sendUserOperation (-32500): UserOperation reverted with reason: AA23 reverted - 0x85e4d8d6'
		// 0x85e4d8d6 == SubmissionNotClaimable()
	})
})
