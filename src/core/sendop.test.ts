import { hexlify, Interface, JsonRpcProvider, parseEther, randomBytes, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS, COUNTER_ADDRESS, MyPaymaster, PimlicoPaymaster, setup } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { sendop } from './sendop'
import type { Bundler, ERC7579Validator, PaymasterGetter } from './types'
import { PimlicoBundler } from '@/bundler'
import { ECDSAValidator } from '@/validators'
import { ECDSA_VALIDATOR_ADDRESS } from '@/address'
import { Kernel } from '@/smart_accounts'
import { getEntryPointContract } from '@/utils'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, privateKey, isLocal } = await setup()

logger.info(`Chain ID: ${chainId}`)

describe('sendop', () => {
	let signer: Wallet
	let client: JsonRpcProvider
	let bundler: Bundler
	let pmGetter: PaymasterGetter
	let erc7579Validator: ERC7579Validator

	let creationOptions: {
		salt: string
		validatorAddress: string
		owner: string
	}

	beforeAll(() => {
		client = new JsonRpcProvider(CLIENT_URL)
		signer = new Wallet(privateKey, client)
		bundler = new PimlicoBundler(chainId, BUNDLER_URL)
		pmGetter = new MyPaymaster({
			client,
			paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
		})
		erc7579Validator = new ECDSAValidator({
			address: ECDSA_VALIDATOR_ADDRESS,
			client,
			signer,
		})
		creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: signer.address,
		}

		logger.info(`Signer: ${signer.address}`)
	})

	// TODO: fix this test
	it.skip('cannot pay prefund for kernel deployment when estimateUserOperationGas with reason: AA13 initCode failed or OOG', async () => {
		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await new Wallet(privateKey).getAddress(),
		}

		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			erc7579Validator,
		})

		// deposit 1 eth to entrypoint for kernel deployment
		const entrypoint = getEntryPointContract(signer)
		const tx = await entrypoint.depositTo(deployedAddress, { value: parseEther('1') })
		await tx.wait()

		// check balance of deployed address
		const balance = await entrypoint.balanceOf(deployedAddress)
		expect(balance).toBe(parseEther('1'))

		const op = await sendop({
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			executions: [],
			opGetter: kernel,
			initCode: kernel.getInitCode(creationOptions),
		})

		logger.info(`hash: ${op.hash}`)
		await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')
	}, 100_000)

	it('should deploy Kernel with charity paymaster', async () => {
		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await new Wallet(privateKey).getAddress(),
		}

		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			erc7579Validator,
			pmGetter,
		})

		const op = await sendop({
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			executions: [],
			opGetter: kernel,
			pmGetter,
			initCode: kernel.getInitCode(creationOptions),
		})
		logger.info(`hash: ${op.hash}`)
		await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')
	}, 100_000)

	it('should deploy Kernel with charity paymaster and set number without paymaster', async () => {
		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await new Wallet(privateKey).getAddress(),
		}

		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			erc7579Validator,
			pmGetter,
		})

		const op = await sendop({
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			executions: [],
			opGetter: kernel,
			pmGetter,
			initCode: kernel.getInitCode(creationOptions),
		})
		logger.info(`hash: ${op.hash}`)
		await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')

		// set number without paymaster
		const number = Math.floor(Math.random() * 10000)

		// deposit 1 eth to entrypoint for kernel deployment
		const entrypoint = getEntryPointContract(signer)
		const tx = await entrypoint.depositTo(deployedAddress, { value: parseEther('1') })
		await tx.wait()

		// check balance of deployed address
		const balance = await entrypoint.balanceOf(deployedAddress)
		expect(balance).toBe(parseEther('1'))

		const op2 = await sendop({
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			executions: [
				{
					to: COUNTER_ADDRESS,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: kernel,
		})

		logger.info(`hash: ${op2.hash}`)
		const receipt = await op2.wait()
		logger.info('deployed address: ', deployedAddress)

		const log = receipt.logs[receipt.logs.length - 1]
		expect(toNumber(log.data)).toBe(number)
	}, 100_000)

	it('should deploy Kernel and set number in one user operation', async () => {
		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await new Wallet(privateKey).getAddress(),
		}
		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			erc7579Validator,
			pmGetter,
		})

		const number = Math.floor(Math.random() * 10000)

		const op = await sendop({
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			executions: [
				{
					to: COUNTER_ADDRESS,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: kernel,
			pmGetter: new MyPaymaster({
				client,
				paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
			}),
			initCode: kernel.getInitCode(creationOptions),
		})

		logger.info(`hash: ${op.hash}`)
		const receipt = await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')
		const log = receipt.logs[receipt.logs.length - 1]
		expect(toNumber(log.data)).toBe(number)
	}, 100_000)
})
