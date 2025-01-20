import { sendop } from '@/core'
import { MyAccount, MyPaymaster, PimlicoBundler } from '@/index'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR, setup } from './utils'

// error: AccountAccessUnauthorized()

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({
	chainId: '7078815900',
})
logger.info(`Chain ID: ${chainId}`)

const signer = new Wallet(PRIVATE_KEY)
const signerAddress = await signer.getAddress()

const FROM = signerAddress

const number = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${number}`)

const client = new JsonRpcProvider(CLIENT_URL)

logger.info('Sending op...')
const op = await sendop({
	bundler: new PimlicoBundler(chainId, BUNDLER_URL),
	executions: [
		{
			to: COUNTER,
			data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
			value: '0x0',
		},
	],
	opGetter: new MyAccount(FROM, {
		client,
		bundler: new PimlicoBundler(chainId, BUNDLER_URL),
		erc7579Validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			client,
			signer: new Wallet(PRIVATE_KEY),
		}),
	}),
	pmGetter: new MyPaymaster({
		client,
		paymasterAddress: CHARITY_PAYMASTER,
	}),
})

logger.info('Waiting for receipt...')
const receipt = await op.wait()
logger.info(JSON.stringify(receipt, null, 2))

if (receipt.logs.length > 0) {
	const log = receipt.logs[receipt.logs.length - 1]
	logger.info(toNumber(log.data))
}
