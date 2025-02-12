import { version } from '../package.json'

export const PACKAGE_VERSION = version

export class SendopError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'SendopError'
		this.message = `${this.message} (sendop@${PACKAGE_VERSION})`
	}
}

export class JsonRpcError extends SendopError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'JsonRpcError'
	}
}

export class HttpError extends SendopError {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options)
		this.name = 'HttpError'
	}
}

export function normalizeError(unknownError: unknown): Error {
	let err = new Error(String(unknownError))

	if (unknownError instanceof Error) {
		err = unknownError
	}

	return err
}
