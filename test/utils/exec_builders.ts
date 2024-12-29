import type { Execution, ExecutionBuilder } from '@/core'
import type { AccountCreatingVendor, ERC7579Vendor, Validator, Vendor } from '@/types'
import { getEntryPointContract } from '@/utils/ethers'
import { JsonRpcProvider, toBeHex } from 'ethers'

export class ExecBuilder implements ExecutionBuilder {
	#client: JsonRpcProvider
	#vendor: Vendor | ERC7579Vendor | AccountCreatingVendor
	#validator: Validator
	#from: string
	#isCreation: boolean

	constructor(options: {
		client: JsonRpcProvider
		vendor: Vendor | ERC7579Vendor | AccountCreatingVendor
		validator: Validator
		from: string
		isCreation?: boolean
	}) {
		this.#client = options.client
		this.#vendor = options.vendor
		this.#validator = options.validator
		this.#from = options.from
		this.#isCreation = options.isCreation ?? false
	}

	async getInitCode() {
		if (this.#isCreation && 'getInitCode' in this.#vendor) {
			return await this.#vendor.getInitCode()
		}
		return '0x'
	}

	async getNonce() {
		const nonceKey = await this.#vendor.getNonceKey(await this.#validator.address())
		const nonce: bigint = await getEntryPointContract(this.#client).getNonce(this.#from, nonceKey)
		return toBeHex(nonce)
	}

	async getCallData(executions: Execution[]) {
		return await this.#vendor.getCallData(this.#from, executions)
	}

	async getDummySignature() {
		return await this.#validator.getDummySignature()
	}

	async getSignature(userOpHash: string) {
		return await this.#validator.getSignature(userOpHash)
	}
}
