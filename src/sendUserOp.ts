import { getEntryPointContract, JsonRpcProvider, toBeHex } from '@/utils/ethers'
import { ENTRY_POINT_V07 } from './constant'
import { RpcProvider } from './rpc_provider'
import type {
	AccountCreatingVendor,
	Execution,
	GetPaymasterStubDataResult,
	PaymasterSource,
	Validator,
	Vendor,
} from './types'
import { getEmptyUserOp, getUserOpHash, packUserOp, type UserOp, type UserOpReceipt } from './utils/aa'

export interface ExecutionBuilder {
	getNonceKey(...args: any[]): Promise<string> | string
	getCallData(...args: any[]): Promise<string> | string
	getDummySignature(...args: any[]): Promise<string> | string
	getSignature(userOpHash: string): Promise<string> | string
	getInitCode?(...args: any[]): Promise<string> | string
}

export type PaymasterInfo = {
	paymaster: string
	paymasterVerificationGasLimit: string
	paymasterPostOpGasLimit: string
	paymasterData: string
}

export interface PaymasterBuilder {
	getPaymasterInfo(...args: any[]): Promise<PaymasterInfo> | PaymasterInfo
}

export interface Client {
	chainId: string
	estimateUserOpGas(userOp: UserOp): Promise<string>
	sendUserOp(userOp: UserOp): Promise<string>
	sendUserOps(userOps: UserOp[]): Promise<string[]> // TODO: 這個功能的必要性？
	getUserOpReceipt(hash: string): Promise<UserOpReceipt>
}

export async function sendUserOp(options: {
	client: Client
	from: string
	executions: Execution[]
	execBuilder: ExecutionBuilder
	pmBuilder?: PaymasterBuilder
}) {
	const { client, from, executions, execBuilder, pmBuilder } = options
	const userOp = getEmptyUserOp()

	// build userOp

	// if pm, get pmStubData

	// esitmate userOp

	// if pm && !isFinal, get pmData

	// sign userOp

	// send userOp
	await client.sendUserOp(userOp)

	return {
		hash: userOpHash,
		async wait() {
			let result: UserOpReceipt | null = null
			while (result === null) {
				result = await client.getUserOpReceipt(userOpHash)
				if (result === null) {
					await new Promise(resolve => setTimeout(resolve, 1000))
				}
			}
			return result
		},
	}
}

async function buildop(
	chainId: string,
	client: JsonRpcProvider,
	bundler: RpcProvider,
	validator: Validator,
	vendor: Vendor | AccountCreatingVendor,
	from: string,
	executions: Execution[],
	paymaster?: PaymasterSource,
	creationParams?: any[],
): Promise<{
	userOp: UserOp
	userOpHash: string
}> {
	const userOp = getEmptyUserOp()
	userOp.sender = from

	if (creationParams) {
		if (!('getAddress' in vendor) || !('getInitCode' in vendor)) {
			throw new Error('Vendor does not support account creation')
		}

		const address = await vendor.getAddress(client, ...creationParams)
		if (from !== address) {
			throw new Error('Sender address mismatch')
		}

		const initCode = vendor.getInitCode(...creationParams)
		// remove 0x prefix in initCode
		const initCodeWithoutPrefix = initCode.slice(2)
		userOp.factory = '0x' + initCodeWithoutPrefix.slice(0, 40)
		userOp.factoryData = '0x' + initCodeWithoutPrefix.slice(40)
	} else {
		userOp.callData = await vendor.getCallData(from, executions)
	}

	userOp.nonce = await getNonce(client, vendor, validator, from)
	userOp.signature = validator.getDummySignature()

	if (paymaster) {
		const paymasterInfo = await getPaymasterInfo(chainId, userOp, paymaster)
		userOp.paymaster = paymasterInfo.paymaster
		userOp.paymasterData = paymasterInfo.paymasterData
		userOp.paymasterVerificationGasLimit = paymasterInfo.paymasterVerificationGasLimit
		userOp.paymasterPostOpGasLimit = paymasterInfo.paymasterPostOpGasLimit
	}

	const gasValues = await getGasValues(bundler, userOp)
	userOp.maxFeePerGas = gasValues.maxFeePerGas
	userOp.maxPriorityFeePerGas = gasValues.maxPriorityFeePerGas
	userOp.preVerificationGas = gasValues.preVerificationGas
	userOp.verificationGasLimit = gasValues.verificationGasLimit
	userOp.callGasLimit = gasValues.callGasLimit
	userOp.paymasterVerificationGasLimit = gasValues.paymasterVerificationGasLimit
	userOp.paymasterPostOpGasLimit = gasValues.paymasterPostOpGasLimit

	// TODO: pm_getPaymasterStubData isFinal being false should handle this case
	if (paymaster && typeof paymaster === 'string') {
		const pmData: {
			paymaster: string
			paymasterData: string
		} = await new RpcProvider(paymaster).send({
			method: 'pm_getPaymasterData',
			params: [
				userOp,
				ENTRY_POINT_V07,
				toBeHex(chainId),
				{
					sponsorshipPolicyId: 'sp_superb_timeslip',
				},
			],
		})
		console.log('pmData', pmData)
		userOp.paymaster = pmData.paymaster
		userOp.paymasterData = pmData.paymasterData
	}

	// Sign signature
	const userOpHash = getUserOpHash(chainId, packUserOp(userOp))
	userOp.signature = await validator.getSignature(userOpHash)

	return {
		userOp,
		userOpHash,
	}
}

async function getNonce(client: JsonRpcProvider, vendor: Vendor, validator: Validator, from: string): Promise<string> {
	const nonceKey = await vendor.getNonceKey(validator.address())
	const nonce: bigint = await getEntryPointContract(client).getNonce(from, nonceKey)
	return toBeHex(nonce)
}

async function getPaymasterInfo(chainId: string, userOp: UserOp, paymaster: PaymasterSource) {
	let res: GetPaymasterStubDataResult = {
		paymaster: undefined,
		paymasterData: undefined,
		paymasterVerificationGasLimit: '0x0',
		paymasterPostOpGasLimit: '0x0',
	}

	if (typeof paymaster === 'object') {
		res = await paymaster.getPaymasterStubData([userOp, ENTRY_POINT_V07, chainId, {}])
	} else if (typeof paymaster === 'string') {
		res = await new RpcProvider(paymaster).send({
			method: 'pm_getPaymasterStubData',
			params: [
				userOp,
				ENTRY_POINT_V07,
				toBeHex(chainId),
				{
					sponsorshipPolicyId: 'sp_superb_timeslip',
				},
			],
		})
	}

	console.log('pmStubData', res)

	return {
		paymaster: res.paymaster ?? null,
		paymasterData: res.paymasterData ?? null,
		paymasterVerificationGasLimit: res.paymasterVerificationGasLimit ?? '0x0',
		paymasterPostOpGasLimit: res.paymasterPostOpGasLimit ?? '0x0',
	}
}

async function getGasValues(bundler: RpcProvider, userOp: UserOp) {
	const curGasPrice = await bundler.send({ method: 'pimlico_getUserOperationGasPrice' })
	// Note: user operation max fee per gas must be larger than 0 during gas estimation
	userOp.maxFeePerGas = curGasPrice.standard.maxFeePerGas
	const estimateGas = await bundler.send({
		method: 'eth_estimateUserOperationGas',
		params: [userOp, ENTRY_POINT_V07],
	})

	return {
		maxFeePerGas: userOp.maxFeePerGas,
		maxPriorityFeePerGas: curGasPrice.standard.maxPriorityFeePerGas,
		preVerificationGas: estimateGas.preVerificationGas,
		verificationGasLimit: estimateGas.verificationGasLimit,
		callGasLimit: estimateGas.callGasLimit,
		paymasterVerificationGasLimit: estimateGas.paymasterVerificationGasLimit,
		paymasterPostOpGasLimit: estimateGas.paymasterPostOpGasLimit,
	}
}
