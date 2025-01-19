import { sendop } from '@/core'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { MyAccount } from '@/vendors/my_account'
import { Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { COUNTER, ECDSA_VALIDATOR, PimlicoBundler, PimlicoPaymaster, setup } from './utils'
import { OpBuilder } from '@/OpBuilder'

// only works for sepolia

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()
logger.info(`Chain ID: ${chainId}`)

const FROM = '0x182260E0b7fF3B72DeAa6c99f1a50F2380a4Fb00'

const number = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${number}`)

logger.info('Sending op...')
const op = await sendop({
	bundler: new PimlicoBundler(chainId, BUNDLER_URL),
	from: FROM,
	executions: [
		{
			to: COUNTER,
			data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
			value: '0x0',
		},
	],
	opBuilder: new OpBuilder({
		client: new JsonRpcProvider(CLIENT_URL),
		vendor: new MyAccount(),
		validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			clientUrl: CLIENT_URL,
			signer: new Wallet(PRIVATE_KEY),
		}),
		from: FROM,
	}),
	pmBuilder: new PimlicoPaymaster({
		chainId,
		url: BUNDLER_URL,
	}),
})

logger.info('Waiting for receipt...')
const receipt = await op.wait()
logger.info(JSON.stringify(receipt, null, 2))

if (receipt.logs.length > 0) {
	const log = receipt.logs[receipt.logs.length - 1]
	logger.info(toNumber(log.data))
}
