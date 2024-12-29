import { Interface, JsonRpcProvider, toBeHex, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR } from 'test/utils/addresses'
import { MyPaymaster } from 'test/utils/myPaymaster'
import { setup } from 'test/utils/setup'
import { beforeAll, describe, expect, it } from 'vitest'
import { RpcProvider } from '../rpc_provider'
import type { Execution, Validator, Vendor } from '../types'
import { getEntryPointContract } from '../utils/ethers'
import { ECDSAValidator } from '../validators/ecdsa_validator'
import { MyAccount } from '../vendors/my_account'
import type { Bundler, ExecutionBuilder, PaymasterBuilder } from './sendop'
import { ENTRY_POINT_V07, sendUserOp } from './sendop'
import type { UserOp, UserOpReceipt } from './types'

class PimlicoBundler implements Bundler {
	chainId: string
	url: string
	bundler: RpcProvider

	constructor(chainId: string, url: string) {
		this.chainId = chainId
		this.url = url
		this.bundler = new RpcProvider(url)
	}

	async getGasValues(userOp: UserOp) {
		const curGasPrice = await this.bundler.send({ method: 'pimlico_getUserOperationGasPrice' })
		// Note: user operation max fee per gas must be larger than 0 during gas estimation
		userOp.maxFeePerGas = curGasPrice.standard.maxFeePerGas
		const estimateGas = await this.bundler.send({
			method: 'eth_estimateUserOperationGas',
			params: [userOp, ENTRY_POINT_V07],
		})

		return {
			maxFeePerGas: userOp.maxFeePerGas,
			maxPriorityFeePerGas: curGasPrice.standard.maxPriorityFeePerGas,
			preVerificationGas: estimateGas.preVerificationGas,
			verificationGasLimit: estimateGas.verificationGasLimit,
			callGasLimit: estimateGas.callGasLimit,
			paymasterVerificationGasLimit: estimateGas.paymasterVerificationGasLimit,
			paymasterPostOpGasLimit: estimateGas.paymasterPostOpGasLimit,
		}
	}

	async sendUserOperation(userOp: UserOp): Promise<string> {
		return await this.bundler.send({
			method: 'eth_sendUserOperation',
			params: [userOp, ENTRY_POINT_V07],
		})
	}

	async getUserOperationReceipt(hash: string): Promise<UserOpReceipt> {
		return await this.bundler.send({ method: 'eth_getUserOperationReceipt', params: [hash] })
	}
}

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

class PmBuilder implements PaymasterBuilder {
	#chainId: string
	#clientUrl: string
	#paymasterAddress: string
	#pm: MyPaymaster

	constructor(options: { chainId: string; clientUrl: string; paymasterAddress: string }) {
		this.#chainId = options.chainId
		this.#clientUrl = options.clientUrl
		this.#paymasterAddress = options.paymasterAddress
		this.#pm = new MyPaymaster({
			chainId: this.#chainId,
			clientUrl: this.#clientUrl,
			paymasterAddress: this.#paymasterAddress,
		})
	}
	async getPaymasterStubData(userOp: UserOp) {
		return await this.#pm.getPaymasterStubData([userOp, ENTRY_POINT_V07, this.#chainId, {}])
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

		const op = await sendUserOp({
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
			pmBuilder: new PmBuilder({
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
