import { Contract, JsonRpcProvider, toBeHex } from 'ethers'
import { addresses } from './network'
import type { GetPaymasterStubDataParams, GetPaymasterStubDataResult } from '@/types'
import { ENTRY_POINT_V07 } from '@/constant'

const CHARITY_PAYMASTER_ADDRESS = addresses['11155111'].CHARITY_PAYMASTER

type ConstructorOptions = {
	chainId: string
	clientUrl: string
	paymasterAddress: string
}

export class MyPaymaster {
	#chainId: string
	#client: JsonRpcProvider
	#paymasterAddress: string
	#paymaster: Contract

	constructor(options: ConstructorOptions) {
		this.#chainId = options.chainId
		this.#client = new JsonRpcProvider(options.clientUrl)
		this.#paymasterAddress = options.paymasterAddress
		this.#paymaster = new Contract(
			this.#paymasterAddress,
			['function isAllowed(address _address) public view returns (bool)'],
			this.#client,
		)
	}

	async getPaymasterStubData(params: GetPaymasterStubDataParams): Promise<GetPaymasterStubDataResult> {
		// check entrypoint and chain id is correct
		if (params[1] !== ENTRY_POINT_V07 || params[2] !== this.#chainId) {
			throw new Error('Entrypoint or chain id is incorrect')
		}

		// for charity paymaster
		if (this.#paymasterAddress === CHARITY_PAYMASTER_ADDRESS) {
			return {
				sponsor: {
					name: 'My Wallet',
				},
				paymaster: this.#paymasterAddress,
				paymasterData: '0x',
				paymasterVerificationGasLimit: toBeHex(999_999n),
				paymasterPostOpGasLimit: toBeHex(999_999n),
				isFinal: true,
			}
		}

		// check sender is in allowlist
		const isAllowed = await this.#paymaster.isAllowed(params[0].sender)
		if (!isAllowed) {
			throw new Error('Sender is not in allowlist')
		}

		return {
			sponsor: {
				name: 'My Wallet',
			},
			paymaster: this.#paymasterAddress,
			paymasterData: '0x',
			paymasterVerificationGasLimit: toBeHex(999_999n),
			paymasterPostOpGasLimit: toBeHex(999_999n),
			isFinal: true,
		}
	}
}
