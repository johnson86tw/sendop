import { AbiCoder, Interface, ParamType, zeroPadBytes, zeroPadValue } from 'ethers'

export const ERC7579Interface = new Interface([
	'function installModule(uint256 moduleType, address module, bytes calldata initData)',
	'function uninstallModule(uint256 moduleType, address module, bytes calldata deInitData)',
])

export function is32BytesHexString(data: string) {
	return data.startsWith('0x') && data.length === 66
}

export function padLeft(data: string, length: number = 32) {
	if (!data.startsWith('0x')) {
		throw new Error('data must start with 0x')
	}
	if (data.length % 2 !== 0) {
		data = data.slice(0, 2) + '0' + data.slice(2)
	}
	return zeroPadValue(data, length)
}

export function padRight(data: string, length: number = 32) {
	if (!data.startsWith('0x')) {
		throw new Error('data must start with 0x')
	}
	if (data.length % 2 !== 0) {
		data = data.slice(0, 2) + '0' + data.slice(2)
	}
	return zeroPadBytes(data, length)
}

export function abiEncode(types: ReadonlyArray<string | ParamType>, values: ReadonlyArray<any>): string {
	return new AbiCoder().encode(types, values)
}
