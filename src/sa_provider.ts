import { Contract, getAddress, getEntryPointContract, JsonRpcProvider } from '@/utils/ethers'
import { RpcProvider } from './rpc_provider'
import type { AccountRequestingValidator, NetworkInfo, PaymasterSource, Validator, Vendor } from './types'
import { sendop } from './sendop'
import type { UserOpReceipt } from './utils/aa'

type ConstructorOptions = {
	networkInfo: NetworkInfo
	validator: Validator | AccountRequestingValidator
	supportedVendors: {
		[accountId: string]: Vendor
	}
	paymaster?: PaymasterSource
}

export class SAProvider {
	readonly networkInfo: NetworkInfo
	readonly client: JsonRpcProvider
	readonly bundler: RpcProvider
	readonly validator: Validator | AccountRequestingValidator
	readonly supportedVendors: {
		[accountId: string]: Vendor
	}
	readonly paymaster?: PaymasterSource
	readonly entryPoint: Contract

	readonly accountAddressToVendor: {
		[address: string]: Vendor
	} = {}

	constructor(options: ConstructorOptions) {
		this.networkInfo = options.networkInfo
		this.client = new JsonRpcProvider(this.networkInfo.clientUrl)
		this.bundler = new RpcProvider(this.networkInfo.bundlerUrl)
		this.validator = options.validator
		this.supportedVendors = options.supportedVendors
		this.paymaster = options.paymaster
		this.entryPoint = getEntryPointContract(this.client)
	}

	get chainId(): string {
		return this.networkInfo.chainId
	}

	get clientUrl(): string {
		return this.networkInfo.clientUrl
	}

	get bundlerUrl(): string {
		return this.networkInfo.bundlerUrl
	}

	get storedAccounts(): { id: string; address: string }[] {
		return Object.entries(this.accountAddressToVendor).map(([address, vendor]) => ({
			id: vendor.accountId(),
			address,
		}))
	}

	getVendor(address: string): Vendor {
		return this.accountAddressToVendor[address]
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
			this.accountAddressToVendor[getAddress(address)] = this.supportedVendors[accountId]
		}

		return accounts
	}

	async send(params: {
		from: string
		calls: {
			to: string
			data: string
			value: string
		}[]
		capabilities?: Record<string, any>
	}): Promise<UserOpReceipt> {
		const { from, calls, capabilities } = params
		const vendor = this.getVendor(from)

		const op = await sendop({
			networkInfo: this.networkInfo,
			validator: this.validator,
			vendor,
			from,
			executions: calls,
			paymaster: this.paymaster,
		})

		return await op.wait()
	}
}
