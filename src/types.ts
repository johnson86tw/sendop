import type { Execution, PaymasterGetter, SendOpResult } from '@/core'

export interface Vendor {
	getNonceKey(validator: string): Promise<string> | string
	getCallData(from: string, executions: Execution[]): Promise<string> | string
}

export interface ERC4337Account extends Vendor {
	deploy(pmGetter?: PaymasterGetter): Promise<SendOpResult>
	send(address: string, executions: Execution[], pmGetter?: PaymasterGetter): Promise<SendOpResult>
}

export interface ERC7579Vendor extends Vendor {
	accountId(): Promise<string> | string
	getInstallModuleInitData?(): Promise<string> | string
	getUninstallModuleDeInitData?(): Promise<string> | string
}

export interface AccountCreatingVendor extends Vendor {
	getAddress(): Promise<string> | string
	getInitCode(): Promise<string> | string
}

export interface Validator {
	address(): Promise<string> | string
	getDummySignature(): Promise<string> | string
	getSignature(userOpHash: string): Promise<string> | string
}

export interface AccountRequestingValidator extends Validator {
	requestAccounts(): Promise<string[]>
}
