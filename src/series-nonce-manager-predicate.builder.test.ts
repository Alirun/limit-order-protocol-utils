
import { ChainId } from "./model/limit-order-protocol.model";
import { BETA_CONTRACT_ADDRESSES, mocksForChain } from "./test/helpers";
import { NonceSeriesV2 } from "./model/series-nonce-manager.model";
import { SeriesNonceManagerPredicateBuilder } from "./series-nonce-manager-predicate.builder";
import { ProviderConnector } from "./connector/provider.connector";


describe("SeriesNonceManagerFacade", () => {
    const walletAddress = '0x1c667c6308d6c9c8ce5bd207f524041f67dbc65e';
    let seriesNonceManagerContractAddress: string;
    
    let seriesNonceManagerPredicateBuilder: SeriesNonceManagerPredicateBuilder;
    let providerConnector: ProviderConnector;

    beforeEach(() => {
        const chainId = ChainId.etherumMainnet;
        
        const mocks = mocksForChain(chainId, BETA_CONTRACT_ADDRESSES[chainId]);
        providerConnector = mocks.providerConnector;
        seriesNonceManagerPredicateBuilder = mocks.seriesNonceManagerPredicateBuilder;
        seriesNonceManagerContractAddress = mocks.seriesNonceManagerContractAddress;
    });

    it("nonce", () => {
        expect(
            seriesNonceManagerPredicateBuilder.nonce(NonceSeriesV2.P2PV3, walletAddress),
        ).toMatchSnapshot();
    });

    it("nonceEquals", async () => {
        expect(
            seriesNonceManagerPredicateBuilder.nonceEquals(NonceSeriesV2.P2PV3, walletAddress, 101),
        ).toMatchSnapshot();
    });

    it("nonceEquals", async () => {
        expect(
            seriesNonceManagerPredicateBuilder.timestampBelowAndNonceEquals(
                NonceSeriesV2.P2PV3,
                5444440000,
                101,
                walletAddress,
            ),
        ).toMatchSnapshot();
    });



    describe("web3 calls", () => {
        it("nonceEquals call", async () => {
            const calldata = seriesNonceManagerPredicateBuilder.nonceEquals(NonceSeriesV2.LimitOrderV3, walletAddress, 4);

            const result = await providerConnector.ethCall(seriesNonceManagerContractAddress, calldata);
            expect(result).toBe('0x0000000000000000000000000000000000000000000000000000000000000001');
        });
    });
});