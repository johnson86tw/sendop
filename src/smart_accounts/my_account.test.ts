import { type Bundler, type ERC7579Validator, type PaymasterGetter } from '@/core'
import { MyPaymaster, PimlicoBundler } from '@/index'
import { ECDSAValidator } from '@/validators/ecdsa_validator'
import { JsonRpcProvider, Wallet, ZeroAddress } from 'ethers'
import { CHARITY_PAYMASTER, ECDSA_VALIDATOR, MY_ACCOUNT_IMPLEMENTATION_ADDRESS, setup } from 'test/utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { MyAccount } from './my_account'

const { logger, chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({
	chainId: '11155111',
})

logger.info(`Chain ID: ${chainId}`)

describe('MyAccount', () => {
	let signer: Wallet
	let client: JsonRpcProvider
	let bundler: Bundler
	let erc7579Validator: ERC7579Validator
	let pmGetter: PaymasterGetter
	let myAccount: MyAccount

	beforeAll(() => {
		signer = new Wallet(PRIVATE_KEY)
		client = new JsonRpcProvider(CLIENT_URL)
		bundler = new PimlicoBundler(chainId, BUNDLER_URL)
		erc7579Validator = new ECDSAValidator({
			address: ECDSA_VALIDATOR,
			client,
			signer: new Wallet(PRIVATE_KEY),
		})
		pmGetter = new MyPaymaster({
			client,
			paymasterAddress: CHARITY_PAYMASTER,
		})

		myAccount = new MyAccount(MY_ACCOUNT_IMPLEMENTATION_ADDRESS, {
			client,
			bundler,
			erc7579Validator,
			pmGetter,
		})
		logger.info(`Signer: ${signer.address}`)
	})

	describe('static methods', () => {
		it('should get accountId', () => {
			expect(MyAccount.accountId()).toBe('johnson86tw.0.0.1')
		})
		it('should getNewAddress', async () => {
			const newAddress = await MyAccount.getNewAddress(client, {
				salt: '0x1234567890',
				validatorAddress: ECDSA_VALIDATOR,
				owner: signer.address,
			})
			expect(newAddress).not.toBe(ZeroAddress)
		})
	})
})
