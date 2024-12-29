import type { Execution, ExecutionBuilder, PaymasterBuilder, UserOp, GetPaymasterStubDataResult } from '@/core'
import type { Validator, Vendor } from '@/types'
import { Contract, JsonRpcProvider, toBeHex } from 'ethers'
import { getEntryPointContract } from '@/utils/ethers'
import { CHARITY_PAYMASTER } from './addresses'

const CHARITY_PAYMASTER_ADDRESS = CHARITY_PAYMASTER

export class ExecBuilder implements ExecutionBuilder {
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

export class MyPaymaster implements PaymasterBuilder {
	chainId: string
	clientUrl: string
	#client: JsonRpcProvider
	#paymasterAddress: string
	#paymaster: Contract

	constructor(options: { chainId: string; clientUrl: string; paymasterAddress: string }) {
		this.chainId = options.chainId
		this.clientUrl = options.clientUrl
		this.#client = new JsonRpcProvider(options.clientUrl)
		this.#paymasterAddress = options.paymasterAddress
		this.#paymaster = new Contract(
			this.#paymasterAddress,
			['function isAllowed(address _address) public view returns (bool)'],
			this.#client,
		)
	}

	async getPaymasterStubData(userOp: UserOp): Promise<GetPaymasterStubDataResult> {
		if (this.#paymasterAddress === CHARITY_PAYMASTER_ADDRESS) {
			return {
				sponsor: {
					name: 'My Wallet',
				},
				paymaster: this.#paymasterAddress,
				paymasterData: '0x',
				paymasterVerificationGasLimit: toBeHex(999_999n),
				paymasterPostOpGasLimit: toBeHex(999_999n),
				isFinal: true,
			}
		}

		// check sender is in allowlist
		const isAllowed = await this.#paymaster.isAllowed(userOp.sender)
		if (!isAllowed) {
			throw new Error('Sender is not in allowlist')
		}

		return {
			sponsor: {
				name: 'My Wallet',
			},
			paymaster: this.#paymasterAddress,
			paymasterData: '0x',
			paymasterVerificationGasLimit: toBeHex(999_999n),
			paymasterPostOpGasLimit: toBeHex(999_999n),
			isFinal: true,
		}
	}
}
