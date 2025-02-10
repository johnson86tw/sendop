import type { Bundler, UserOp, UserOpReceipt } from '@/core'
import { ENTRY_POINT_V07 } from '@/core'
import { RpcProvider } from '@/utils'

export class AlchemyBundler implements Bundler {
	public chainId: string
	url: string
	bundler: RpcProvider

	constructor(chainId: string, url: string) {
		this.chainId = chainId
		this.url = url
		this.bundler = new RpcProvider(url)
	}

	async getGasValues(userOp: UserOp) {
		// Get gas price: baseFeePerGas + priorityFeePerGas
		const gasPrice = (await this.bundler.send({ method: 'eth_gasPrice' })) as string // hex string
		if (!gasPrice || gasPrice === '0x0' || gasPrice === '0x') {
			throw new Error('Invalid gas price response from bundler')
		}

		// Get maxPriorityFeePerGas
		const maxPriorityFeePerGas = await this.bundler.send({ method: 'rundler_maxPriorityFeePerGas' })
		if (!maxPriorityFeePerGas || maxPriorityFeePerGas === '0x0' || maxPriorityFeePerGas === '0x') {
			throw new Error('Invalid maxPriorityFeePerGas response from bundler')
		}

		// eth_estimateUserOperationGas
		userOp.maxFeePerGas = gasPrice
		const estimateGas = await this.bundler.send({
			method: 'eth_estimateUserOperationGas',
			params: [userOp, ENTRY_POINT_V07],
		})
		if (!estimateGas) {
			throw new Error('Empty response from gas estimation')
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
			maxPriorityFeePerGas: maxPriorityFeePerGas,
			preVerificationGas: estimateGas.preVerificationGas,
			verificationGasLimit: estimateGas.verificationGasLimit,
			callGasLimit: estimateGas.callGasLimit,
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
