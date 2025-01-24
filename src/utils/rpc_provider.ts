export type RpcRequestArguments = {
	readonly method: string
	readonly params?: readonly unknown[] | object
}
export class RpcProvider {
	readonly url: string

	constructor(url: string) {
		this.url = url
	}

	async send(request: RpcRequestArguments) {
		// 	console.log('Sending request:', request)

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
		if (data.error) {
			const errorMessage = data.error.code
				? `JSON-RPC Error: ${request.method} (${data.error.code}): ${data.error.message}`
				: `JSON-RPC Error: ${request.method}: ${data.error.message}`
			throw new Error(errorMessage)
		}

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
		}

		return data.result
	}
}
