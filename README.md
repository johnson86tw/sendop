# sendop.js

A TypeScript library for sending user operations for ERC-4337 contracts.

```
npm install ethers sendop
```

- only support ethers v6

### Dev Commands

```sh
bun install
docker compose up -d

bun run test
bun test

bun run build
```

### Usage

Send a user operation using Kernel Smart Account

```ts
const op = await kernel.send([
    {
        to: COUNTER_ADDRESS,
        data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
        value: '0x0',
    },
])
const receipt = await op.wait()
```

Send a user operation to deploy Kernel and make a transaction

```ts
const op = await sendop({
    bundler: new PimlicoBundler(chainId, BUNDLER_URL),
    executions: [
        {
            to: COUNTER_ADDRESS,
            data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
            value: '0x0',
        },
    ],
    opGetter: kernel,
    pmGetter: new MyPaymaster({
        client,
        paymasterAddress: CHARITY_PAYMASTER_ADDRESS,
    }),
    initCode: kernel.getInitCode(creationOptions),
})
const receipt = await op.wait()
```


Send a user operation for your ERC-4337 contract
```ts
const op = await sendop({
    bundler: new PimlicoBundler(CHAIN_ID, BUNDLER_URL),
    executions: [
        {
            to: COUNTER_ADDRESS,
            data: new Interface(['function setNumber(uint256)']).encodeFunctionData('setNumber', [number]),
            value: '0x0',
        },
    ],
    opGetter: {
        getSender() {
            return ERC4337_CONTRACT_ADDRESS
        },
        async getNonce() {
            const nonce: bigint = await getEntryPointContract(client).getNonce(ERC4337_CONTRACT_ADDRESS, 0)
            return toBeHex(nonce)
        },
        getCallData(executions: Execution[]) {
            return executions[0].data
        },
        async getDummySignature() {
            return '0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c'
        },
        async getSignature(userOpHash: Uint8Array) {
            return await wallet.signMessage(userOpHash)
        },
    },
})
const receipt = await op.wait()
```

- For complete examples, please refer to *.test.ts

## Publish Flow
1. Commit v0.x.x
2. Push to a branch and create a pull request
3. If the tests pass, merge it and publish to npm
