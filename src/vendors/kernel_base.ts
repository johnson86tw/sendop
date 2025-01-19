import type { Execution } from '@/core'
import { abiEncode, padLeft } from '@/utils/ethers'
import type { BytesLike } from 'ethers'
import { concat, hexlify, Interface, toBeHex, ZeroAddress } from 'ethers'
import type { Vendor } from '../types'

export class KernelBase implements Vendor {
	static readonly accountId = 'kernel.advanced.v0.3.1'

	static readonly kernelInterface = new Interface([
		'function initialize(bytes21 _rootValidator, address hook, bytes calldata validatorData, bytes calldata hookData, bytes[] calldata initConfig) external',
		'function execute(bytes32 execMode, bytes calldata executionCalldata)',
	])

	static readonly kernelFactoryInterface = new Interface([
		'function createAccount(bytes calldata data, bytes32 salt) public payable returns (address)',
		'function getAddress(bytes calldata data, bytes32 salt) public view returns (address)',
	])

	accountId() {
		return KernelBase.accountId
	}

	kernelInterface() {
		return KernelBase.kernelInterface
	}

	kernelFactoryInterface() {
		return KernelBase.kernelFactoryInterface
	}

	/**
	 * see kernel "function decodeNonce"
	 * 1byte mode  | 1byte type | 20bytes identifierWithoutType | 2byte nonceKey | 8byte nonce == 32bytes
	 */
	async getNonceKey(validator: string) {
		// TODO: custom nonce key when constructing kernel
		return concat(['0x00', '0x00', validator, '0x0000'])
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

		return this.kernelInterface().encodeFunctionData('execute', [execMode, executionCalldata])
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
