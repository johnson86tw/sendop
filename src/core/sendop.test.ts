import { type Execution } from '@/core'
import { Interface, JsonRpcProvider, toBeHex, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR } from 'test/utils/addresses'
import { MyPaymaster } from 'test/utils/builders'
import { PimlicoBundler } from 'test/utils/bundler'
import { setup } from 'test/utils/setup'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Validator, Vendor } from '../types'
import { getEntryPointContract } from '../utils/ethers'
import { ECDSAValidator } from '../validators/ecdsa_validator'
import { MyAccount } from '../vendors/my_account'
import type { ExecutionBuilder } from './sendop'
import { sendop } from './sendop'

class ExecBuilder implements ExecutionBuilder {
	#client: JsonRpcProvider
	#vendor: Vendor
	#validator: Validator
	#from: string

	constructor(options: { client: JsonRpcProvider; vendor: Vendor; validator: Validator; from: string }) {
		this.#client = options.client
		this.#vendor = options.vendor
		this.#validator = options.validator
		this.#from = options.from
	}

	async getInitCode() {
		return null
	}

	async getNonce() {
		const nonceKey = await this.#vendor.getNonceKey(this.#validator.address())
		const nonce: bigint = await getEntryPointContract(this.#client).getNonce(this.#from, nonceKey)
		return toBeHex(nonce)
	}

	async getCallData(executions: Execution[]) {
		return await this.#vendor.getCallData(this.#from, executions)
	}

	async getDummySignature() {
		return this.#validator.getDummySignature()
	}

	async getSignature(userOpHash: string) {
		return await this.#validator.getSignature(userOpHash)
	}
}

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()
logger.info(`Chain ID: ${chainId}`)

describe('sendop', () => {
	let signer: Wallet

	beforeAll(() => {
		signer = new Wallet(PRIVATE_KEY)
		logger.info(`Signer: ${signer.address}`)
	})

	it('should set number', async () => {
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
})
