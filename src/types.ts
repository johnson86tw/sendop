import type { JsonRpcProvider } from 'ethers'
import type { UserOp } from '@/core'
import type { Execution } from '@/core'

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

export type PaymasterSource = PaymasterProvider | string

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
