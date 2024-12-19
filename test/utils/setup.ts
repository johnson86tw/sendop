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

export function setup(options?: { chainId?: string }) {
	const { PRIVATE_KEY, ALCHEMY_API_KEY, PIMLICO_API_KEY } = getEnv()

	const chainId = options?.chainId || askForChainId()

	const toChainName = (chainId: string): string => {
		if (chainId === '11155111') {
			return 'sepolia'
		} else if (chainId === '7078815900') {
			return 'mekong'
		}

		throw new Error('Invalid chainId')
	}

	const CLIENT_URL = `https://eth-${toChainName(chainId)}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
	const BUNDLER_URL = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${PIMLICO_API_KEY}`

	return {
		logger,
		chainId,
		CLIENT_URL,
		BUNDLER_URL,
		PRIVATE_KEY,
	}
}

export function getEnv() {
	if (!process.env.PIMLICO_API_KEY || !process.env.ALCHEMY_API_KEY || !process.env.PRIVATE_KEY) {
		throw new Error('Missing .env')
	}

	const PRIVATE_KEY = process.env.PRIVATE_KEY
	const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
	const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY

	return {
		PRIVATE_KEY,
		ALCHEMY_API_KEY,
		PIMLICO_API_KEY,
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
