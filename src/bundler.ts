import type { Bundler, UserOp, UserOpReceipt } from '@/index'
import { ENTRY_POINT_V07, RpcProvider } from '@/index'

export class PimlicoBundler implements Bundler {
	chainId: string
	url: string
	bundler: RpcProvider

	constructor(chainId: string, url: string) {
		// TODO: check if the bundler url is valid
		this.chainId = chainId
		this.url = url
		this.bundler = new RpcProvider(url)
	}

	async getGasValues(userOp: UserOp) {
		let curGasPrice, estimateGas

		try {
			// Get gas price
			try {
				curGasPrice = await this.bundler.send({ method: 'pimlico_getUserOperationGasPrice' })
				if (!curGasPrice?.standard?.maxFeePerGas) {
					throw new Error('Invalid gas price response from bundler')
				}
			} catch (error) {
				throw new Error('Failed to get gas price from bundler', {
					cause: error instanceof Error ? error : new Error(String(error)),
				})
			}

			// Set and estimate gas
			userOp.maxFeePerGas = curGasPrice.standard.maxFeePerGas
			try {
				estimateGas = await this.bundler.send({
					method: 'eth_estimateUserOperationGas',
					params: [userOp, ENTRY_POINT_V07],
				})
				if (!estimateGas) {
					throw new Error('Empty response from gas estimation')
				}
			} catch (error) {
				throw new Error('Failed to estimate operation gas', {
					cause: error instanceof Error ? error : new Error(String(error)),
				})
			}

			// Validate estimation results
			const requiredFields = ['preVerificationGas', 'verificationGasLimit', 'callGasLimit']
			for (const field of requiredFields) {
				if (!(field in estimateGas)) {
					throw new Error(`Missing required gas estimation field: ${field}`)
				}
			}

			return {
				maxFeePerGas: userOp.maxFeePerGas,
				maxPriorityFeePerGas: curGasPrice.standard.maxPriorityFeePerGas,
				preVerificationGas: estimateGas.preVerificationGas,
				verificationGasLimit: estimateGas.verificationGasLimit,
				callGasLimit: estimateGas.callGasLimit,
				paymasterVerificationGasLimit: estimateGas.paymasterVerificationGasLimit,
				paymasterPostOpGasLimit: estimateGas.paymasterPostOpGasLimit,
			}
		} catch (error) {
			// Ensure we always throw an Error object with a descriptive message
			if (error instanceof Error) {
				throw error
			}
			throw new Error('Unknown error during gas estimation', {
				cause: new Error(String(error)),
			})
		}
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
