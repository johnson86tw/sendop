import { Kernel } from '@/index'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { hexlify, JsonRpcProvider, randomBytes, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, ECDSA_VALIDATOR, MyPaymaster, PimlicoBundler, setup } from './utils'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup()

const creationOptions = {
	salt: hexlify(randomBytes(32)),
	validatorAddress: ECDSA_VALIDATOR,
	owner: await new Wallet(PRIVATE_KEY).getAddress(),
}

const kernel = new Kernel({
	client: new JsonRpcProvider(CLIENT_URL),
	bundler: new PimlicoBundler(chainId, BUNDLER_URL),
	validator: new ECDSAValidator({
		address: ECDSA_VALIDATOR,
		clientUrl: CLIENT_URL,
		signer: new Wallet(PRIVATE_KEY),
	}),
	pmGetter: new MyPaymaster({
		chainId,
		clientUrl: CLIENT_URL,
		paymasterAddress: CHARITY_PAYMASTER,
	}),
	creationOptions,
})
const deployedAddress = await kernel.getAddress()

logger.info('Chain ID', chainId)
logger.info(`Creation options: ${JSON.stringify(creationOptions)}`)
logger.info(`Deployed address: ${deployedAddress}`)

const confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

logger.info('Sending op...')
const op = await kernel.deploy()

logger.info('Waiting for receipt...')
const receipt = await op.wait()
logger.info(receipt)
