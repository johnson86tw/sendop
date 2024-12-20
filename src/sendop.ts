import { getEntryPointContract, JsonRpcProvider, toBeHex } from '@/utils/ethers'
import { ENTRY_POINT_V07 } from './constant'
import { RpcProvider } from './rpc_provider'
import type {
	AccountCreatingVendor,
	Execution,
	GetPaymasterStubDataResult,
	NetworkInfo,
	PaymasterSource,
	Validator,
	Vendor,
} from './types'
import { getEmptyUserOp, getUserOpHash, packUserOp, type UserOp, type UserOpReceipt } from './utils/aa'

export async function sendop(options: {
	networkInfo: NetworkInfo
	validator: Validator
	vendor: Vendor | AccountCreatingVendor
	from: string
	executions: Execution[]
	paymaster?: PaymasterSource
	creationParams?: any[]
}) {
	const { networkInfo, validator, vendor, from, executions, paymaster, creationParams } = options
	const { chainId, clientUrl, bundlerUrl } = networkInfo

	const client = new JsonRpcProvider(clientUrl)
	const bundler = new RpcProvider(bundlerUrl)

	const { userOp, userOpHash } = await buildop(
		chainId,
		client,
		bundler,
		validator,
		vendor,
		from,
		executions,
		paymaster,
		creationParams,
	)

	await bundler.send({
		method: 'eth_sendUserOperation',
		params: [userOp, ENTRY_POINT_V07],
	})

	return {
		hash: userOpHash,
		async wait() {
			let result: UserOpReceipt | null = null
			while (result === null) {
				result = await bundler.send({ method: 'eth_getUserOperationReceipt', params: [userOpHash] })
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
		userOp.factory = initCode.slice(0, 20)
		userOp.factoryData = initCode.slice(20)
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
	console.log('nonceKey', nonceKey)
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
			params: [userOp, ENTRY_POINT_V07, toBeHex(chainId)],
		})
	}

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
