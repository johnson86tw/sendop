import type { ERC7579Validator } from '../core/types'

type ConstructorOptions = {
	address: string
}

export class WebAuthnValidator implements ERC7579Validator {
	#address: string

	constructor(options: ConstructorOptions) {
		this.#address = options.address
	}

	address() {
		return this.#address
	}

	getDummySignature() {
		return '0x00000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000137ba8c8a623fb93a97eab804405de6ff60d0a042fffbf31e242425128fdb49bb0677d1ede103a47aa4fd1189244c5d253e7f47de8de26d3f83330332db4dacc20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002549960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000867b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a225278637968616a584e4235656c795f476479686a685067432d4f394370657866413776364a557977483630222c226f726967696e223a22687474703a2f2f6c6f63616c686f73743a35313733222c2263726f73734f726967696e223a66616c73657d0000000000000000000000000000000000000000000000000000'
	}

	async getSignature(userOpHash: string) {
		const signature = prompt('Please input the signature')
		if (!signature) {
			throw new Error('Signature is required')
		}
		return signature
	}

	async getAccounts(): Promise<string[]> {
		// TODO: signer needs to have webauthn public key
		return []
	}
}
