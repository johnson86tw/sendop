import type { Execution } from '@/core'
import type { JsonRpcProvider } from 'ethers'

export type NetworkInfo = {
	chainId: string
	clientUrl: string
	bundlerUrl: string
}

export interface Vendor {
	accountId(): string
	getNonceKey(validator: string): Promise<string>
	getCallData(from: string, executions: Execution[]): Promise<string>

	getInstallModuleInitData?(...args: any[]): Promise<string>
	getUninstallModuleDeInitData?(...args: any[]): Promise<string>
}

export interface AccountCreatingVendor extends Vendor {
	getAddress(provider: JsonRpcProvider, ...args: any[]): Promise<string>
	getInitCode(...args: any[]): string
}

export interface Validator {
	address(): string
	getDummySignature(): string
	getSignature(userOpHash: string): Promise<string>
}

export interface AccountRequestingValidator extends Validator {
	requestAccounts(): Promise<string[]>
}
