import { sendop } from '@/core'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { hexlify, JsonRpcProvider, randomBytes, Wallet } from 'ethers'
import { CHARITY_PAYMASTER, ECDSA_VALIDATOR, MyPaymaster, PimlicoBundler, setup } from './utils'
import { Kernel } from '@/index'
import { OpBuilder } from '@/OpBuilder'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY, SALT } = setup()

const creationOptions = {
	salt: hexlify(randomBytes(32)),
	validatorAddress: ECDSA_VALIDATOR,
	owner: await new Wallet(PRIVATE_KEY).getAddress(),
}
const vendor = new Kernel(CLIENT_URL, creationOptions)
const deployedAddress = await vendor.getAddress()
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
	opBuilder: new OpBuilder({
		client: new JsonRpcProvider(CLIENT_URL),
		vendor,
		validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			clientUrl: CLIENT_URL,
			signer: new Wallet(PRIVATE_KEY),
		}),
		from: FROM,
		isCreation: true,
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
