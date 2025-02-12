import { HttpError, JsonRpcError, normalizeError, SendopError } from './error'

export type RpcRequest = {
	readonly method: string
	readonly params?: readonly unknown[] | object
}

type BatchResponse = {
	status: 'fulfilled' | 'rejected'
	value?: unknown
	reason?: string
	id: number
	method: string
}

export class RpcProvider {
	readonly url: string

	constructor(url: string) {
		this.url = url
	}

	async send(request: RpcRequest) {
		// console.log('Sending request:', request)
		let response
		try {
			response = await fetch(this.url, {
				method: 'post',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					method: request.method,
					id: 1,
					params: request.params,
				}),
			})
		} catch (error: unknown) {
			const err = normalizeError(error)
			throw new SendopError(err.message, { cause: err })
		}

		const data = await response.json()
		// console.log('data', data)
		if (data.error) {
			// Note that data.error.data is specific to Alchemy
			const errMsg = data.error.code
				? `${request.method} (${data.error.code}): ${data.error.message}${
						data.error.data ? ` - ${JSON.stringify(data.error.data)}` : ''
				  }`
				: `${request.method}: ${data.error.message}${
						data.error.data ? ` - ${JSON.stringify(data.error.data)}` : ''
				  }`
			throw new JsonRpcError(errMsg)
		}

		if (!response.ok) {
			const errorText = await response.text()
			throw new HttpError(`status: ${response.status}, message: ${errorText}`)
		}

		return data.result
	}

	async sendBatch(requests: RpcRequest[]): Promise<BatchResponse[]> {
		let response
		try {
			response = await fetch(this.url, {
				method: 'post',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(
					requests.map((req, index) => ({
						jsonrpc: '2.0',
						method: req.method,
						id: index + 1,
						params: req.params,
					})),
				),
			})
		} catch (error: unknown) {
			const err = normalizeError(error)
			throw new SendopError(err.message, { cause: err })
		}

		if (!response.ok) {
			throw new HttpError(`status: ${response.status}`)
		}

		const results = await response.json()

		return results.map((result: any, index: number) => {
			if (result.error) {
				return {
					status: 'rejected' as const,
					reason: `${result.error.message}${result.error.code ? ` (${result.error.code})` : ''}`,
					id: result.id,
					method: requests[index].method,
				}
			}
			return {
				status: 'fulfilled' as const,
				value: result.result,
				id: result.id,
				method: requests[index].method,
			}
		})
	}
}
