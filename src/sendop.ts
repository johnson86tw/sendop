import { getEntryPointContract, JsonRpcProvider, toBeHex } from '@/utils/ethers'
import { BundlerRpcProvider } from './bundler'
import { ENTRY_POINT_V07 } from './constant'
import type {
	ERC7579Validator,
	ERC7579Account,
	Execution,
	NetworkInfo,
	PaymasterProvider,
	PaymasterSource,
} from './types'
import { getEmptyUserOp, getUserOpHash, packUserOp, type UserOp, type UserOpReceipt } from './utils/aa'

export async function sendop(options: {
	networkInfo: NetworkInfo
	validator: ERC7579Validator
	vendor: ERC7579Account
	from: string
	executions: Execution[]
	paymaster?: PaymasterSource
}) {
	const { networkInfo, validator, vendor, from, executions, paymaster } = options
	const { chainId, clientUrl, bundlerUrl } = networkInfo

	const client = new JsonRpcProvider(clientUrl)
	const bundler = new BundlerRpcProvider(bundlerUrl)

	const { userOp, userOpHash } = await buildop(
		chainId,
		client,
		bundler,
		validator,
		vendor,
		from,
		executions,
		paymaster,
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
	bundler: BundlerRpcProvider,
	validator: ERC7579Validator,
	vendor: ERC7579Account,
	from: string,
	executions: Execution[],
	paymaster?: PaymasterSource,
): Promise<{
	userOp: UserOp
	userOpHash: string
}> {
	const userOp = getEmptyUserOp()
	userOp.sender = from
	userOp.nonce = await getNonce(client, vendor, validator, from)
	userOp.callData = await vendor.getCallData(from, executions)
	userOp.signature = validator.getDummySignature()

	if (paymaster && typeof paymaster === 'object') {
		const paymasterInfo = await getPaymasterInfo(chainId, userOp, paymaster)
		userOp.paymaster = paymasterInfo.paymaster
		userOp.paymasterData = paymasterInfo.paymasterData
		userOp.paymasterVerificationGasLimit = paymasterInfo.paymasterVerificationGasLimit
		userOp.paymasterPostOpGasLimit = paymasterInfo.paymasterPostOpGasLimit
	} else if (paymaster && typeof paymaster === 'string') {
		// TODO: support paymaster url
		throw new Error('Paymaster url not supported yet')
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

async function getNonce(
	client: JsonRpcProvider,
	vendor: ERC7579Account,
	validator: ERC7579Validator,
	from: string,
): Promise<string> {
	const nonceKey = await vendor.getNonceKey(validator.address())
	const nonce: bigint = await getEntryPointContract(client).getNonce(from, nonceKey)
	return toBeHex(nonce)
}

async function getPaymasterInfo(chainId: string, userOp: UserOp, paymaster: PaymasterProvider) {
	if (typeof paymaster === 'object') {
		const paymasterProvider = paymaster as PaymasterProvider
		const paymasterResult = await paymasterProvider.getPaymasterStubData([
			userOp,
			ENTRY_POINT_V07,
			chainId,
			{}, // Context
		])

		return {
			paymaster: paymasterResult.paymaster || null,
			paymasterData: paymasterResult.paymasterData || null,
			paymasterVerificationGasLimit: paymasterResult.paymasterVerificationGasLimit || '0x0',
			paymasterPostOpGasLimit: paymasterResult.paymasterPostOpGasLimit || '0x0',
		}
	} else {
		// TODO: support paymaster url
		throw new Error('Paymaster not supported', { cause: paymaster })
	}
}

async function getGasValues(bundler: BundlerRpcProvider, userOp: UserOp) {
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
