import {
    LIMIT_ORDER_PROTOCOL_ABI,
    EIP712_DOMAIN,
    PROTOCOL_NAME,
    PROTOCOL_VERSION,
    ZX,
    TypedDataVersion,
} from './limit-order-protocol.const';
import {
    LimitOrder,
    LimitOrderProtocolMethods,
    LimitOrderHash,
    LimitOrderSignature,
    RFQOrderInfo,
    RFQOrder,
} from './model/limit-order-protocol.model';
import {BigNumber} from '@ethersproject/bignumber';
import {
    extractWeb3OriginalErrorData,
    getMakingAmountForRFQ,
    packSkipPermitAndThresholdAmount,
} from './utils/limit-order.utils';
import {getABIFor} from './utils/abi';
import {TypedDataUtils} from '@metamask/eth-sig-util';
import { AbstractSmartcontractFacade } from './utils/abstract-facade';

// todo move into model
export interface FillOrderParams {
    order: LimitOrder;
    signature: LimitOrderSignature;
    interaction?: string;
    makingAmount: string;
    takingAmount: string;
    thresholdAmount: string;
    skipPermit?: boolean;
}

export type FillLimitOrderWithPermitParams = FillOrderParams & {
    targetAddress: string;
    permit: string;
}

export interface ErrorResponse extends Error {
    data: string,
}

export class LimitOrderProtocolFacade
    extends AbstractSmartcontractFacade<LimitOrderProtocolMethods>
{
    ABI = LIMIT_ORDER_PROTOCOL_ABI;

    fillLimitOrder(params: FillOrderParams): string {
        const {
            order,
            interaction = ZX,
            signature,
            makingAmount,
            takingAmount,
            thresholdAmount,
            skipPermit = false,
        } = params;

        return this.getContractCallData(LimitOrderProtocolMethods.fillOrder, [
            order,
            signature,
            interaction,
            makingAmount,
            takingAmount,
            // skipPermitAndThresholdAmount
            packSkipPermitAndThresholdAmount(thresholdAmount, skipPermit),
        ]);
    }

    /**
     * @param params.interaction pre-interaction in fact.
     * @param params.skipPermit skip maker's permit evaluation if it was evaluated before.
     * Useful if multiple orders was created with same nonce.
     * 
     * Tip: you can just check if allowance exsists and then set it to `true`.
     */
    fillOrderToWithPermit(params: FillLimitOrderWithPermitParams): string {
        const {
            order,
            signature,
            makingAmount,
            takingAmount,
            interaction = ZX,
            thresholdAmount,
            skipPermit = false,
            targetAddress,
            permit,
        } = params;

        return this.getContractCallData(
            LimitOrderProtocolMethods.fillOrderToWithPermit,
            [
                order,
                signature,
                interaction,
                makingAmount,
                takingAmount,
                // skipPermitAndThresholdAmount
                packSkipPermitAndThresholdAmount(thresholdAmount, skipPermit),
                targetAddress,
                permit
            ],
        );
    }

    fillRFQOrder(
        order: RFQOrder,
        signature: LimitOrderSignature,
        makingAmount?: string,
        takingAmount?: string
    ): string {
        let flagsAndAmount = '0';
        if (makingAmount) {
            flagsAndAmount = getMakingAmountForRFQ(makingAmount);
        } else if (takingAmount) {
            flagsAndAmount = takingAmount;
        }

        return this.getContractCallData(
            LimitOrderProtocolMethods.fillOrderRFQ,
            [order, signature, flagsAndAmount]
        );
    }

    cancelLimitOrder(order: LimitOrder): string {
        return this.getContractCallData(LimitOrderProtocolMethods.cancelOrder, [
            order,
        ]);
    }

    cancelRFQOrder(orderInfo: RFQOrderInfo): string {
        return this.getContractCallData(
            LimitOrderProtocolMethods.cancelOrderRFQ,
            [orderInfo]
        );
    }

    nonce(makerAddress: string): Promise<bigint> {
        const callData = this.getContractCallData(
            LimitOrderProtocolMethods.nonce,
            [makerAddress]
        );

        return this.providerConnector
            .ethCall(this.contractAddress, callData)
            .then((nonce) => BigInt(nonce));
    }

    advanceNonce(count: number): string {
        return this.getContractCallData(
            LimitOrderProtocolMethods.advanceNonce,
            [count]
        );
    }

    increaseNonce(): string {
        return this.getContractCallData(
            LimitOrderProtocolMethods.increaseNonce
        );
    }

    checkPredicate(order: LimitOrder): Promise<boolean> {
        const callData = this.getContractCallData(
            LimitOrderProtocolMethods.checkPredicate,
            [order]
        );

        return this.providerConnector
            .ethCall(this.contractAddress, callData)
            .catch((error) => {
                console.error(error);

                return false;
            })
            .then((result) => {
                try {
                    return BigNumber.from(result).toNumber() === 1;
                } catch (e) {
                    console.error(e);

                    return false;
                }
            });
    }

    remaining(orderHash: LimitOrderHash): Promise<BigNumber> {
        const callData = this.getContractCallData(
            LimitOrderProtocolMethods.remaining,
            [orderHash]
        );

        return this.providerConnector
            .ethCall(this.contractAddress, callData)
            .then((result) => {
                const response = this.parseRemainingResponse(result);

                if (response !== null) {
                    return response;
                }

                return Promise.reject(result);
            });
    }

    simulate(
        targetAddress: string,
        data: unknown,
    ): Promise<{
        success: boolean,
        rawResult: string,
    }> {
        const callData = this.getContractCallData(
            LimitOrderProtocolMethods.simulate,
            [targetAddress, data]
        );

        return this.providerConnector
            .ethCall(this.contractAddress, callData)
            .then(() => {
                throw new Error('call was successful but revert was expected');
            })
            .catch((result) => {
                const parsedResult = this.parseSimulateTransferError(result);
                if (parsedResult) {
                    return parsedResult;
                }

                throw { success: false, rawResult: result };
            });
    }

    // https://github.com/1inch/limit-order-protocol/blob/v3-prerelease/test/helpers/eip712.js#L22
    domainSeparator(): Promise<string> {
        const hex = '0x' + TypedDataUtils.hashStruct(
            'EIP712Domain',
            {
                name: PROTOCOL_NAME,
                version: PROTOCOL_VERSION,
                chainId: this.chainId,
                verifyingContract: this.contractAddress,
            },
            { EIP712Domain: EIP712_DOMAIN },
            TypedDataVersion,
        ).toString('hex')

        return Promise.resolve(hex);
    }

    parseRemainingResponse(response: string): BigNumber | null {
        if (response.length === 66) {
            return BigNumber.from(response);
        }

        return null;
    }

    parseSimulateTransferError(
        error: ErrorResponse | Error | string,
    ): { success: boolean, rawResult: string } | null {
        const simulationResultsAbi = getABIFor(LIMIT_ORDER_PROTOCOL_ABI, 'SimulationResults');
        const revertionData = extractWeb3OriginalErrorData(error);

        if (simulationResultsAbi && revertionData) {
            const parsed = this.providerConnector.decodeABICallParameters(
                simulationResultsAbi.inputs as [],
                revertionData,
            );
            const parsedResult = parsed.res as string | null;

            const success = parsed.success as boolean
                && this.isSimulationResultResponseSuccessfull(parsedResult);
            
            return {
                success,
                rawResult: parsed.res as string,
            };
        }

        return null;
    }

    private isSimulationResultResponseSuccessfull(res: string | null) {
        if (!res || !res.length) return true;

        return this.providerConnector.decodeABIParameter<boolean>('bool', res)
    }
}
