import { getEntryPointContract } from '@/index'
import { JsonRpcProvider, parseEther, Wallet } from 'ethers'
import { CHARITY_PAYMASTER } from './utils/addresses'
import { setup } from './utils/setup'

const { CLIENT_URL, PRIVATE_KEY, chainId, logger } = setup()

logger.info(`Chain ID: ${chainId}`)

const provider = new JsonRpcProvider(CLIENT_URL)
const signer = new Wallet(PRIVATE_KEY, provider)
const entryPoint = getEntryPointContract(signer)

const tx = await entryPoint.depositTo(CHARITY_PAYMASTER, { value: parseEther('0.5') })
const receipt = await tx.wait()

console.log(receipt.status)
