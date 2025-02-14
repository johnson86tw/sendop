import { ECDSA_VALIDATOR_ADDRESS } from '@/address'
import { AlchemyBundler } from '@/bundlers/AlchemyBundler'
import { sendop } from '@/core'
import { Kernel } from '@/smart_accounts'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { getAddress, Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS, COUNTER_ADDRESS, MyPaymaster, setup } from './utils'

const { logger, chainId, CLIENT_URL, ALCHEMY_BUNDLER_URL, privateKey } = await setup({ chainId: '11155111' })
logger.info(`Chain ID: ${chainId}`)

const FROM = '0x69F062dA4F6e200e235F66e151E2733E5ed306b9' // kernel on sepolia

const number = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${number}`)

const client = new JsonRpcProvider(CLIENT_URL)
const bundler = new AlchemyBundler(chainId, ALCHEMY_BUNDLER_URL)
const signer = new Wallet(privateKey)

logger.info('Sending op...')
const op = await sendop({
	bundler,
	executions: [
		{
			to: COUNTER_ADDRESS,
			data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
			value: '0x0',
		},
	],
	opGetter: new Kernel(FROM, {
		client,
		bundler,
		erc7579Validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR_ADDRESS,
			client,
			signer,
		}),
	}),
	pmGetter: new MyPaymaster({
		client,
		paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
	}),
})

const startTime = Date.now()
logger.info('Waiting for receipt...')
const receipt = await op.wait()
const duration = (Date.now() - startTime) / 1000 // Convert to seconds
logger.info(`Receipt received after ${duration.toFixed(2)} seconds`)

const log = receipt.logs.find(log => getAddress(log.address) === getAddress(COUNTER_ADDRESS))
if (log && toNumber(log.data) === number) {
	logger.info(`Number ${number} set successfully`)
} else {
	logger.error(`Number ${number} not set`)
	logger.info(receipt)
}
