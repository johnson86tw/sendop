import type { Execution, ExecutionBuilder } from '@/core'
import type { AccountCreatingVendor, Validator, Vendor } from '@/types'
import { getEntryPointContract } from '@/utils/ethers'
import { JsonRpcProvider, toBeHex } from 'ethers'

export class ExecBuilder implements ExecutionBuilder {
	#client: JsonRpcProvider
	#vendor: Vendor | AccountCreatingVendor
	#validator: Validator
	#from: string

	constructor(options: { client: JsonRpcProvider; vendor: Vendor; validator: Validator; from: string }) {
		this.#client = options.client
		this.#vendor = options.vendor
		this.#validator = options.validator
		this.#from = options.from
	}

	async getInitCode() {
		if ('getInitCode' in this.#vendor) {
			return this.#vendor.getInitCode()
		}
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
