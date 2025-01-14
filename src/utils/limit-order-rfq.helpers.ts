#!/usr/bin/env node

import prompts from 'prompts';
import kleur from 'kleur';
import Web3 from 'web3';
import {LimitOrderBuilder} from '../limit-order.builder';
import {ChainId, RFQOrder} from '../model/limit-order-protocol.model';
import {LimitOrderProtocolFacade} from '../limit-order-protocol.facade';
import {
    cancelOrderSchema,
    createOrderSchema,
    explorersUrls,
    fillOrderSchema,
    rpcUrls,
} from './limit-order-rfq.const';
import {
    CancelingParams,
    CreatingParams,
    FillingParams,
} from './limit-order-rfq.model';
import {TransactionConfig} from 'web3-core';
import {PrivateKeyProviderConnector} from '../connector/private-key-provider.connector';
import { limirOrderProtocolAdresses } from '../limit-order-protocol.const';

export async function createOrderOperation(
    isRunningWithArgv: boolean,
    params?: CreatingParams
): Promise<void> {
    const creatingParams =
        params || ((await prompts(createOrderSchema)) as CreatingParams);

    const newOrder = createOrder(creatingParams);

    if (isRunningWithArgv) {
        console.log(JSON.stringify(newOrder));
        return;
    }

    console.log(kleur.green().bold('New limit order RFQ: '));
    console.log(kleur.white().underline(JSON.stringify(newOrder, null, 4)));
}

export async function fillOrderOperation(
    isRunningWithArgv: boolean,
    params?: FillingParams
): Promise<void>  {
    const fillingParams =
        params || ((await prompts(fillOrderSchema)) as FillingParams);
    const orderForFill: RFQOrder = JSON.parse(fillingParams.order);

    console.log(kleur.green().bold('Order for filling: '));
    console.log(kleur.white().underline(JSON.stringify(orderForFill, null, 4)));

    const txHash = await fillOrder(fillingParams, orderForFill);

    if (isRunningWithArgv) {
        console.log(txHash);
        return;
    }

    console.log(kleur.green().bold('Order filling transaction: '));
    printTransactionLink(explorerTxLink(fillingParams.chainId, txHash));
}

export async function cancelOrderOperation(
    isRunningWithArgv: boolean,
    params?: CancelingParams
): Promise<void>  {
    const cancelingParams =
        params || ((await prompts(cancelOrderSchema)) as CancelingParams);

    const cancelingTxHash = await cancelOrder(cancelingParams);

    if (isRunningWithArgv) {
        console.log(cancelingTxHash);
        return;
    }

    console.log(kleur.green().bold('Order canceling transaction: '));
    printTransactionLink(
        explorerTxLink(cancelingParams.chainId, cancelingTxHash)
    );
}

export function createOrder(params: CreatingParams): RFQOrder {
    const contractAddress = limirOrderProtocolAdresses[params.chainId as ChainId];
    const web3 = new Web3(rpcUrls[params.chainId as ChainId]);
    const providerConnector = new PrivateKeyProviderConnector(
        params.privateKey,
        web3
    );
    const walletAddress = web3.eth.accounts.privateKeyToAccount(
        params.privateKey
    ).address;

    const limitOrderBuilder = new LimitOrderBuilder(
        contractAddress,
        params.chainId,
        providerConnector
    );

    return limitOrderBuilder.buildRFQOrder({
        id: params.orderId,
        expiresInTimestamp: Math.ceil(Date.now() / 1000) + params.expiresIn,
        makerAddress: walletAddress,
        makerAssetAddress: params.makerAssetAddress,
        takerAssetAddress: params.takerAssetAddress,
        makingAmount: params.makingAmount,
        takingAmount: params.takingAmount,
        allowedSender: params.allowedSender || undefined,
    });
}

// eslint-disable-next-line max-lines-per-function
export async function fillOrder(
    params: FillingParams,
    order: RFQOrder
): Promise<string> {
    const contractAddress = limirOrderProtocolAdresses[params.chainId as ChainId];
    const web3 = new Web3(rpcUrls[params.chainId as ChainId]);
    const providerConnector = new PrivateKeyProviderConnector(
        params.privateKey,
        web3
    );
    const walletAddress = web3.eth.accounts.privateKeyToAccount(
        params.privateKey
    ).address;

    const limitOrderBuilder = new LimitOrderBuilder(
        contractAddress,
        params.chainId,
        providerConnector
    );
    const limitOrderProtocolFacade = new LimitOrderProtocolFacade(
        contractAddress,
        params.chainId,
        providerConnector,
    );

    const typedData = limitOrderBuilder.buildRFQOrderTypedData(
        order,
        params.domainName || undefined
    );
    const signature = await limitOrderBuilder.buildOrderSignature(
        walletAddress,
        typedData
    );

    const callData = limitOrderProtocolFacade.fillRFQOrder(
        order,
        signature,
        params.makingAmount,
        params.takingAmount
    );

    const txConfig: TransactionConfig = {
        to: contractAddress,
        from: walletAddress,
        data: callData,
        value: '0',
        gas: 120_000,
        gasPrice: gweiToWei(params.gasPrice),
        nonce: await web3.eth.getTransactionCount(walletAddress),
    };

    return sendSignedTransaction(web3, txConfig, params.privateKey);
}

export async function cancelOrder(params: CancelingParams): Promise<string> {
    const contractAddress = limirOrderProtocolAdresses[params.chainId as ChainId];
    const web3 = new Web3(
        new Web3.providers.HttpProvider(rpcUrls[params.chainId as ChainId])
    );
    const providerConnector = new PrivateKeyProviderConnector(
        params.privateKey,
        web3
    );
    const walletAddress = web3.eth.accounts.privateKeyToAccount(
        params.privateKey
    ).address;

    const limitOrderProtocolFacade = new LimitOrderProtocolFacade(
        contractAddress,
        params.chainId,
        providerConnector,
    );

    const callData = limitOrderProtocolFacade.cancelRFQOrder(params.orderInfo);
    const txConfig: TransactionConfig = {
        to: contractAddress,
        from: walletAddress,
        data: callData,
        value: '0',
        gas: 50_000,
        gasPrice: gweiToWei(params.gasPrice),
        nonce: await web3.eth.getTransactionCount(walletAddress),
    };

    return sendSignedTransaction(web3, txConfig, params.privateKey);
}

export async function sendSignedTransaction(
    web3: Web3,
    txConfig: TransactionConfig,
    privateKey: string
): Promise<string> {
    const sign = await web3.eth.accounts.signTransaction(txConfig, privateKey);

    return await new Promise<string>((resolve, reject) => {
        web3.eth.sendSignedTransaction(
            sign.rawTransaction as string,
            (error, hash) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(hash);
            }
        );
    });
}

function explorerTxLink(chainId: number, txHash: string): string {
    const explorerUrl = explorersUrls[chainId as ChainId];

    return `${explorerUrl}/tx/${txHash}`;
}

export function gweiToWei(value: number): string {
    return value + '000000000';
}

function printTransactionLink(text: string): void {
    console.log(
        kleur.white('************************************************')
    );
    console.log(kleur.white('   '));
    console.log(kleur.white().underline(text));
    console.log(kleur.white('   '));
    console.log(
        kleur.white('************************************************')
    );
}
