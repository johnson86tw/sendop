import { getAddress, Wallet } from '@/utils/ethers'
import { MyPaymaster } from 'test/utils/myPaymaster'
import { addresses } from 'test/utils/network'
import { setup } from 'test/utils/setup'
import { beforeAll, describe, expect, it } from 'vitest'
import { SAProvider } from './sa_provider'
import { ECDSAValidator } from './validators/ecdsa_validator'
import { MyAccount } from './vendors/my_account'
import { Interface } from 'ethers'

const { chainId, CLIENT_URL, BUNDLER_URL, PRIVATE_KEY } = setup({ chainId: '11155111' })
const ECDSA_VALIDATOR_ADDRESS = getAddress(addresses[chainId].ECDSA_VALIDATOR)
const MY_ACCOUNT_ADDRESS = getAddress(addresses[chainId].MY_ACCOUNT)
const CHARITY_PAYMASTER_ADDRESS = getAddress(addresses[chainId].CHARITY_PAYMASTER)
const COUNTER_ADDRESS = getAddress(addresses[chainId].COUNTER)

describe('SAProvider', () => {
	let saProvider: SAProvider

	beforeAll(() => {
		saProvider = new SAProvider({
			networkInfo: {
				chainId,
				clientUrl: CLIENT_URL,
				bundlerUrl: BUNDLER_URL,
			},
			validator: new ECDSAValidator({
				address: ECDSA_VALIDATOR_ADDRESS,
				clientUrl: CLIENT_URL,
				signer: new Wallet(PRIVATE_KEY),
			}),
			supportedVendors: {
				[MyAccount.accountId]: new MyAccount(),
			},
			paymaster: new MyPaymaster({
				chainId,
				clientUrl: CLIENT_URL,
				paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
			}),
		})
	})

	it('should request accounts', async () => {
		const accounts = await saProvider.requestAccounts()
		expect(accounts).toContain(MY_ACCOUNT_ADDRESS)
	})

	it('should send op to set number', async () => {
		const receipt = await saProvider.send({
			from: MY_ACCOUNT_ADDRESS,
			calls: [
				{
					to: COUNTER_ADDRESS,
					data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [24]),
					value: '0x0',
				},
			],
		})
		expect(receipt.logs.length).toBeGreaterThan(0)
		expect(receipt.logs[receipt.logs.length - 1].data).toBe(
			'0x0000000000000000000000000000000000000000000000000000000000000018',
		)
	}, 30000)
})
