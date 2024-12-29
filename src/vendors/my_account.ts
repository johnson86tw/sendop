import { type Execution } from '@/core'
import { abiEncode, padLeft } from '@/utils/ethers'
import {
	concat,
	Contract,
	hexlify,
	Interface,
	isAddress,
	JsonRpcProvider,
	toBeHex,
	zeroPadValue,
	type BytesLike,
} from 'ethers'
import { MY_ACCOUNT_FACTORY_ADDRESS } from 'test/utils/addresses'
import type { AccountCreatingVendor } from '../types'

export class MyAccount implements AccountCreatingVendor {
	static readonly accountId = 'johnson86tw.0.0.1'
	#client?: JsonRpcProvider
	#creationOptions?: {
		salt: BytesLike
		validatorAddress: string
		owner: string
	}

	constructor(
		clientUrl?: string,
		creationOptions?: {
			salt: BytesLike
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
		return MyAccount.accountId
	}

	async getNonceKey(validator: string) {
		return padLeft(validator, 24)
	}

	async getAddress(): Promise<string> {
		if (!this.#client) {
			throw new Error('Client is not set')
		}

		if (!this.#creationOptions) {
			throw new Error('Creation options are not set')
		}

		const { salt, validatorAddress, owner } = this.#creationOptions
		const myAccountFactory = new Contract(
			MY_ACCOUNT_FACTORY_ADDRESS,
			['function getAddress(uint256 salt, address validator, bytes calldata data) public view returns (address)'],
			this.#client,
		)
		const address = await myAccountFactory['getAddress(uint256,address,bytes)'](salt, validatorAddress, owner)

		if (!isAddress(address)) {
			throw new Error('Failed to get new address')
		}

		return address
	}

	getInitCode() {
		if (!this.#creationOptions) {
			throw new Error('Creation options are not set')
		}

		const { salt, validatorAddress, owner } = this.#creationOptions
		return concat([
			MY_ACCOUNT_FACTORY_ADDRESS,
			new Interface([
				'function createAccount(uint256 salt, address validator, bytes calldata data)',
			]).encodeFunctionData('createAccount', [salt, validatorAddress, owner]),
		])
	}

	async getCallData(from: string, executions: Execution[]) {
		if (!executions.length) {
			return '0x'
		}

		let callData

		// if one of the execution is to SA itself, it must be a single execution
		if (executions.some(execution => execution.to === from)) {
			if (executions.length > 1) {
				throw new Error('If one of the execution is to SA itself, it must be a single execution')
			}

			callData = executions[0].data
		} else {
			/**
			 * ModeCode:
			 * |--------------------------------------------------------------------|
			 * | CALLTYPE  | EXECTYPE  |   UNUSED   | ModeSelector  |  ModePayload  |
			 * |--------------------------------------------------------------------|
			 * | 1 byte    | 1 byte    |   4 bytes  | 4 bytes       |   22 bytes    |
			 * |--------------------------------------------------------------------|
			 */
			const callType = executions.length > 1 ? '0x01' : '0x00'
			const modeCode = concat([
				callType,
				'0x00',
				'0x00000000',
				'0x00000000',
				'0x00000000000000000000000000000000000000000000',
			])

			const executionsData = executions.map(execution => ({
				target: execution.to || '0x',
				value: BigInt(execution.value || '0x0'),
				data: execution.data || '0x',
			}))

			let executionCalldata
			if (callType === '0x01') {
				// batch execution
				executionCalldata = abiEncode(
					['tuple(address,uint256,bytes)[]'],
					[executionsData.map(execution => [execution.target, execution.value, execution.data])],
				)
			} else {
				// single execution
				executionCalldata = concat([
					executionsData[0].target,
					zeroPadValue(toBeHex(executionsData[0].value), 32),
					executionsData[0].data,
				])
			}

			callData = new Interface([
				'function execute(bytes32 mode, bytes calldata executionCalldata)',
			]).encodeFunctionData('execute', [modeCode, executionCalldata])
		}

		if (!callData) {
			throw new Error('Failed to build callData')
		}

		return callData
	}

	async getInstallModuleInitData(initData: BytesLike) {
		return hexlify(initData)
	}

	async getUninstallModuleDeInitData(
		accountAddress: string,
		clientUrl: string,
		uninstallModuleAddress: string,
	): Promise<string> {
		const myAccount = new Contract(
			accountAddress,
			[
				'function getValidatorsPaginated(address cursor, uint256 size) external view returns (address[] memory array, address next)',
			],
			new JsonRpcProvider(clientUrl),
		)

		const validators = await myAccount.getValidatorsPaginated(padLeft('0x1', 20), 5)
		const prev = findPrevious(validators.array, uninstallModuleAddress)
		function findPrevious(array: string[], entry: string): string {
			for (let i = 0; i < array.length; i++) {
				if (array[i].toLowerCase() === entry.toLowerCase()) {
					if (i === 0) {
						return padLeft('0x1', 20)
					} else {
						return array[i - 1]
					}
				}
			}
			throw new Error('Entry not found in array')
		}

		const deInitData = abiEncode(['address', 'bytes'], [prev, '0x'])

		return deInitData
	}
}
