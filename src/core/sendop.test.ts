import { MyPaymaster, PimlicoBundler, PimlicoPaymaster } from '@/index'
import { hexlify, Interface, JsonRpcProvider, randomBytes, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR, setup } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { ECDSAValidator } from '../validators/ecdsa_validator'
import { MyAccount } from '../smart_accounts/my_account'
import { sendop } from './sendop'
import type { Bundler, ERC7579Validator, PaymasterGetter } from './types'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({
	chainId: '11155111',
})

logger.info(`Chain ID: ${chainId}`)

describe('sendop', () => {
	let signer: Wallet
	let client: JsonRpcProvider
	let bundler: Bundler
	let pmGetter: PaymasterGetter
	let erc7579Validator: ERC7579Validator

	beforeAll(() => {
		signer = new Wallet(PRIVATE_KEY)
		client = new JsonRpcProvider(CLIENT_URL)
		bundler = new PimlicoBundler(chainId, BUNDLER_URL)
		pmGetter = new MyPaymaster({
			client,
			paymasterAddress: CHARITY_PAYMASTER,
		})
		erc7579Validator = new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			client,
			signer,
		})
		logger.info(`Signer: ${signer.address}`)
	})

	it('should set number with charity paymaster', async () => {
		const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'
		logger.info(`FROM: ${FROM}`)
		const number = Math.floor(Math.random() * 10000)

		const op = await sendop({
			bundler,
			executions: [
				{
					to: COUNTER,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: new MyAccount(FROM, {
				client: new JsonRpcProvider(CLIENT_URL),
				bundler: new PimlicoBundler(chainId, BUNDLER_URL),
				erc7579Validator,
			}),
			pmGetter,
		})

		const receipt = await op.wait()
		const log = receipt.logs[receipt.logs.length - 1]

		expect(toNumber(log.data)).toBe(number)
	}, 100_000)

	it('should set number with pimlico paymaster', async () => {
		const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'
		logger.info(`FROM: ${FROM}`)

		const number = Math.floor(Math.random() * 10000)

		const op = await sendop({
			bundler,
			executions: [
				{
					to: COUNTER,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: new MyAccount(FROM, {
				client: new JsonRpcProvider(CLIENT_URL),
				bundler: new PimlicoBundler(chainId, BUNDLER_URL),
				erc7579Validator,
			}),
			pmGetter: new PimlicoPaymaster({
				chainId,
				url: BUNDLER_URL,
			}),
		})

		const receipt = await op.wait()
		const log = receipt.logs[receipt.logs.length - 1]

		expect(toNumber(log.data)).toBe(number)
	}, 100000)

	it('should deploy MyAccount', async () => {
		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR,
			owner: await new Wallet(PRIVATE_KEY).getAddress(),
		}

		const deployedAddress = await MyAccount.getNewAddress(client, creationOptions)

		const myAccount = new MyAccount(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			erc7579Validator,
		})

		const op = await sendop({
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			executions: [],
			opGetter: myAccount,
			pmGetter,
			initCode: MyAccount.getInitCode(creationOptions),
		})
		logger.info(`hash: ${op.hash}`)
		await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')
	}, 100_000)

	it('should deploy MyAccount and set number in one user operation', async () => {
		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR,
			owner: await new Wallet(PRIVATE_KEY).getAddress(),
		}
		const deployedAddress = await MyAccount.getNewAddress(client, creationOptions)

		const myAccount = new MyAccount(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			erc7579Validator,
		})

		const number = Math.floor(Math.random() * 10000)

		const op = await sendop({
			bundler: new PimlicoBundler(chainId, BUNDLER_URL),
			executions: [
				{
					to: COUNTER,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: myAccount,
			pmGetter: new MyPaymaster({
				client,
				paymasterAddress: CHARITY_PAYMASTER,
			}),
			initCode: MyAccount.getInitCode(creationOptions),
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
