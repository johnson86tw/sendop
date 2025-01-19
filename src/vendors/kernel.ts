import type { Bundler, ERC7579Validator, Execution, PaymasterGetter, SendOpResult } from '@/core'
import { sendop, type SmartAccount } from '@/index'
import { is32BytesHexString, getEntryPointContract } from '@/utils/ethers'
import { concat, Contract, isAddress, JsonRpcProvider, toBeHex, ZeroAddress } from 'ethers'
import { KernelBase } from './kernel_base'

const KERNEL_FACTORY_ADDRESS = '0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419'

export type KernelCreationOptions = {
	salt: string
	validatorAddress: string
	owner: string
}

export class Kernel extends KernelBase implements SmartAccount {
	address: string
	client: JsonRpcProvider
	bundler: Bundler
	erc7579Validator: ERC7579Validator

	pmGetter?: PaymasterGetter

	constructor(
		address: string,
		options: {
			client: JsonRpcProvider
			bundler: Bundler
			erc7579Validator: ERC7579Validator
			pmGetter?: PaymasterGetter
		},
	) {
		super()
		this.address = address
		this.client = options.client
		this.bundler = options.bundler
		this.erc7579Validator = options.erc7579Validator
		this.pmGetter = options.pmGetter
	}

	async getSender() {
		return this.address
	}

	async getDummySignature() {
		return this.erc7579Validator.getDummySignature()
	}

	async getSignature(hash: string) {
		return this.erc7579Validator.getSignature(hash)
	}

	async getNonce() {
		const nonceKey = await this.getNonceKey(await this.erc7579Validator.address())
		const nonce: bigint = await getEntryPointContract(this.client).getNonce(this.address, nonceKey)
		return toBeHex(nonce)
	}

	async send(executions: Execution[], pmGetter?: PaymasterGetter): Promise<SendOpResult> {
		return await sendop({
			bundler: this.bundler,
			executions,
			opGetter: this,
			pmGetter: pmGetter ?? this.pmGetter,
		})
	}

	async deploy(creationOptions: KernelCreationOptions, pmGetter?: PaymasterGetter): Promise<SendOpResult> {
		return await sendop({
			bundler: this.bundler,
			executions: [],
			opGetter: this,
			pmGetter: pmGetter ?? this.pmGetter,
			initCode: this.getInitCode(creationOptions),
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

	getNewAddress(options: KernelCreationOptions) {
		return Kernel.getNewAddress(this.client, options)
	}

	getInitCode(creationOptions: KernelCreationOptions) {
		const { salt, validatorAddress, owner } = creationOptions
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
