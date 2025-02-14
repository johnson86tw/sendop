import { ENTRY_POINT_V07 } from '@/core'
import { SendopError } from '@/error'
import type { ContractRunner, ParamType } from 'ethers'
import { AbiCoder, Contract, getAddress, Interface, zeroPadBytes, zeroPadValue } from 'ethers'

export const ERC7579Interface = new Interface([
	'function installModule(uint256 moduleType, address module, bytes calldata initData)',
	'function uninstallModule(uint256 moduleType, address module, bytes calldata deInitData)',
])

export const EntryPointInterface = new Interface([
	'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
	'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
	'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external',
])

export function getEntryPointContract(runner: ContractRunner) {
	return new Contract(
		ENTRY_POINT_V07,
		[
			'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature) userOp) external view returns (bytes32)',
			'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
			'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, bytes32 accountGasLimits, uint256 preVerificationGas, bytes32 gasFees, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary) external',
			'function depositTo(address account)',
			'function balanceOf(address account) public view returns (uint256)',
		],
		runner,
	)
}

export function is32BytesHexString(data: string) {
	return data.startsWith('0x') && data.length === 66
}

export function padLeft(data: string, length: number = 32) {
	if (!data.startsWith('0x')) {
		throw new EthersHelperError('data must start with 0x in padLeft')
	}
	if (data.length % 2 !== 0) {
		data = data.slice(0, 2) + '0' + data.slice(2)
	}
	return zeroPadValue(data, length)
}

export function padRight(data: string, length: number = 32) {
	if (!data.startsWith('0x')) {
		throw new EthersHelperError('data must start with 0x in padRight')
	}
	if (data.length % 2 !== 0) {
		data = data.slice(0, 2) + '0' + data.slice(2)
	}
	return zeroPadBytes(data, length)
}

export function abiEncode(types: ReadonlyArray<string | ParamType>, values: ReadonlyArray<any>): string {
	return new AbiCoder().encode(types, values)
}

export function isSameAddress(address1: string, address2: string) {
	return getAddress(address1) === getAddress(address2)
}

export class EthersHelperError extends SendopError {
	constructor(message: string, cause?: Error) {
		super(message, cause)
		this.name = 'EthersHelperError'
	}
}
