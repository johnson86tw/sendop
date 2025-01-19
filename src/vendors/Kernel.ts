import type { Bundler, Execution, PaymasterBuilder, SendOpResult } from '@/core'
import { sendop } from '@/core'
import type { ERC4337Account, Validator } from '@/types'
import { is32BytesHexString } from '@/utils/ethers'
import { concat, Contract, isAddress, JsonRpcProvider, ZeroAddress } from 'ethers'
import { OpBuilder } from '@/OpBuilder'
import { KernelBase } from './kernel_base'

const KERNEL_FACTORY_ADDRESS = '0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419'

export type KernelCreationOptions = {
	salt: string
	validatorAddress: string
	owner: string
}

export class Kernel extends KernelBase implements ERC4337Account {
	client: JsonRpcProvider
	bundler: Bundler
	validator: Validator

	pmBuilder?: PaymasterBuilder
	creationOptions?: KernelCreationOptions

	constructor(options: {
		client: JsonRpcProvider
		bundler: Bundler
		validator: Validator
		pmBuilder?: PaymasterBuilder
		creationOptions?: KernelCreationOptions
	}) {
		super()

		this.client = options.client
		this.bundler = options.bundler
		this.validator = options.validator

		this.pmBuilder = options.pmBuilder
		this.creationOptions = options.creationOptions
	}

	async send(address: string, executions: Execution[], pmBuilder?: PaymasterBuilder): Promise<SendOpResult> {
		return await sendop({
			bundler: this.bundler,
			from: address,
			executions,
			opBuilder: new OpBuilder({
				client: this.client,
				vendor: this,
				validator: this.validator,
				from: address,
			}),
			pmBuilder: pmBuilder ?? this.pmBuilder,
		})
	}

	async deploy(pmBuilder?: PaymasterBuilder): Promise<SendOpResult> {
		const deployedAddress = await this.getAddress()
		return await sendop({
			bundler: this.bundler,
			from: deployedAddress,
			executions: [],
			opBuilder: new OpBuilder({
				client: this.client,
				vendor: this,
				validator: this.validator,
				from: deployedAddress,
				isCreation: true,
			}),
			pmBuilder: pmBuilder ?? this.pmBuilder,
		})
	}

	static async getNewAddress(client: JsonRpcProvider, creationOptions: KernelCreationOptions) {
		const { salt, validatorAddress, owner } = creationOptions

		if (!is32BytesHexString(salt)) {
			throw new Error('Salt should be 32 bytes')
		}

		const kernelFactory = new Contract(KERNEL_FACTORY_ADDRESS, this.kernelFactoryInterface, client)

		function getInitializeData(validator: string, owner: string) {
			if (!isAddress(validator) || !isAddress(owner)) {
				throw new Error('Invalid address', { cause: { validator, owner } })
			}

			return KernelBase.kernelInterface.encodeFunctionData('initialize', [
				concat(['0x01', validator]),
				ZeroAddress,
				owner,
				'0x',
				[],
			])
		}

		const address = await kernelFactory['getAddress(bytes,bytes32)'](
			getInitializeData(validatorAddress, owner),
			salt,
		)

		if (!isAddress(address)) {
			throw new Error('Failed to get new address')
		}

		return address
	}

	// if optinos is provided, it will use the options instead of the creationOptions in the constructor
	async getAddress(): Promise<string> {
		if (!this.client) {
			throw new Error('Client is not set')
		}

		if (!this.creationOptions) {
			throw new Error('Creation options are not set')
		}
		const { salt, validatorAddress, owner } = this.creationOptions

		if (!is32BytesHexString(salt)) {
			throw new Error('Salt should be 32 bytes')
		}

		const kernelFactory = new Contract(KERNEL_FACTORY_ADDRESS, this.kernelFactoryInterface(), this.client)
		const address = await kernelFactory['getAddress(bytes,bytes32)'](
			this.getInitializeData(validatorAddress, owner),
			salt,
		)

		if (!isAddress(address)) {
			throw new Error('Failed to get new address')
		}

		return address
	}

	getInitCode() {
		if (!this.creationOptions) {
			throw new Error('Creation options are not set')
		}

		const { salt, validatorAddress, owner } = this.creationOptions
		return concat([KERNEL_FACTORY_ADDRESS, this.getCreateAccountData(validatorAddress, owner, salt)])
	}

	private getCreateAccountData(validator: string, owner: string, salt: string) {
		if (!is32BytesHexString(salt)) {
			throw new Error('Salt should be 32 bytes')
		}

		return this.kernelFactoryInterface().encodeFunctionData('createAccount', [
			this.getInitializeData(validator, owner),
			salt,
		])
	}

	private getInitializeData(validator: string, owner: string) {
		if (!isAddress(validator) || !isAddress(owner)) {
			throw new Error('Invalid address', { cause: { validator, owner } })
		}

		return this.kernelInterface().encodeFunctionData('initialize', [
			concat(['0x01', validator]),
			ZeroAddress,
			owner,
			'0x',
			[],
		])
	}
}
