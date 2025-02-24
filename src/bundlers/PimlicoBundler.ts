import type { UserOp } from '@/core'
import { ENTRY_POINT_V07 } from '@/core'
import { SendopError } from '@/error'
import { toBeHex } from 'ethers'
import { BaseBundler, type BundlerOptions, type GasValues } from './BaseBundler'

export class PimlicoBundler extends BaseBundler {
	constructor(chainId: string, url: string, options?: BundlerOptions) {
		super(chainId, url, options)
	}

	async getGasValues(userOp: UserOp): Promise<GasValues> {
		// Get gas price
		const curGasPrice = await this.rpcProvider.send({ method: 'pimlico_getUserOperationGasPrice' })
		if (!curGasPrice?.standard?.maxFeePerGas) {
			throw new PimlicoBundlerError('Invalid gas price response from rpcProvider')
		}

		// Set gas price
		userOp.maxFeePerGas = curGasPrice.standard.maxFeePerGas

		// Get gas estimation
		let estimateGas
		if (this.skipGasEstimation) {
			estimateGas = this.getDefaultGasEstimation()
		} else {
			estimateGas = await this.rpcProvider.send({
				method: 'eth_estimateUserOperationGas',
				params: [userOp, ENTRY_POINT_V07],
			})
			this.validateGasEstimation(estimateGas)
		}

		let gasValues: GasValues = {
			maxFeePerGas: toBeHex(curGasPrice.standard.maxFeePerGas),
			maxPriorityFeePerGas: toBeHex(curGasPrice.standard.maxPriorityFeePerGas),
			preVerificationGas: toBeHex(estimateGas.preVerificationGas),
			verificationGasLimit: estimateGas.verificationGasLimit,
			callGasLimit: estimateGas.callGasLimit,
		}

		if (this.gasValuesHook) {
			gasValues = await this.gasValuesHook(gasValues)
		}

		return gasValues
	}
}

export class PimlicoBundlerError extends SendopError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'PimlicoBundlerError'
	}
}
