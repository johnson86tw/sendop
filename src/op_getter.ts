import type { AccountGetter, Execution, OperationGetter, SignatureGetter } from '@/core'

export class OpGetter implements OperationGetter {
	#accountGetter: AccountGetter
	#signatureGetter: SignatureGetter

	constructor(accountGetter: AccountGetter, signatureGetter: SignatureGetter) {
		this.#accountGetter = accountGetter
		this.#signatureGetter = signatureGetter
	}

	async getSender() {
		return await this.#accountGetter.getSender()
	}

	async getNonce() {
		return await this.#accountGetter.getNonce()
	}

	async getCallData(executions: Execution[]) {
		return await this.#accountGetter.getCallData(executions)
	}

	async getDummySignature() {
		return await this.#signatureGetter.getDummySignature()
	}

	async getSignature(userOpHash: string) {
		return await this.#signatureGetter.getSignature(userOpHash)
	}
}
