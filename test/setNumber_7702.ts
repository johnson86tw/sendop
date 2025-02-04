import { sendop } from '@/core'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS, COUNTER_ADDRESS, MyPaymaster, setup } from './utils'
import { PimlicoBundler } from '@/bundler'
import { MyAccount } from '@/smart_accounts'
import { ECDSA_VALIDATOR_ADDRESS } from '@/address'

// error: AccountAccessUnauthorized()

const { logger, chainId, CLIENT_URL, BUNDLER_URL, privateKey } = await setup()
logger.info(`Chain ID: ${chainId}`)

const signer = new Wallet(privateKey)
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
			to: COUNTER_ADDRESS,
			data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
			value: '0x0',
		},
	],
	opGetter: new MyAccount(FROM, {
		client,
		bundler: new PimlicoBundler(chainId, BUNDLER_URL),
		erc7579Validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR_ADDRESS,
			client,
			signer: new Wallet(privateKey),
		}),
	}),
	pmGetter: new MyPaymaster({
		client,
		paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
	}),
})

logger.info('Waiting for receipt...')
const receipt = await op.wait()
logger.info(JSON.stringify(receipt, null, 2))

if (receipt.logs.length > 0) {
	const log = receipt.logs[receipt.logs.length - 1]
	logger.info(toNumber(log.data))
}
