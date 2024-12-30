import { hexlify, randomBytes, JsonRpcProvider, Wallet } from 'ethers'
import { setup, CHARITY_PAYMASTER, ECDSA_VALIDATOR, PimlicoBundler, OpBuilder, MyPaymaster } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { Kernel } from './kernel'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { sendop } from '..'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({
	chainId: '11155111',
})

logger.info(`Chain ID: ${chainId}`)

describe('Kernel', () => {
	let signer: Wallet
	let client: JsonRpcProvider

	beforeAll(() => {
		signer = new Wallet(PRIVATE_KEY)
		client = new JsonRpcProvider(CLIENT_URL)
		logger.info(`Signer: ${signer.address}`)
	})

	describe('private getInitializeData', () => {
		it('should return correct initialization data', async () => {
			const kernel = new Kernel()
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'

			const data = (kernel as any).getInitializeData(validatorAddress, owner)

			expect(typeof data).toBe('string')
			expect(data.startsWith('0x')).toBe(true)
		})

		it('should throw error for invalid addresses', () => {
			const kernel = new Kernel()
			const invalidAddress = '0x123' // Invalid address

			expect(() => {
				;(kernel as any).getInitializeData(invalidAddress, invalidAddress)
			}).toThrow('Invalid address')
		})
	})

	describe('private getCreateAccountData', () => {
		it('should return correct create account data', async () => {
			const kernel = new Kernel()
			const validatorAddress = '0xd577C0746c19DeB788c0D698EcAf66721DC2F7A4'
			const owner = '0xd78B5013757Ea4A7841811eF770711e6248dC282'
			const salt = hexlify(randomBytes(32))

			const data = (kernel as any).getCreateAccountData(validatorAddress, owner, salt)

			expect(typeof data).toBe('string')
			expect(data.startsWith('0x')).toBe(true)
		})

		it('should throw error for invalid addresses or salt', () => {
			const kernel = new Kernel()
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

			const kernel = new Kernel(CLIENT_URL, {
				salt,
				validatorAddress,
				owner,
			})

			const address = await kernel.getAddress()
			expect(address).not.toBe('0x0000000000000000000000000000000000000000')
		})
	})

	describe('deploy', () => {
		it('should deploy Kernel', async () => {
			const creationOptions = {
				salt: hexlify(randomBytes(32)),
				validatorAddress: ECDSA_VALIDATOR,
				owner: signer.address,
			}
			const vendor = new Kernel(CLIENT_URL, creationOptions)
			const deployedAddress = await vendor.getAddress()
			const FROM = deployedAddress

			const op = await sendop({
				bundler: new PimlicoBundler(chainId, BUNDLER_URL),
				from: FROM,
				executions: [],
				opBuilder: new OpBuilder({
					client,
					vendor,
					validator: new ECDSAValidator({
						address: ECDSA_VALIDATOR,
						clientUrl: CLIENT_URL,
						signer: new Wallet(PRIVATE_KEY),
					}),
					from: FROM,
					isCreation: true,
				}),
				pmBuilder: new MyPaymaster({
					chainId,
					clientUrl: CLIENT_URL,
					paymasterAddress: CHARITY_PAYMASTER,
				}),
			})
			logger.info(`hash: ${op.hash}`)
			await op.wait()
			const code = await client.getCode(deployedAddress)
			expect(code).not.toBe('0x')
		}, 100_000)
	})
})
