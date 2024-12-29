import { Contract, JsonRpcProvider, toBeHex } from 'ethers'
import { addresses } from './addresses'
import type { GetPaymasterStubDataParams, GetPaymasterStubDataResult } from '@/types'
import { ENTRY_POINT_V07 } from '@/constant'
import type { PaymasterBuilder } from '@/core/sendop'

const CHARITY_PAYMASTER_ADDRESS = addresses['11155111'].CHARITY_PAYMASTER

type ConstructorOptions = {
	chainId: string
	clientUrl: string
	paymasterAddress: string
}

export class PmBuilder implements PaymasterBuilder {
	#chainId: string
	#clientUrl: string
	#paymasterAddress: string

	constructor(options: { chainId: string; clientUrl: string; paymasterAddress: string }) {
		this.#chainId = options.chainId
		this.#clientUrl = options.clientUrl
		this.#paymasterAddress = options.paymasterAddress
	}
	async getPaymasterStubData(userOp: UserOp) {
		return await this.#pm.getPaymasterStubData([userOp, ENTRY_POINT_V07, this.#chainId, {}])
	}
}
