import { sendop } from '@/sendop'
import { ECDSAValidator } from '@/validators/ECDSAValidator'
import { MyAccount } from '@/vendors/MyAccount'
import { Interface, toNumber, Wallet } from 'ethers'
import { addresses, toNetwork } from './utils/network'
import { MyPaymaster } from './utils/myPaymaster'
import { setup } from './utils/setup'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()

const sender = addresses[toNetwork(chainId)].MY_ACCOUNT

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
		address: addresses[toNetwork(chainId)].ECDSA_VALIDATOR,
		clientUrl: CLIENT_URL,
		signer: new Wallet(PRIVATE_KEY),
	}),
	vendor: new MyAccount(),
	from: sender,
	executions: [
		{
			to: addresses[toNetwork(chainId)].COUNTER,
			data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [num]),
			value: '0x0',
		},
	],
	paymaster: new MyPaymaster({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: addresses[toNetwork(chainId)].CHARITY_PAYMASTER,
	}),
})

logger.info('Waiting for receipt...')
const receipt = await op.wait()
logger.info(receipt)

if (receipt.logs.length > 0) {
	const log = receipt.logs[receipt.logs.length - 1]
	logger.info(toNumber(log.data))
}
