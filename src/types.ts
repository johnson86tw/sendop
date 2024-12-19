import type { JsonRpcProvider } from '@/utils/ethers'
import type { UserOp } from './utils/aa'

export type NetworkInfo = {
	chainId: string
	clientUrl: string
	bundlerUrl: string
}

export type Execution = {
	to: string
	data: string
	value: string
}

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

// =============================================== Paymaster ===============================================

export interface PaymasterProvider {
	getPaymasterStubData(params: GetPaymasterStubDataParams): Promise<GetPaymasterStubDataResult>
}

export type GetPaymasterStubDataParams = [
	UserOp, // userOp
	string, // EntryPoint
	string, // Chain ID
	Record<string, any>, // Context
]

export type GetPaymasterStubDataResult = {
	sponsor?: { name: string; icon?: string } // Sponsor info
	paymaster?: string // Paymaster address (entrypoint v0.7)
	paymasterData?: string // Paymaster data (entrypoint v0.7)
	paymasterVerificationGasLimit?: string // Paymaster validation gas (entrypoint v0.7)
	paymasterPostOpGasLimit?: string // Paymaster post-op gas (entrypoint v0.7)
	paymasterAndData?: string // Paymaster and data (entrypoint v0.6)
	isFinal?: boolean // Indicates that the caller does not need to call pm_getPaymasterData
}
