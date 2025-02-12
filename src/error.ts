import { isError, type ErrorCode } from 'ethers'
import type { ethers } from 'ethers'

export class SendopError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'SendopError'
	}
}

export class RpcProviderError extends SendopError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'RpcProviderError'
	}
}
