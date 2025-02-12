import { Wallet } from 'ethers'
import { describe, expect, it } from 'vitest'
import { RpcProvider } from './RpcProvider'
import { setup } from 'test/utils'
import { HttpError, JsonRpcError, SendopError } from './error'

const { BUNDLER_URL } = await setup()

describe('RpcProvider', () => {
	it('should be able to send a request', async () => {
		const provider = new RpcProvider(BUNDLER_URL)
		const result = await provider.send({
			method: 'eth_chainId',
			params: [],
		})
		expect(result).toBe('0x539')
	})

	it('should throw JsonRpcError if the request is invalid', async () => {
		const provider = new RpcProvider(BUNDLER_URL)
		await expect(provider.send({ method: 'invalid_method', params: [] })).rejects.toThrow(JsonRpcError)
	})

	it('should throw SendopError if the request url is invalid', async () => {
		const provider = new RpcProvider('invalid_url')
		await expect(provider.send({ method: 'eth_chainId', params: [] })).rejects.toThrow(
			new SendopError('fetch() URL is invalid'),
		)
	})
})
