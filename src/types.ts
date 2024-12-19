import type { JsonRpcProvider } from 'ethers'

export abstract class AccountVendor {
	static readonly accountId: string
	abstract getNonceKey(validator: string): Promise<string>
	abstract getCallData(from: string, executions: Execution[]): Promise<string>
	abstract getAddress(provider: JsonRpcProvider, ...args: any[]): Promise<string>
	abstract getInitCodeData(...args: any[]): {
		factory: string
		factoryData: string
	}
	abstract getInstallModuleInitData(...args: any[]): Promise<string>
	abstract getUninstallModuleDeInitData(...args: any[]): Promise<string>
}

export interface AccountValidator {
	address(): string
	getDummySignature(): string
	getSignature(userOpHash: string): Promise<string>
	getAccounts(): Promise<string[]>
}

export type RpcRequestArguments = {
	readonly method: string
	readonly params?: readonly unknown[] | object
}

export type Execution = {
	to: string
	data: string
	value: string
}
