import type { Execution, OperationGetter, PaymasterGetter, SendOpResult, UserOp } from '@/core'
import { SendopError } from '@/error'
import type { JsonRpcProvider } from 'ethers'

export abstract class SmartAccount implements OperationGetter {
	// OperationGetter
	abstract getSender(): Promise<string> | string
	abstract getNonce(): Promise<string> | string
	abstract getCallData(executions: Execution[]): Promise<string> | string
	abstract getDummySignature(userOp: UserOp): Promise<string> | string
	abstract getSignature(userOpHash: Uint8Array, userOp: UserOp): Promise<string> | string

	// static
	static accountId(): string {
		throw new SmartAccountError('accountId is not implemented')
	}
	static async getNewAddress(client: JsonRpcProvider, creationOptions: any): Promise<string> {
		throw new SmartAccountError('getNewAddress is not implemented')
	}

	abstract deploy(creationOptions: any, pmGetter?: PaymasterGetter): Promise<SendOpResult>
	abstract send(executions: Execution[], pmGetter?: PaymasterGetter): Promise<SendOpResult>
}

export class SmartAccountError extends SendopError {
	constructor(message: string, cause?: Error) {
		super(message, cause)
		this.name = 'SmartAccountError'
	}
}
