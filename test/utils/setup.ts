import { createConsola } from 'consola'

const logger = createConsola({
	level: 4,
})

// 0: Fatal and Error
// 1: Warnings
// 2: Normal logs
// 3: Informational logs, success, fail, ready, start, ...
// 4: Debug logs
// 5: Trace logs
// -999: Silent
// +999: Verbose logs

// consola.info("Using consola 3.0.0");
// consola.start("Building project...");
// consola.warn("A new version of consola is available: 3.0.1");
// consola.success("Project built!");
// consola.error(new Error("This is an example error. Everything is fine!"));
// consola.box("I am a simple box");
// await consola.prompt("Deploy to the production?", {
//   type

export async function setup(options?: { chainId?: string }) {
	const { PRIVATE_KEY, ALCHEMY_API_KEY, PIMLICO_API_KEY, SALT, CHAIN_ID } = getEnv()

	const getClientUrl = (chainId: string) => {
		// Default to localhost
		if (chainId === 'local') {
			return 'http://localhost:8545'
		}
		// Existing network configs
		if (chainId === '11155111') {
			return `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
		} else if (chainId === '7078815900') {
			return 'https://rpc.mekong.ethpandaops.io'
		}
		throw new Error('Invalid chainId')
	}

	const getBundlerUrl = (chainId: string) => {
		if (chainId === 'local') {
			return 'http://localhost:3000'
		}
		return `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`
	}

	// Priority: setup({chainId}) > .env CHAIN_ID > 'local'
	const chainId = options?.chainId || CHAIN_ID || 'local'

	const CLIENT_URL = getClientUrl(chainId)
	const BUNDLER_URL = getBundlerUrl(chainId)

	// If using local network, fetch actual chainId from the network
	let actualChainId = chainId
	if (chainId === 'local') {
		try {
			const response = await fetch(CLIENT_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					jsonrpc: '2.0',
					method: 'eth_chainId',
					params: [],
					id: 1,
				}),
			})
			const data = await response.json()
			actualChainId = parseInt(data.result, 16).toString()
		} catch (error) {
			logger.warn('Failed to fetch chainId from local network, using default')
		}
	}

	return {
		logger,
		chainId: actualChainId,
		CLIENT_URL,
		BUNDLER_URL,
		PRIVATE_KEY: PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // default to private key from anvil account 0
		SALT,
	}
}

export function getEnv() {
	if (!process.env.PIMLICO_API_KEY || !process.env.ALCHEMY_API_KEY || !process.env.PRIVATE_KEY) {
		throw new Error('Missing .env')
	}

	const PRIVATE_KEY = process.env.PRIVATE_KEY
	const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
	const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY
	const SALT = process.env.SALT || '0x0000000000000000000000000000000000000000000000000000000000000001'
	const CHAIN_ID = process.env.CHAIN_ID

	return {
		PRIVATE_KEY,
		ALCHEMY_API_KEY,
		PIMLICO_API_KEY,
		SALT,
		CHAIN_ID,
	}
}

export function askForChainId() {
	const defaultChainId = '11155111'
	const chainIdInput = prompt('Enter chainId (defaults to 11155111):')
	const chainId =
		chainIdInput === 's' ? defaultChainId : chainIdInput === 'm' ? '7078815900' : chainIdInput || defaultChainId

	logger.info(`ChainId: ${chainId}`)
	return chainId
}
