import { sendop } from '@/sendop'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { MyAccount } from '@/vendors/my_account'
import { Interface, toNumber, Wallet } from 'ethers'
import { addresses } from './utils/addresses'
import { setup } from './utils/setup'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()

const VALIDATOR_ADDRESS = addresses[chainId].ECDSA_VALIDATOR
const COUNTER_ADDRESS = addresses[chainId].COUNTER

const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'
const vendor = new MyAccount()

const num = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${num}`)

logger.info('Sending op...')
const op = await sendop({
	networkInfo: {
		chainId,
		clientUrl: CLIENT_URL,
		bundlerUrl: BUNDLER_URL,
	},
	validator: new ECDSAValidator({
		address: VALIDATOR_ADDRESS,
		clientUrl: CLIENT_URL,
		signer: new Wallet(PRIVATE_KEY),
	}),
	vendor,
	from: FROM,
	executions: [
		{
			to: COUNTER_ADDRESS,
			data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [num]),
			value: '0x0',
		},
	],
	paymaster: BUNDLER_URL,
})

logger.info('Waiting for receipt...')
const receipt = await op.wait()
logger.info(receipt)

if (receipt.logs.length > 0) {
	const log = receipt.logs[receipt.logs.length - 1]
	logger.info(toNumber(log.data))
}
