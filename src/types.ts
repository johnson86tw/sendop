import type { Execution, OperationGetter, PaymasterGetter, SendOpResult } from '@/core'

export interface SmartAccount extends OperationGetter {
	deploy(creationOptions: any, pmGetter?: PaymasterGetter): Promise<SendOpResult>
	send(executions: Execution[], pmGetter?: PaymasterGetter): Promise<SendOpResult>
}
