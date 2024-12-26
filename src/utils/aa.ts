import { ENTRY_POINT_V07 } from '@/constant'
import { concat, keccak256, toBeHex, TransactionReceipt, zeroPadValue, abiEncode } from '@/utils/ethers'

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

export type UserOp = {
	sender: string
	nonce: string
	factory: string | null
	factoryData: string
	callData: string
	callGasLimit: string
	verificationGasLimit: string
	preVerificationGas: string
	maxFeePerGas: string
	maxPriorityFeePerGas: string
	paymaster: string | null
	paymasterVerificationGasLimit: string
	paymasterPostOpGasLimit: string
	paymasterData: string | null
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

export function getEmptyUserOp(): UserOp {
	return {
		sender: '',
		nonce: '0x',
		factory: null,
		factoryData: '0x',
		callData: '0x',
		callGasLimit: '0x0',
		verificationGasLimit: '0x0',
		preVerificationGas: '0x0',
		maxFeePerGas: '0x0',
		maxPriorityFeePerGas: '0x0',
		paymaster: null,
		paymasterVerificationGasLimit: '0x0',
		paymasterPostOpGasLimit: '0x0',
		paymasterData: null,
		signature: '0x',
	}
}

export function packUserOp(userOp: UserOp): PackedUserOp {
	return {
		sender: userOp.sender,
		nonce: userOp.nonce,
		initCode: userOp.factory && userOp.factoryData ? concat([userOp.factory, userOp.factoryData]) : '0x',
		callData: userOp.callData,
		accountGasLimits: concat([
			zeroPadValue(toBeHex(userOp.verificationGasLimit), 16),
			zeroPadValue(toBeHex(userOp.callGasLimit), 16),
		]),
		preVerificationGas: zeroPadValue(toBeHex(userOp.preVerificationGas), 32),
		gasFees: concat([
			zeroPadValue(toBeHex(userOp.maxPriorityFeePerGas), 16),
			zeroPadValue(toBeHex(userOp.maxFeePerGas), 16),
		]),
		paymasterAndData:
			userOp.paymaster && userOp.paymasterData
				? concat([
						userOp.paymaster,
						zeroPadValue(toBeHex(userOp.paymasterVerificationGasLimit), 16),
						zeroPadValue(toBeHex(userOp.paymasterPostOpGasLimit), 16),
						userOp.paymasterData,
				  ])
				: '0x',
		signature: userOp.signature,
	}
}

export function getUserOpHash(chainId: string, op: PackedUserOp): string {
	const hashedInitCode = keccak256(op.initCode)
	const hashedCallData = keccak256(op.callData)
	const hashedPaymasterAndData = keccak256(op.paymasterAndData)
	const encoded = abiEncode(
		['bytes32', 'address', 'uint256'],
		[
			keccak256(
				abiEncode(
					['address', 'uint256', 'bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32', 'bytes32'],
					[
						op.sender,
						op.nonce,
						hashedInitCode,
						hashedCallData,
						op.accountGasLimits,
						op.preVerificationGas,
						op.gasFees,
						hashedPaymasterAndData,
					],
				),
			),
			ENTRY_POINT_V07,
			BigInt(chainId),
		],
	)
	return keccak256(encoded)
}
