import { sendop } from '@/core'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { MyAccount } from '@/vendors/my_account'
import { Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, COUNTER, ECDSA_VALIDATOR } from './utils/addresses'
import { PimlicoBundler } from './utils/bundler'
import { ExecBuilder } from './utils/exec_builders'
import { MyPaymaster } from './utils/pm_builders'
import { setup } from './utils/setup'

// error: AccountAccessUnauthorized()

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()
logger.info(`Chain ID: ${chainId}`)

const signer = new Wallet(PRIVATE_KEY)
const signerAddress = await signer.getAddress()

const FROM = signerAddress

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
	execBuilder: new ExecBuilder({
		client: new JsonRpcProvider(CLIENT_URL),
		vendor: new MyAccount(),
		validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			clientUrl: CLIENT_URL,
			signer: new Wallet(PRIVATE_KEY),
		}),
		from: FROM,
	}),
	pmBuilder: new MyPaymaster({
		chainId,
		clientUrl: CLIENT_URL,
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
