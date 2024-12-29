import { AbiCoder, concat, keccak256, toBeHex, zeroPadValue } from 'ethers'
import type { PackedUserOp, UserOp, UserOpReceipt } from './types'

export const ENTRY_POINT_V07 = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

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

export interface ExecutionBuilder {
	getInitCode?(): Promise<string> | string
	getNonce(): Promise<string> | string
	getCallData(executions: Execution[]): Promise<string> | string
	getDummySignature(): Promise<string> | string
	getSignature(userOpHash: string): Promise<string> | string
}

export type Execution = {
	to: string
	data: string
	value: string
}

/**
 * refer to ERC-7677
 */
export interface PaymasterBuilder {
	getPaymasterStubData(userOp: UserOp): Promise<GetPaymasterStubDataResult> | GetPaymasterStubDataResult
	getPaymasterData?(userOp: UserOp): Promise<GetPaymasterDataResult> | GetPaymasterDataResult
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

export async function sendop(options: {
	bundler: Bundler
	from: string
	executions: Execution[]
	execBuilder: ExecutionBuilder
	pmBuilder?: PaymasterBuilder
}) {
	const { bundler, from, executions, execBuilder, pmBuilder } = options

	// build userOp
	const userOp = getEmptyUserOp()
	userOp.sender = from

	if (execBuilder.getInitCode) {
		const initCode = await execBuilder.getInitCode()
		if (initCode && initCode !== '0x') {
			const initCodeWithoutPrefix = initCode.slice(2) // remove 0x prefix
			userOp.factory = '0x' + initCodeWithoutPrefix.slice(0, 40)
			userOp.factoryData = '0x' + initCodeWithoutPrefix.slice(40)
		}
	}

	userOp.nonce = await execBuilder.getNonce()
	userOp.callData = await execBuilder.getCallData(executions)
	userOp.signature = await execBuilder.getDummySignature()

	// if pm, get pmStubData
	let isFinal = false
	if (pmBuilder) {
		const pmStubData = await pmBuilder.getPaymasterStubData(userOp)
		userOp.paymaster = pmStubData.paymaster ?? null
		userOp.paymasterData = pmStubData.paymasterData ?? '0x'
		userOp.paymasterVerificationGasLimit = pmStubData.paymasterVerificationGasLimit ?? '0x0'
		userOp.paymasterPostOpGasLimit = pmStubData.paymasterPostOpGasLimit ?? '0x0'
		isFinal = pmStubData.isFinal ?? false
	}

	// esitmate userOp
	// Note: user operation max fee per gas must be larger than 0 during gas estimation

	const gasValues = await bundler.getGasValues(userOp)
	userOp.maxFeePerGas = gasValues.maxFeePerGas
	userOp.maxPriorityFeePerGas = gasValues.maxPriorityFeePerGas
	userOp.preVerificationGas = gasValues.preVerificationGas
	userOp.verificationGasLimit = gasValues.verificationGasLimit
	userOp.callGasLimit = gasValues.callGasLimit
	userOp.paymasterVerificationGasLimit = gasValues.paymasterVerificationGasLimit
	userOp.paymasterPostOpGasLimit = gasValues.paymasterPostOpGasLimit

	// if pm && !isFinal, get pmData
	if (pmBuilder && pmBuilder.getPaymasterData && !isFinal) {
		const pmData = await pmBuilder.getPaymasterData(userOp)
		userOp.paymaster = pmData.paymaster ?? null
		userOp.paymasterData = pmData.paymasterData ?? '0x'
	}

	// sign userOp
	const userOpHash = getUserOpHash(packUserOp(userOp), ENTRY_POINT_V07, bundler.chainId)
	userOp.signature = await execBuilder.getSignature(userOpHash)

	// send userOp
	await bundler.sendUserOperation(userOp)

	return {
		hash: userOpHash,
		async wait() {
			let result: UserOpReceipt | null = null
			while (result === null) {
				result = await bundler.getUserOperationReceipt(userOpHash)
				if (result === null) {
					await new Promise(resolve => setTimeout(resolve, 1000))
				}
			}
			return result
		},
	}
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
		paymasterData: '0x',
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

export function getUserOpHash(op: PackedUserOp, entryPointAddress: string, chainId: string): string {
	const hashedInitCode = keccak256(op.initCode)
	const hashedCallData = keccak256(op.callData)
	const hashedPaymasterAndData = keccak256(op.paymasterAndData)
	const abiCoder = new AbiCoder()
	const encoded = abiCoder.encode(
		['bytes32', 'address', 'uint256'],
		[
			keccak256(
				abiCoder.encode(
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
			entryPointAddress,
			BigInt(chainId),
		],
	)
	return keccak256(encoded)
}
