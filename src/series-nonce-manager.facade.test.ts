
import { SeriesNonceManagerFacade } from "./series-nonce-manager.facade";
import { ChainId } from "./model/limit-order-protocol.model";
import { BETA_CONTRACT_ADDRESSES, mocksForChain } from "./test/helpers";
import { NonceSeriesV2 } from "./model/series-nonce-manager.model";
import { SeriesNonceManagerPredicateBuilder } from "./series-nonce-manager-predicate.builder";


describe("SeriesNonceManagerFacade", () => {
    const walletAddress = '0x1c667c6308d6c9c8ce5bd207f524041f67dbc65e';

    let seriesNonceManagerFacade: SeriesNonceManagerFacade;
    let seriesNonceManagerPredicateBuilder: SeriesNonceManagerPredicateBuilder;
    

    beforeEach(() => {
        const chainId = ChainId.etherumMainnet;
        
        const mocks = mocksForChain(chainId, BETA_CONTRACT_ADDRESSES[chainId]);
        seriesNonceManagerFacade = mocks.seriesNonceManagerFacade;
        seriesNonceManagerPredicateBuilder = mocks.seriesNonceManagerPredicateBuilder;
    });

    it("advanceNonce", () => {
        expect(
            seriesNonceManagerFacade.advanceNonce(NonceSeriesV2.P2PV3, 3),
        ).toMatchSnapshot();
    });

    it("increaseNonce", () => {
        expect(
            seriesNonceManagerFacade.increaseNonce(NonceSeriesV2.P2PV3),
        ).toMatchSnapshot();
    });

    it("nonceEquals", async () => {
        expect(
            seriesNonceManagerPredicateBuilder.nonceEquals(NonceSeriesV2.P2PV3, walletAddress, 101),
        ).toMatchSnapshot();
    });

    describe("web3 calls", () => {
        it("nonce", async () => {
            const nonce = await seriesNonceManagerFacade.getNonce(NonceSeriesV2.LimitOrderV3, walletAddress);
    
            expect(nonce).toBe(4n);
        });
    });
});