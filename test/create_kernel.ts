import { sendop } from '@/core'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { Kernel } from '@/vendors/kernel'
import { JsonRpcProvider, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, ECDSA_VALIDATOR } from './utils/addresses'
import { PimlicoBundler } from './utils/bundler'
import { ExecBuilder } from './utils/exec_builders'
import { MyPaymaster } from './utils/pm_builders'
import { setup } from './utils/setup'

// 0x71d59e7f1fc4A6574A9C91264614bFd9F9e9B4A9

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY, SALT } = setup()

const creationParams: [string, string, string] = [ECDSA_VALIDATOR, await new Wallet(PRIVATE_KEY).getAddress(), SALT]

const deployedAddress = await new Kernel().getAddress(new JsonRpcProvider(CLIENT_URL), ...creationParams)
const FROM = deployedAddress

logger.info('Chain ID', chainId)
logger.info(`Deployed address: ${deployedAddress}`)
const confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

logger.info('Sending op...')
const op = await sendop({
	bundler: new PimlicoBundler(chainId, BUNDLER_URL),
	from: FROM,
	executions: [],
	execBuilder: new ExecBuilder({
		client: new JsonRpcProvider(CLIENT_URL),
		vendor: new Kernel(),
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
logger.info(receipt)
