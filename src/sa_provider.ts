import { getEntryPointContract, JsonRpcProvider, Contract } from '@/utils/ethers'
import { BundlerRpcProvider } from './bundler'
import type { Vendor, PaymasterSource } from './types'
import type { Validator } from './types'

type ConstructorOptions = {
	chainId: string
	clientUrl: string
	bundlerUrl: string
	validators: {
		[key: string]: Validator
	}
	vendors: {
		[key: string]: Vendor
	}
	paymaster?: PaymasterSource
}

export class SAProvider {
	readonly chainId: string
	readonly client: JsonRpcProvider
	readonly bundler: BundlerRpcProvider
	readonly validators: {
		[key: string]: Validator
	}
	readonly vendors: {
		[key: string]: Vendor
	}
	readonly paymaster?: PaymasterSource
	readonly entryPoint: Contract

	readonly accounts: {
		[address: string]: string
	} = {}

	constructor(options: ConstructorOptions) {
		this.chainId = options.chainId
		this.client = new JsonRpcProvider(options.clientUrl)
		this.bundler = new BundlerRpcProvider(options.bundlerUrl)
		this.validators = options.validators
		this.vendors = options.vendors
		this.paymaster = options.paymaster
		this.entryPoint = getEntryPointContract(this.client)
	}

	requestAccounts() {}

	sendCalls() {}
}
