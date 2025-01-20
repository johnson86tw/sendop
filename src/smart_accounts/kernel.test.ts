import { type Bundler, type ERC7579Validator, type PaymasterGetter } from '@/core'
import { ECDSAValidator, Kernel, MyPaymaster, PimlicoBundler } from '@/index'
import { hexlify, Interface, JsonRpcProvider, randomBytes, toNumber, Wallet, ZeroAddress } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR, setup } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({
	chainId: '11155111',
})

logger.info(`Chain ID: ${chainId}`)

describe('Kernel', () => {
	let signer: Wallet
	let client: JsonRpcProvider
	let bundler: Bundler
	let erc7579Validator: ERC7579Validator
	let pmGetter: PaymasterGetter
	let kernel: Kernel
	const KERNEL_ADDRESS = '0x41f88637a749c815a31fe2867fbdf59af7b2fceb'

	beforeAll(() => {
		signer = new Wallet(PRIVATE_KEY)
		client = new JsonRpcProvider(CLIENT_URL)
		bundler = new PimlicoBundler(chainId, BUNDLER_URL)
		erc7579Validator = new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			client,
			signer: new Wallet(PRIVATE_KEY),
		})
		pmGetter = new MyPaymaster({
			client,
			paymasterAddress: CHARITY_PAYMASTER,
		})

		kernel = new Kernel(KERNEL_ADDRESS, {
			client,
			bundler,
			erc7579Validator,
			pmGetter,
		})
		logger.info(`Signer: ${signer.address}`)
	})

	describe('static methods', () => {
		it('should get accountId', () => {
			expect(Kernel.accountId()).toBe('kernel.advanced.v0.3.1')
		})
		it('should getNewAddress', async () => {
			const newAddress = await Kernel.getNewAddress(client, {
				salt: hexlify(randomBytes(32)),
				validatorAddress: ECDSA_VALIDATOR,
				owner: signer.address,
			})
			expect(newAddress).not.toBe(ZeroAddress)
		})
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

			const address = await Kernel.getNewAddress(client, { salt, validatorAddress, owner })
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

			const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

			const kernel = new Kernel(deployedAddress, {
				client,
				bundler,
				erc7579Validator,
				pmGetter,
			})

			const op = await kernel.deploy(creationOptions)
			logger.info(`hash: ${op.hash}`)
			await op.wait()
			logger.info('deployed address: ', deployedAddress)

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
