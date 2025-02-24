import type { Bundler, UserOp, UserOpReceipt } from '@/core'
import { ENTRY_POINT_V07 } from '@/core'
import { SendopError } from '@/error'
import { RpcProvider } from '@/utils'

export type GasValues = {
	maxFeePerGas: string
	maxPriorityFeePerGas: string
	preVerificationGas: string
	verificationGasLimit: string
	callGasLimit: string
}

export type BundlerOptions = {
	skipGasEstimation?: boolean
	gasValuesHook?: (gasValues: GasValues) => Promise<GasValues>
}

export abstract class BaseBundler implements Bundler {
	public chainId: string
	public url: string
	public rpcProvider: RpcProvider
	protected skipGasEstimation: boolean
	protected gasValuesHook?: (gasValues: GasValues) => Promise<GasValues>

	constructor(chainId: string, url: string, options?: BundlerOptions) {
		this.chainId = chainId
		this.url = url
		this.rpcProvider = new RpcProvider(url)
		this.skipGasEstimation = options?.skipGasEstimation ?? false
		this.gasValuesHook = options?.gasValuesHook
	}

	abstract getGasValues(userOp: UserOp): Promise<GasValues>

	async sendUserOperation(userOp: UserOp): Promise<string> {
		return await this.rpcProvider.send({
			method: 'eth_sendUserOperation',
			params: [userOp, ENTRY_POINT_V07],
		})
	}

	async getUserOperationReceipt(hash: string): Promise<UserOpReceipt> {
		return await this.rpcProvider.send({ method: 'eth_getUserOperationReceipt', params: [hash] })
	}

	protected getDefaultGasEstimation() {
		return {
			preVerificationGas: '0xf423f', // 999_999
			verificationGasLimit: '0xf423f',
			callGasLimit: '0xf423f',
		}
	}

	protected validateGasEstimation(estimateGas: any) {
		if (!estimateGas) {
			throw new BaseBundlerError('Empty response from gas estimation')
		}

		const requiredFields = ['preVerificationGas', 'verificationGasLimit', 'callGasLimit']
		for (const field of requiredFields) {
			if (!(field in estimateGas)) {
				throw new BaseBundlerError(`Missing required gas estimation field: ${field}`)
			}
		}
		return estimateGas
	}
}

export class BaseBundlerError extends SendopError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'BaseBundlerError'
	}
}
