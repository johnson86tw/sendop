import { ECDSA_VALIDATOR_ADDRESS } from '@/address'
import { ENTRY_POINT_V07, getEmptyUserOp, sendop, type Bundler } from '@/core'
import { Kernel } from '@/smart_accounts'
import { getEntryPointContract, RpcProvider } from '@/utils'
import { ECDSAValidator } from '@/validators'
import { hexlify, Interface, JsonRpcProvider, parseEther, randomBytes, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS, COUNTER_ADDRESS, MyPaymaster, setup } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { AlchemyBundler } from './AlchemyBundler'
import { PimlicoBundler } from './PimlicoBundler'

const {
	logger,
	chainId,
	ALCHEMY_API_KEY,
	privateKey,
	CLIENT_URL,
	BUNDLER_URL: PIMLICO_BUNDLER_URL,
} = await setup({
	chainId: '11155111',
})

logger.info(`Chain ID: ${chainId}`)

const BUNDLER_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

describe('AlchemyBundler', () => {
	let rpcProvider: RpcProvider
	let alchemyBundler: Bundler
	let client: JsonRpcProvider
	let signer: Wallet

	beforeAll(() => {
		rpcProvider = new RpcProvider(BUNDLER_URL)
		alchemyBundler = new AlchemyBundler(chainId, BUNDLER_URL)
		client = new JsonRpcProvider(CLIENT_URL)
		signer = new Wallet(privateKey, client)
	})

	let gasPrice: string
	let maxPriorityFeePerGas: string

	it('should get gas price by eth_gasPrice', async () => {
		const _gasPrice = (await rpcProvider.send({ method: 'eth_gasPrice' })) as string // hex string
		if (!_gasPrice || _gasPrice === '0x0' || _gasPrice === '0x') {
			throw new Error('Invalid gas price response from bundler')
		}
		logger.info(`Gas price: ${_gasPrice}`)
		expect(_gasPrice).toBeDefined()
		gasPrice = _gasPrice
	})

	it('should get baseFeePerGas by eth_getBlockByNumber', async () => {
		const _baseFeePerGas = await rpcProvider.send({ method: 'eth_getBlockByNumber', params: ['latest', true] })
		logger.info(`baseFeePerGas: ${_baseFeePerGas}`)
		expect(_baseFeePerGas).toBeDefined()
	})

	it('should get maxPriorityFeePerGas by rundler_maxPriorityFeePerGas', async () => {
		const _maxPriorityFeePerGas = await rpcProvider.send({ method: 'rundler_maxPriorityFeePerGas' })
		logger.info(`maxPriorityFeePerGas: ${_maxPriorityFeePerGas}`)
		expect(_maxPriorityFeePerGas).toBeDefined()
		maxPriorityFeePerGas = _maxPriorityFeePerGas
	})

	it('should estimate userop gas by eth_estimateUserOperationGas', async () => {
		// Create a test userop for kernel deployment
		const creationOptions = {
			salt: hexlify(randomBytes(32)), // random salt
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await signer.getAddress(),
		}

		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client,
			bundler: new AlchemyBundler(chainId, BUNDLER_URL),
			erc7579Validator: new ECDSAValidator({
				address: ECDSA_VALIDATOR_ADDRESS,
				client,
				signer,
			}),
		})

		const userOp = getEmptyUserOp()
		userOp.sender = await kernel.getSender()
		const initCode = kernel.getInitCode(creationOptions)

		const initCodeWithoutPrefix = initCode.slice(2) // remove 0x prefix
		userOp.factory = '0x' + initCodeWithoutPrefix.slice(0, 40)
		userOp.factoryData = '0x' + initCodeWithoutPrefix.slice(40)

		userOp.nonce = await kernel.getNonce()
		userOp.callData = await kernel.getCallData([])
		userOp.signature = await kernel.getDummySignature()
		userOp.maxFeePerGas = gasPrice
		userOp.maxPriorityFeePerGas = maxPriorityFeePerGas

		// Send request for gas estimation
		const gasValues = await rpcProvider.send({
			method: 'eth_estimateUserOperationGas',
			params: [userOp, ENTRY_POINT_V07],
		})

		logger.info(`Gas values: ${JSON.stringify(gasValues)}`)

		expect(gasValues.preVerificationGas).toBeDefined()
		expect(gasValues.callGasLimit).toBeDefined()
		expect(gasValues.verificationGasLimit).toBeDefined()
		expect(gasValues.paymasterVerificationGasLimit).toBeNull()
		expect(gasValues.paymasterPostOpGasLimit).toBeUndefined()
	})

	it('should deploy kernel with PimlicoBundler and set number with Alchemy Bundler without paymaster', async () => {
		const pimlicoBundler = new PimlicoBundler(chainId, PIMLICO_BUNDLER_URL)

		const myPaymaster = new MyPaymaster({
			client,
			paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
		})

		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await new Wallet(privateKey).getAddress(),
		}

		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: pimlicoBundler,
			erc7579Validator: new ECDSAValidator({
				address: ECDSA_VALIDATOR_ADDRESS,
				client,
				signer,
			}),
			pmGetter: myPaymaster,
		})

		const op = await kernel.deploy(creationOptions)
		logger.info(`hash: ${op.hash}`)
		await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')

		// deposit 0.01 eth to entrypoint for kernel to set number
		const entrypoint = getEntryPointContract(signer)
		const tx = await entrypoint.depositTo(deployedAddress, { value: parseEther('0.01') })
		await tx.wait()

		// check balance of deployed address
		const balance = await entrypoint.balanceOf(deployedAddress)
		expect(balance).toBe(parseEther('0.01'))

		const number = Math.floor(Math.random() * 10000)

		const op2 = await sendop({
			bundler: alchemyBundler,
			executions: [
				{
					to: COUNTER_ADDRESS,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: kernel,
		})

		logger.info(`hash: ${op2.hash}`)
		const receipt = await op2.wait()
		console.log('receipt', receipt)

		const log = receipt.logs[receipt.logs.length - 1]
		expect(toNumber(log.data)).toBe(number)
	}, 200000)

	it.skip('cannot deploy kernel with PimlicoBundler and set number with Alchemy Bundler with charity paymaster', async () => {
		const pimlicoBundler = new PimlicoBundler(chainId, PIMLICO_BUNDLER_URL)

		const myPaymaster = new MyPaymaster({
			client,
			paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
		})

		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await new Wallet(privateKey).getAddress(),
		}

		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: pimlicoBundler,
			erc7579Validator: new ECDSAValidator({
				address: ECDSA_VALIDATOR_ADDRESS,
				client,
				signer,
			}),
			pmGetter: myPaymaster,
		})

		const op = await kernel.deploy(creationOptions)
		logger.info(`hash: ${op.hash}`)
		await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')

		const number = Math.floor(Math.random() * 10000)

		const op2 = await sendop({
			bundler: alchemyBundler,
			executions: [
				{
					to: COUNTER_ADDRESS,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
					value: '0x0',
				},
			],
			opGetter: kernel,
			pmGetter: myPaymaster,
		})

		logger.info(`hash: ${op2.hash}`)
		const receipt = await op2.wait()
		const log = receipt.logs[receipt.logs.length - 1]
		expect(toNumber(log.data)).toBe(number)
	}, 100000)

	// error: JSON-RPC Error: eth_sendUserOperation (-32502): Sender storage at (address: 0xa454cbe9a4077e27684242f88d959ba0ea7657b3 slot: 0xbe55d3a7367afc8f11e8660685ae16561c5dd7f65775e84cb5e06a64601e7d76) accessed during deployment. Factory (or None) must be staked
	it.skip('cannot deploy kernel with AlchemyBundler', async () => {
		const creationOptions = {
			salt: hexlify(randomBytes(32)),
			validatorAddress: ECDSA_VALIDATOR_ADDRESS,
			owner: await new Wallet(privateKey).getAddress(),
		}

		const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

		const kernel = new Kernel(deployedAddress, {
			client: new JsonRpcProvider(CLIENT_URL),
			bundler: alchemyBundler,
			erc7579Validator: new ECDSAValidator({
				address: ECDSA_VALIDATOR_ADDRESS,
				client,
				signer,
			}),
		})

		const op = await sendop({
			bundler: alchemyBundler,
			executions: [],
			opGetter: kernel,
			pmGetter: new MyPaymaster({
				client,
				paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
			}),
			initCode: kernel.getInitCode(creationOptions),
		})

		logger.info(`hash: ${op.hash}`)
		await op.wait()
		logger.info('deployed address: ', deployedAddress)

		const code = await client.getCode(deployedAddress)
		expect(code).not.toBe('0x')
	}, 100000)

	// Alchemy error: Unsupported method: rundler_maxPriorityFeePerGas
	it.skip('should batch request gas price and maxPriorityFeePerGas', async () => {
		const batchRequests = [{ method: 'eth_gasPrice' }, { method: 'rundler_maxPriorityFeePerGas' }]

		const results = await rpcProvider.sendBatch(batchRequests)
		logger.info(`Batch results: ${JSON.stringify(results)}`)

		// Verify both requests were successful
		expect(results.length).toBe(2)
		expect(results.every(r => r.status === 'fulfilled')).toBe(true)

		// Check gas price response
		const gasPriceResponse = results[0]
		expect(gasPriceResponse.method).toBe('eth_gasPrice')
		const gasPrice = gasPriceResponse.value as string
		expect(gasPrice).toBeDefined()
		expect(gasPrice).not.toBe('0x0')
		expect(gasPrice).not.toBe('0x')

		// Check maxPriorityFeePerGas response
		const maxPriorityResponse = results[1]
		expect(maxPriorityResponse.method).toBe('rundler_maxPriorityFeePerGas')
		expect(maxPriorityResponse.value).toBeDefined()

		logger.info(`Batch results - Gas price: ${gasPrice}, maxPriorityFeePerGas: ${maxPriorityResponse.value}`)
	})
})
