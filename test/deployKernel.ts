import { ECDSA_VALIDATOR_ADDRESS } from '@/address'
import { ECDSAValidator, Kernel, PimlicoBundler, sendop } from '@/index'
import { hexlify, JsonRpcProvider, randomBytes, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS, MyPaymaster, setup } from './utils'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, privateKey } = await setup({ chainId: '11155111' })

logger.info(`Chain ID: ${chainId}`)

const signer = new Wallet(privateKey)
const client = new JsonRpcProvider(CLIENT_URL)

const creationOptions = {
	salt: hexlify(randomBytes(32)), // random salt
	validatorAddress: ECDSA_VALIDATOR_ADDRESS,
	owner: await signer.getAddress(),
}

logger.info(`Salt: ${creationOptions.salt}`)

const deployedAddress = await Kernel.getNewAddress(client, creationOptions)

const kernel = new Kernel(deployedAddress, {
	client,
	bundler: new PimlicoBundler(chainId, BUNDLER_URL),
	erc7579Validator: new ECDSAValidator({
		address: ECDSA_VALIDATOR_ADDRESS,
		client,
		signer,
	}),
})

const op = await sendop({
	bundler: new PimlicoBundler(chainId, BUNDLER_URL),
	executions: [],
	opGetter: kernel,
	initCode: kernel.getInitCode(creationOptions),
	pmGetter: new MyPaymaster({
		client,
		paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
	}),
})

logger.info(`hash: ${op.hash}`)
await op.wait()
logger.info('deployed address: ', deployedAddress)
