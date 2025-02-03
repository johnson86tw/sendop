import type { TransactionReceipt } from 'ethers'

// ========================================== interfaces ==========================================

export interface Bundler {
	chainId: string
	getGasValues(userOp: UserOp): Promise<{
		maxFeePerGas: string
		maxPriorityFeePerGas: string
		preVerificationGas: string
		verificationGasLimit: string
		callGasLimit: string
		paymasterVerificationGasLimit: string
		paymasterPostOpGasLimit: string
	}>
	sendUserOperation(userOp: UserOp): Promise<string>
	getUserOperationReceipt(hash: string): Promise<UserOpReceipt>
}

export interface OperationGetter extends AccountGetter, SignatureGetter {}

export interface AccountGetter {
	getSender(): Promise<string> | string
	getNonce(): Promise<string> | string
	getCallData(executions: Execution[]): Promise<string> | string
}

export interface SignatureGetter {
	getDummySignature(): Promise<string> | string
	getSignature(userOpHash: Uint8Array): Promise<string> | string
}

export interface ERC7579Validator extends SignatureGetter {
	address(): string
}

/**
 * refer to ERC-7677
 */
export interface PaymasterGetter {
	getPaymasterStubData(userOp: UserOp): Promise<GetPaymasterStubDataResult> | GetPaymasterStubDataResult
	getPaymasterData?(userOp: UserOp): Promise<GetPaymasterDataResult> | GetPaymasterDataResult
}

// ========================================== types ==========================================

export type Execution = {
	to: string
	data: string
	value: string
}

export type GetPaymasterStubDataResult = {
	sponsor?: { name: string; icon?: string } // Sponsor info
	paymaster?: string // Paymaster address (entrypoint v0.7)
	paymasterData?: string // Paymaster data (entrypoint v0.7)
	paymasterVerificationGasLimit?: string // Paymaster validation gas (entrypoint v0.7)
	paymasterPostOpGasLimit?: string // Paymaster post-op gas (entrypoint v0.7)
	isFinal?: boolean // Indicates that the caller does not need to call pm_getPaymasterData
}

export type GetPaymasterDataResult = {
	paymaster?: string // Paymaster address (entrypoint v0.7)
	paymasterData?: string // Paymaster data (entrypoint v0.7)
}

export type UserOp = {
	sender: string
	nonce: string
	factory: string | null
	factoryData: string | '0x'
	callData: string
	callGasLimit: string | '0x0'
	verificationGasLimit: string | '0x0'
	preVerificationGas: string | '0x0'
	maxFeePerGas: string | '0x0'
	maxPriorityFeePerGas: string | '0x0'
	paymaster: string | null
	paymasterVerificationGasLimit: string | '0x0'
	paymasterPostOpGasLimit: string | '0x0'
	paymasterData: string | '0x'
	signature: string | '0x'
}

export type PackedUserOp = {
	sender: string
	nonce: string
	initCode: string
	callData: string
	accountGasLimits: string
	preVerificationGas: string
	gasFees: string
	paymasterAndData: string
	signature: string
}

export type UserOpLog = {
	logIndex: string
	transactionIndex: string
	transactionHash: string
	blockHash: string
	blockNumber: string
	address: string
	data: string
	topics: string[]
}

export type UserOpReceipt = {
	userOpHash: string
	entryPoint: string
	sender: string
	nonce: string
	paymaster: string
	actualGasUsed: string
	actualGasCost: string
	success: boolean
	logs: UserOpLog[]
	receipt: TransactionReceipt
}

export type SendOpResult = {
	hash: string
	wait(): Promise<UserOpReceipt>
}
