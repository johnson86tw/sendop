import type { Bundler, UserOp, UserOpReceipt } from '@/core'
import { ENTRY_POINT_V07 } from '@/core'
import { SendopError } from '@/error'
import { RpcProvider } from '@/utils'
import { toBeHex } from 'ethers'

export class AlchemyBundler implements Bundler {
	public chainId: string
	url: string
	bundler: RpcProvider

	constructor(chainId: string, url: string) {
		this.chainId = chainId
		this.url = url
		this.bundler = new RpcProvider(url)
	}

	/**
	 * Refer to Alchemy's account-kit method: https://github.com/alchemyplatform/aa-sdk/blob/f7c7911cdc1f690db4107e21956469955c990bc8/account-kit/infra/src/middleware/feeEstimator.ts#L34-L54
	 */
	async getGasValues(userOp: UserOp) {
		const [block, maxPriorityFeePerGas] = await Promise.all([
			this.bundler.send({ method: 'eth_getBlockByNumber', params: ['latest', true] }),
			this.bundler.send({ method: 'rundler_maxPriorityFeePerGas' }),
		])

		if (!block || !block.baseFeePerGas) {
			throw new AlchemyBundlerError('Missing baseFeePerGas in block')
		}

		if (!maxPriorityFeePerGas || maxPriorityFeePerGas === '0x0' || maxPriorityFeePerGas === '0x') {
			throw new AlchemyBundlerError('Invalid maxPriorityFeePerGas response from bundler')
		}

		const maxFeePerGas = (BigInt(block.baseFeePerGas) * 150n) / 100n + BigInt(maxPriorityFeePerGas)

		// Send eth_estimateUserOperationGas
		userOp.maxFeePerGas = toBeHex(maxFeePerGas)
		const estimateGas = await this.bundler.send({
			method: 'eth_estimateUserOperationGas',
			params: [userOp, ENTRY_POINT_V07],
		})
		if (!estimateGas) {
			throw new AlchemyBundlerError('Empty response from gas estimation')
		}

		// Validate estimation results
		const requiredFields = ['preVerificationGas', 'verificationGasLimit', 'callGasLimit']
		for (const field of requiredFields) {
			if (!(field in estimateGas)) {
				throw new AlchemyBundlerError(`Missing required gas estimation field: ${field}`)
			}
		}

		const gasValues = {
			maxFeePerGas: toBeHex(maxFeePerGas),
			maxPriorityFeePerGas: toBeHex(maxPriorityFeePerGas),
			preVerificationGas: toBeHex(estimateGas.preVerificationGas),
			verificationGasLimit: estimateGas.verificationGasLimit,
			callGasLimit: estimateGas.callGasLimit,
		}

		return gasValues
	}

	async sendUserOperation(userOp: UserOp): Promise<string> {
		return await this.bundler.send({
			method: 'eth_sendUserOperation',
			params: [userOp, ENTRY_POINT_V07],
		})
	}

	async getUserOperationReceipt(hash: string): Promise<UserOpReceipt> {
		return await this.bundler.send({ method: 'eth_getUserOperationReceipt', params: [hash] })
	}
}

export class AlchemyBundlerError extends SendopError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'AlchemyBundlerError'
	}
}
