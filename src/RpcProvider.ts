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

		const response = await fetch(this.url, {
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

		const data = await response.json()
		// console.log('data', data)
		if (data.error) {
			// Note that data.error.data is specific to Alchemy
			const errorMessage = data.error.code
				? `JSON-RPC Error: ${request.method} (${data.error.code}): ${data.error.message}${
						data.error.data ? ` - ${JSON.stringify(data.error.data)}` : ''
				  }`
				: `JSON-RPC Error: ${request.method}: ${data.error.message}${
						data.error.data ? ` - ${JSON.stringify(data.error.data)}` : ''
				  }`
			throw new Error(errorMessage)
		}

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
		}

		return data.result
	}

	async sendBatch(requests: RpcRequest[]): Promise<BatchResponse[]> {
		const response = await fetch(this.url, {
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

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`)
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
