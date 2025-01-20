import type { Execution, OperationGetter, PaymasterGetter, SendOpResult } from '@/core'
import type { JsonRpcProvider } from 'ethers'

export abstract class SmartAccount implements OperationGetter {
	// OperationGetter
	abstract getSender(): Promise<string> | string
	abstract getNonce(): Promise<string> | string
	abstract getCallData(executions: Execution[]): Promise<string> | string
	abstract getDummySignature(): Promise<string> | string
	abstract getSignature(userOpHash: string): Promise<string> | string

	// static
	static accountId(): string {
		throw new Error('accountId is not implemented')
	}
	static async getNewAddress(client: JsonRpcProvider, creationOptions: any): Promise<string> {
		throw new Error('getNewAddress is not implemented')
	}

	abstract deploy(creationOptions: any, pmGetter?: PaymasterGetter): Promise<SendOpResult>
	abstract send(executions: Execution[], pmGetter?: PaymasterGetter): Promise<SendOpResult>
}
