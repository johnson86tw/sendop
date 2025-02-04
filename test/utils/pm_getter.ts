import type { GetPaymasterDataResult, GetPaymasterStubDataResult, PaymasterGetter, UserOp } from '@/core'
import { Contract, JsonRpcProvider, toBeHex } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS } from './test_address'
import { ENTRY_POINT_V07 } from '@/core'
import { RpcProvider } from '@/utils'

export class MyPaymaster implements PaymasterGetter {
	#client: JsonRpcProvider
	#paymasterAddress: string
	#paymaster: Contract

	constructor(options: { client: JsonRpcProvider; paymasterAddress: string }) {
		this.#client = options.client
		this.#paymasterAddress = options.paymasterAddress
		this.#paymaster = new Contract(
			this.#paymasterAddress,
			['function isAllowed(address _address) public view returns (bool)'],
			this.#client,
		)
	}

	async getPaymasterStubData(userOp: UserOp): Promise<GetPaymasterStubDataResult> {
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
		const isAllowed = await this.#paymaster.isAllowed(userOp.sender)
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

export class PimlicoPaymaster implements PaymasterGetter {
	chainId: string
	paymaster: RpcProvider

	constructor(options: { chainId: string; url: string }) {
		this.chainId = options.chainId
		this.paymaster = new RpcProvider(options.url)
	}

	async getPaymasterStubData(userOp: UserOp): Promise<GetPaymasterStubDataResult> {
		return this.paymaster.send({
			method: 'pm_getPaymasterStubData',
			params: [
				userOp,
				ENTRY_POINT_V07,
				toBeHex(this.chainId),
				{
					sponsorshipPolicyId: 'sp_superb_timeslip',
				},
			],
		})
	}

	async getPaymasterData(userOp: UserOp): Promise<GetPaymasterDataResult> {
		return this.paymaster.send({
			method: 'pm_getPaymasterData',
			params: [
				userOp,
				ENTRY_POINT_V07,
				toBeHex(this.chainId),
				{
					sponsorshipPolicyId: 'sp_superb_timeslip',
				},
			],
		})
	}
}
