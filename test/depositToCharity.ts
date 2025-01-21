import { getEntryPointContract } from '@/index'
import { formatEther, JsonRpcProvider, parseEther, Wallet } from 'ethers'
import { CHARITY_PAYMASTER_ADDRESS } from './utils/test_address'
import { setup } from './utils/setup'

const { CLIENT_URL, PRIVATE_KEY, chainId, logger } = await setup()

logger.info(`Chain ID: ${chainId}`)

const provider = new JsonRpcProvider(CLIENT_URL)
const signer = new Wallet(PRIVATE_KEY, provider)
const entryPoint = getEntryPointContract(signer)

const balance = await entryPoint.balanceOf(CHARITY_PAYMASTER_ADDRESS)
logger.info(`Balance: ${formatEther(balance)}`)

// prompt confirmation

const confirmed = prompt('Confirm? (y/n)')
if (confirmed !== 'y') {
	process.exit()
}

const tx = await entryPoint.depositTo(CHARITY_PAYMASTER_ADDRESS, { value: parseEther('0.5') })
const receipt = await tx.wait()

console.log(receipt.status)
