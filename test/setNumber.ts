import { sendop } from '@/core'
import { MyPaymaster, PimlicoBundler } from '@/index'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { MyAccount } from '@/vendors/my_account'
import { Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR, setup } from './utils'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()
logger.info(`Chain ID: ${chainId}`)

const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'

const number = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${number}`)

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
		client: new JsonRpcProvider(CLIENT_URL),
		bundler: new PimlicoBundler(chainId, BUNDLER_URL),
		erc7579Validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			client: new JsonRpcProvider(CLIENT_URL),
			signer: new Wallet(PRIVATE_KEY),
		}),
	}),
	pmGetter: new MyPaymaster({
		client: new JsonRpcProvider(CLIENT_URL),
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
