import { RpcProvider } from '@/utils'
import { formatUnits, JsonRpcProvider } from 'ethers'
import { setup } from './utils'

const { logger, chainId, CLIENT_URL, ALCHEMY_BUNDLER_URL, PIMLICO_BUNDLER_URL } = await setup({ chainId: '11155111' })
logger.info(`Chain ID: ${chainId}`)

const client = new JsonRpcProvider(CLIENT_URL)
const bundler = new RpcProvider(ALCHEMY_BUNDLER_URL)

const gasPrice = await bundler.send({ method: 'eth_gasPrice' })
console.log('gasPrice', formatUnits(gasPrice, 'gwei'))

const pendingBlock = await bundler.send({ method: 'eth_getBlockByNumber', params: ['pending', true] })
const baseFeePerGas = pendingBlock.baseFeePerGas
console.log('baseFeePerGas', formatUnits(baseFeePerGas, 'gwei'))

const pimlicoBundler = new RpcProvider(PIMLICO_BUNDLER_URL)
const curGasPrice = await pimlicoBundler.send({ method: 'pimlico_getUserOperationGasPrice' })

const slowGasPrice = formatUnits(curGasPrice.slow.maxFeePerGas, 'gwei')
const standardGasPrice = formatUnits(curGasPrice.standard.maxFeePerGas, 'gwei')
const fastGasPrice = formatUnits(curGasPrice.fast.maxFeePerGas, 'gwei')

console.log('slowGasPrice', slowGasPrice)
console.log('standardGasPrice', standardGasPrice)
console.log('fastGasPrice', fastGasPrice)
