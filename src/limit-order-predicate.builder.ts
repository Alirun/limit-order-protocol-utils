import {
    LimitOrderProtocolMethods,
    Nonce,
    PredicateTimestamp,
} from './model/limit-order-protocol.model';
import {ZX} from './limit-order-protocol.const';
import {LimitOrderProtocolFacade} from './limit-order-protocol.facade';
import { AbstractSmartcontractFacade } from './utils/abstract-facade';
import { LimitOrderBuilder } from './limit-order.builder';

export type LimitOrderPredicateCallData = string;

/**
 * All methods is lambdas to preserve `this` context and allow DSL-like usage
 */
export class LimitOrderPredicateBuilder {
    constructor(private readonly facade: LimitOrderProtocolFacade) {}

    and = (
        ...predicates: LimitOrderPredicateCallData[]
    ): LimitOrderPredicateCallData => {
        const { offsets, data } = LimitOrderBuilder.joinStaticCalls(predicates);

        return this.facade.getContractCallData(LimitOrderProtocolMethods.and, [
            offsets,
            data,
        ]);
    };

    or = (
        ...predicates: LimitOrderPredicateCallData[]
    ): LimitOrderPredicateCallData => {
        const { offsets, data } = LimitOrderBuilder.joinStaticCalls(predicates);

        return this.facade.getContractCallData(LimitOrderProtocolMethods.or, [
            offsets,
            data,
        ]);
    };

    eq = (
        value: string,
        callData: string
    ): LimitOrderPredicateCallData => {
        return this.facade.getContractCallData(LimitOrderProtocolMethods.eq, [
            value,
            callData,
        ]);
    };

    lt = (
        value: string,
        callData: string
    ): LimitOrderPredicateCallData => {
        return this.facade.getContractCallData(LimitOrderProtocolMethods.lt, [
            value,
            callData,
        ]);
    };

    gt = (
        value: string,
        callData: string
    ): LimitOrderPredicateCallData => {
        return this.facade.getContractCallData(LimitOrderProtocolMethods.gt, [
            value,
            callData,
        ]);
    };

    nonce = (makerAddress: string): LimitOrderPredicateCallData => {
        return this.facade.getContractCallData(
            LimitOrderProtocolMethods.nonce,
            [makerAddress]
        );
    }

    nonceEquals = (
        makerAddress: string,
        makerNonce: Nonce,
    ): LimitOrderPredicateCallData => {
        return this.facade.getContractCallData(
            LimitOrderProtocolMethods.nonceEquals,
            [makerAddress, makerNonce]
        );
    };

    /**
     * @param timestamp seconds unit
     */
    timestampBelow = (timestamp: PredicateTimestamp): LimitOrderPredicateCallData => {
        return this.facade.getContractCallData(
            LimitOrderProtocolMethods.timestampBelow,
            [ZX + timestamp.toString(16)]
        );
    };

    /**
     * @param timestamp seconds unit
     */
    timestampBelowAndNonceEquals = (
        timestamp: PredicateTimestamp,
        nonce: Nonce,
        address: string,
    ): LimitOrderPredicateCallData => {
        const predicateValue = BigInt(address)
            + (BigInt(nonce) << BigInt(160))
            + (BigInt(timestamp) << BigInt(208));

        return this.facade.getContractCallData(
            LimitOrderProtocolMethods.timestampBelowAndNonceEquals,
            [ZX + predicateValue.toString(16)]
        );
    }

    arbitraryStaticCall = (
        target: string | AbstractSmartcontractFacade<string>,
        callData: string
    ): LimitOrderPredicateCallData => {
        const address = target instanceof AbstractSmartcontractFacade
            ? target.contractAddress
            : target;

        if (address.toLowerCase() === this.facade.contractAddress.toLowerCase()) {
            console.warn(
                'Unnecessary arbitraryStaticCall(). '
                + 'Omit it when interacting with limit-order-protocol methods.'
            );

            return callData;
        }

        return this.facade.getContractCallData(LimitOrderProtocolMethods.arbitraryStaticCall, [
            address,
            callData,
        ]);
    };

    
}
