import { type Bundler, type PaymasterBuilder } from '@/core'
import type { Validator } from '@/types'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { hexlify, Interface, JsonRpcProvider, randomBytes, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR, MyPaymaster, PimlicoBundler, setup } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { Kernel } from './kernel'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({
	chainId: '11155111',
})

logger.info(`Chain ID: ${chainId}`)

describe('Kernel', () => {
	let signer: Wallet
	let client: JsonRpcProvider
	let bundler: Bundler
	let validator: Validator
	let pmBuilder: PaymasterBuilder
	let kernel: Kernel
	const KERNEL_ADDRESS = '0x41f88637a749c815a31fe2867fbdf59af7b2fceb'

	beforeAll(() => {
		signer = new Wallet(PRIVATE_KEY)
		client = new JsonRpcProvider(CLIENT_URL)
		bundler = new PimlicoBundler(chainId, BUNDLER_URL)
		validator = new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			clientUrl: CLIENT_URL,
			signer: new Wallet(PRIVATE_KEY),
		})
		pmBuilder = new MyPaymaster({
			chainId,
			clientUrl: CLIENT_URL,
			paymasterAddress: CHARITY_PAYMASTER,
		})

		kernel = new Kernel({ client, bundler, address: KERNEL_ADDRESS, validator, pmBuilder })
		logger.info(`Kernel: ${kernel.address}`)
		logger.info(`Signer: ${signer.address}`)
	})

	describe('private getInitializeData', () => {
		it('should return correct initialization data', async () => {
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'

			const data = (kernel as any).getInitializeData(validatorAddress, owner)

			expect(typeof data).toBe('string')
			expect(data.startsWith('0x')).toBe(true)
		})

		it('should throw error for invalid addresses', () => {
			const invalidAddress = '0x123' // Invalid address

			expect(() => {
				;(kernel as any).getInitializeData(invalidAddress, invalidAddress)
			}).toThrow('Invalid address')
		})
	})

	describe('private getCreateAccountData', () => {
		it('should return correct create account data', async () => {
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'
			const salt = hexlify(randomBytes(32))

			const data = (kernel as any).getCreateAccountData(validatorAddress, owner, salt)

			expect(typeof data).toBe('string')
			expect(data.startsWith('0x')).toBe(true)
		})

		it('should throw error for invalid addresses or salt', () => {
			const invalidAddress = '0x123'
			let salt = '0x12345678901234567890123456789012345678901234567890123456789012345678910'

			expect(() => {
				;(kernel as any).getCreateAccountData(invalidAddress, invalidAddress, salt)
			}).toThrow('Salt should be 32 bytes')

			salt = hexlify(randomBytes(32))

			expect(() => {
				;(kernel as any).getCreateAccountData(invalidAddress, invalidAddress, salt)
			}).toThrow('Invalid address')
		})
	})

	describe('getAddress', () => {
		it('should not return zero address', async () => {
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'
			const salt = hexlify(randomBytes(32))

			const address = await kernel.getNewAddress({ salt, validatorAddress, owner })
			expect(address).not.toBe('0x0000000000000000000000000000000000000000')
		})
	})

	describe('Operations by Kernel', () => {
		it('should deploy the contract', async () => {
			const creationOptions = {
				salt: hexlify(randomBytes(32)),
				validatorAddress: ECDSA_VALIDATOR,
				owner: signer.address,
			}

			const kernel = new Kernel({
				client,
				bundler,
				address: KERNEL_ADDRESS,
				validator,
				pmBuilder,
				creationOptions,
			})
			const deployedAddress = await kernel.getNewAddress(creationOptions)
			const op = await kernel.deploy()
			logger.info(`hash: ${op.hash}`)
			await op.wait()

			const code = await client.getCode(deployedAddress)
			expect(code).not.toBe('0x')
		}, 100_000)

		it('should setNumber', async () => {
			const number = 100
			const op = await kernel.send([
				{
					to: COUNTER,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			])
			const receipt = await op.wait()
			const log = receipt.logs[receipt.logs.length - 1]
			expect(toNumber(log.data)).toBe(number)
		}, 100_000)
	})
})
