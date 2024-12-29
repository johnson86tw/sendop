import type { TransactionReceipt } from 'ethers'

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
