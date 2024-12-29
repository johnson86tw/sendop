import type { Execution } from '@/core'
import { abiEncode, is32BytesHexString, padLeft } from '@/utils/ethers'
import type { BytesLike } from 'ethers'
import { concat, Contract, hexlify, Interface, isAddress, JsonRpcProvider, toBeHex, ZeroAddress } from 'ethers'
import type { AccountCreatingVendor } from '../types'

const KERNEL_FACTORY_ADDRESS = '0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419'

export class Kernel implements AccountCreatingVendor {
	static readonly accountId = 'kernel.advanced.v0.3.1'
	static readonly kernelFactoryInterface = new Interface([
		'function createAccount(bytes calldata data, bytes32 salt) public payable returns (address)',
		'function getAddress(bytes calldata data, bytes32 salt) public view returns (address)',
	])
	static readonly kernelInterface = new Interface([
		'function initialize(bytes21 _rootValidator, address hook, bytes calldata validatorData, bytes calldata hookData, bytes[] calldata initConfig) external',
		'function execute(bytes32 execMode, bytes calldata executionCalldata)',
	])

	#client?: JsonRpcProvider
	#creationOptions?: {
		salt: string
		validatorAddress: string
		owner: string
	}

	constructor(
		clientUrl?: string,
		creationOptions?: {
			salt: string
			validatorAddress: string
			owner: string
		},
	) {
		if (clientUrl) {
			this.#client = new JsonRpcProvider(clientUrl)
		}
		if (creationOptions) {
			this.#creationOptions = creationOptions
		}
	}

	accountId() {
		return Kernel.accountId
	}

	/**
	 * see kernel "function decodeNonce"
	 * 1byte mode  | 1byte type | 20bytes identifierWithoutType | 2byte nonceKey | 8byte nonce == 32bytes
	 */
	async getNonceKey(validator: string) {
		// TODO: custom nonce key when constructing kernel
		return concat(['0x00', '0x00', validator, '0x0000'])
	}

	async getAddress(): Promise<string> {
		if (!this.#client) {
			throw new Error('Client is not set')
		}

		if (!this.#creationOptions) {
			throw new Error('Creation options are not set')
		}

		const { salt, validatorAddress, owner } = this.#creationOptions

		if (!is32BytesHexString(salt)) {
			throw new Error('Salt should be 32 bytes')
		}

		const kernelFactory = new Contract(KERNEL_FACTORY_ADDRESS, Kernel.kernelFactoryInterface, this.#client)
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
		if (!this.#creationOptions) {
			throw new Error('Creation options are not set')
		}

		const { validatorAddress, owner, salt } = this.#creationOptions

		return concat([KERNEL_FACTORY_ADDRESS, this.getCreateAccountData(validatorAddress, owner, salt)])
	}

	private getCreateAccountData(validator: string, owner: string, salt: string) {
		if (!is32BytesHexString(salt)) {
			throw new Error('Salt should be 32 bytes')
		}

		return Kernel.kernelFactoryInterface.encodeFunctionData('createAccount', [
			this.getInitializeData(validator, owner),
			salt,
		])
	}

	private getInitializeData(validator: string, owner: string) {
		if (!isAddress(validator) || !isAddress(owner)) {
			throw new Error('Invalid address', { cause: { validator, owner } })
		}

		return Kernel.kernelInterface.encodeFunctionData('initialize', [
			concat(['0x01', validator]),
			ZeroAddress,
			owner,
			'0x',
			[],
		])
	}

	async getCallData(from: string, executions: Execution[]) {
		const execMode = '0x0100000000000000000000000000000000000000000000000000000000000000'

		const executionsData = executions.map(execution => ({
			target: execution.to || '0x',
			value: BigInt(execution.value || '0x0'),
			data: execution.data || '0x',
		}))

		const executionCalldata = abiEncode(
			['tuple(address,uint256,bytes)[]'],
			[executionsData.map(execution => [execution.target, execution.value, execution.data])],
		)

		return Kernel.kernelInterface.encodeFunctionData('execute', [execMode, executionCalldata])
	}

	async getInstallModuleInitData(validationData: BytesLike) {
		const hook = ZeroAddress
		const validationLength = padLeft(hexlify(validationData))
		const validationOffset = padLeft('0x60')
		const hookLength = padLeft('0x0')
		const hookOffset = padLeft(toBeHex(BigInt(validationOffset) + BigInt(validationLength) + BigInt('0x20')))
		const selectorLength = padLeft('0x0')
		const selectorOffset = padLeft(toBeHex(BigInt(hookOffset) + BigInt('0x20')))

		return concat([
			hook,
			validationOffset,
			hookOffset,
			selectorOffset,
			validationLength,
			validationData,
			hookLength,
			selectorLength,
		])
	}

	async getUninstallModuleDeInitData() {
		return '0x'
	}
}
