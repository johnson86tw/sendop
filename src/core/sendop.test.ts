import { ECDSA_VALIDATOR_ADDRESS, ECDSAValidator, Kernel, PimlicoBundler } from '@/index'
import { hexlify, Interface, JsonRpcProvider, randomBytes, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS, COUNTER_ADDRESS, MyPaymaster, PimlicoPaymaster, setup } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { sendop } from './sendop'
import type { Bundler, ERC7579Validator, PaymasterGetter } from './types'

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
		signer = new Wallet(privateKey)
		client = new JsonRpcProvider(CLIENT_URL)
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

	it('should set number with pimlico paymaster', async () => {
		if (isLocal) {
			return
		}

		const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'
		logger.info(`FROM: ${FROM}`)

		const number = Math.floor(Math.random() * 10000)

		const kernel = new Kernel(FROM, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			erc7579Validator,
			pmGetter: new PimlicoPaymaster({
				chainId,
				url: BUNDLER_URL,
			}),
		})

		const op = await sendop({
			bundler,
			executions: [
				{
					to: COUNTER_ADDRESS,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: kernel,
			pmGetter: new PimlicoPaymaster({
				chainId,
				url: BUNDLER_URL,
			}),
		})

		const receipt = await op.wait()
		const log = receipt.logs[receipt.logs.length - 1]

		expect(toNumber(log.data)).toBe(number)
	}, 100000)

	it('should deploy Kernel', async () => {
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
