import { Contract, getEntryPointContract, JsonRpcProvider } from '@/utils/ethers'
import { BundlerRpcProvider } from './bundler'
import type { AccountRequestingValidator, PaymasterSource, Validator, Vendor } from './types'

type ConstructorOptions = {
	chainId: string
	clientUrl: string
	bundlerUrl: string
	validator: Validator | AccountRequestingValidator
	supportedVendors: {
		[key: string]: Vendor
	}
	paymaster?: PaymasterSource
}

export class SAProvider {
	readonly chainId: string
	readonly client: JsonRpcProvider
	readonly bundler: BundlerRpcProvider
	readonly validator: Validator | AccountRequestingValidator
	readonly supportedVendors: {
		[key: string]: Vendor
	}
	readonly paymaster?: PaymasterSource
	readonly entryPoint: Contract

	readonly accountAddressToId: {
		[address: string]: string
	} = {}

	constructor(options: ConstructorOptions) {
		this.chainId = options.chainId
		this.client = new JsonRpcProvider(options.clientUrl)
		this.bundler = new BundlerRpcProvider(options.bundlerUrl)
		this.validator = options.validator
		this.supportedVendors = options.supportedVendors
		this.paymaster = options.paymaster
		this.entryPoint = getEntryPointContract(this.client)
	}

	get storedAccounts(): { id: string; address: string }[] {
		return Object.entries(this.accountAddressToId).map(([address, id]) => ({ id, address }))
	}

	async requestAccounts(): Promise<string[]> {
		if (!('requestAccounts' in this.validator)) {
			throw new Error('Validator does not support account request')
		}

		const accounts = await this.validator.requestAccounts()

		for (const address of accounts) {
			const sa = new Contract(
				address,
				['function accountId() external pure returns (string memory)'],
				this.client,
			)
			const accountId = await sa.accountId()
			this.accountAddressToId[address] = accountId
		}

		return accounts
	}

	sendCalls() {}
}
