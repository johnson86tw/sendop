import { Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR } from 'test/utils/addresses'
import { PimlicoBundler } from 'test/utils/bundler'
import { ExecBuilder } from 'test/utils/exec_builders'
import { MyPaymaster, PimlicoPaymaster } from 'test/utils/pm_builders'
import { setup } from 'test/utils/setup'
import { beforeAll, describe, expect, it } from 'vitest'
import { ECDSAValidator } from '../validators/ecdsa_validator'
import { MyAccount } from '../vendors/my_account'
import { sendop } from './sendop'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({
	chainId: '11155111',
})

logger.info(`Chain ID: ${chainId}`)

describe('sendop', () => {
	let signer: Wallet

	beforeAll(() => {
		signer = new Wallet(PRIVATE_KEY)
		logger.info(`Signer: ${signer.address}`)
	})

	it('should set number with charity paymaster', async () => {
		const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'
		logger.info(`FROM: ${FROM}`)
		const bundler = new PimlicoBundler(chainId, BUNDLER_URL)

		const number = Math.floor(Math.random() * 10000)

		const op = await sendop({
			bundler,
			from: FROM,
			executions: [
				{
					to: COUNTER,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			execBuilder: new ExecBuilder({
				client: new JsonRpcProvider(CLIENT_URL),
				vendor: new MyAccount(),
				validator: new ECDSAValidator({
					address: ECDSA_VALIDATOR,
					clientUrl: CLIENT_URL,
					signer,
				}),
				from: FROM,
			}),
			pmBuilder: new MyPaymaster({
				chainId,
				clientUrl: CLIENT_URL,
				paymasterAddress: CHARITY_PAYMASTER,
			}),
		})

		const receipt = await op.wait()
		const log = receipt.logs[receipt.logs.length - 1]

		expect(toNumber(log.data)).toBe(number)
	}, 100000)

	it('should set number with pimlico paymaster', async () => {
		const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'
		logger.info(`FROM: ${FROM}`)
		const bundler = new PimlicoBundler(chainId, BUNDLER_URL)

		const number = Math.floor(Math.random() * 10000)

		const op = await sendop({
			bundler,
			from: FROM,
			executions: [
				{
					to: COUNTER,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			execBuilder: new ExecBuilder({
				client: new JsonRpcProvider(CLIENT_URL),
				vendor: new MyAccount(),
				validator: new ECDSAValidator({
					address: ECDSA_VALIDATOR,
					clientUrl: CLIENT_URL,
					signer,
				}),
				from: FROM,
			}),
			pmBuilder: new PimlicoPaymaster({
				chainId,
				url: BUNDLER_URL,
			}),
		})

		const receipt = await op.wait()
		const log = receipt.logs[receipt.logs.length - 1]

		expect(toNumber(log.data)).toBe(number)
	}, 100000)
})
