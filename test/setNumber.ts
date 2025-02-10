import { sendop } from '@/core'
import { MyAccount } from '@/smart_accounts/my_account'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { Interface, JsonRpcProvider, toNumber, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS, COUNTER_ADDRESS, MyPaymaster, setup } from './utils'
import { ECDSA_VALIDATOR_ADDRESS } from '@/address'
import { AlchemyBundler } from '@/bundlers/AlchemyBundler'
import { PimlicoBundler } from '@/bundlers/PimlicoBundler'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, privateKey } = await setup({ chainId: '11155111' })
logger.info(`Chain ID: ${chainId}`)

const FROM = '0x69F062dA4F6e200e235F66e151E2733E5ed306b9' // kernel on sepolia

const number = Math.floor(Math.random() * 10000)
logger.info(`Setting number to ${number}`)

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
		client: new JsonRpcProvider(CLIENT_URL),
		bundler: new PimlicoBundler(chainId, BUNDLER_URL),
		erc7579Validator: new ECDSAValidator({
			address: ECDSA_VALIDATOR_ADDRESS,
			client: new JsonRpcProvider(CLIENT_URL),
			signer: new Wallet(privateKey),
		}),
	}),
	pmGetter: new MyPaymaster({
		client: new JsonRpcProvider(CLIENT_URL),
		paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
	}),
})

logger.info('Waiting for receipt...')
const receipt = await op.wait()

const log = receipt.logs[receipt.logs.length - 1]
logger.info(toNumber(log.data))
