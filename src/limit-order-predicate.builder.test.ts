import {
    LimitOrderPredicateBuilder,
    LimitOrderPredicateCallData,
} from './limit-order-predicate.builder';
import {Erc20Facade} from './erc20.facade';
import { ChainId } from './model/limit-order-protocol.model';
import { mocksForChain } from './test/helpers';

describe('PredicateBuilder - for build limit order predicate', () => {
    const chainId = ChainId.binanceMainnet;
    
    const walletAddress = '0xfb3c7eb936caa12b5a884d612393969a557d4307';
    const WBNB_ADDRESS = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';

    let predicateBuilder: LimitOrderPredicateBuilder;
    let erc20Facade: Erc20Facade;

    function buildComplexPredicate(): {
        valuesInPredicate: string[];
        predicate: LimitOrderPredicateCallData;
    } {

        const timestampBelow1 = 1619860038;
        const nonce1 = 13344354354;
        const gt1 = 245673600000000000;
        const timestampBelow2 = 1619875555;
        const lt1 = 3453466520000000000;
        const eq1 = 34643434200000000;

        const valuesInPredicate = [
            timestampBelow1.toString(16),
            nonce1.toString(16),
            gt1.toString(16),
            timestampBelow2.toString(16),
            lt1.toString(16),
            eq1.toString(16),
        ];

        const {
            or,
            and,
            timestampBelow,
            nonceEquals,
            gt,
            lt,
            eq,
            arbitraryStaticCall,
        } = predicateBuilder;

        const balanceOfCallData = arbitraryStaticCall(
            WBNB_ADDRESS,
            erc20Facade.balanceOf(
                WBNB_ADDRESS,
                walletAddress,
            ),
        );

        const predicate = or(
            and(
                timestampBelow(timestampBelow1),
                nonceEquals(walletAddress, nonce1),
                gt(gt1.toString(), balanceOfCallData)
            ),
            or(
                timestampBelow(timestampBelow2),
                lt(lt1.toString(), balanceOfCallData)
            ),
            eq(eq1.toString(), balanceOfCallData)
        );

        return {valuesInPredicate, predicate};
    }

    beforeEach(() => {
        const mocks = mocksForChain(chainId);
        erc20Facade = mocks.erc20Facade;
        predicateBuilder = mocks.limitOrderPredicateBuilder;
    });

    it('Simple predicate must includes all values and match the snapshot', () => {
        const nonce = 13;
        const timestampBelow = 1619860038;

        const valuesInPredicate = [
            nonce.toString(16),
            timestampBelow.toString(16),
        ];

        const predicate = predicateBuilder.and(
            predicateBuilder.nonceEquals(walletAddress, nonce),
            predicateBuilder.timestampBelow(timestampBelow)
        );

        const allValuesCheck = valuesInPredicate.every((value) =>
            predicate.includes(value)
        );

        expect(predicate).toMatchSnapshot();
        expect(allValuesCheck).toBe(true);
    });

    it('Simplyfied predicate must includes all values and match the snapshot', () => {
        const nonce = 14;
        const timestampBelow = 1619860038;

        const valuesInPredicate = [
            nonce.toString(16),
            timestampBelow.toString(16),
        ];

        const predicate = predicateBuilder.timestampBelowAndNonceEquals(
            timestampBelow,
            nonce,
            walletAddress,
        );

        const allValuesCheck = valuesInPredicate.every((value) =>
            predicate.includes(value)
        );

        expect(predicate).toMatchSnapshot();
        expect(allValuesCheck).toBe(true);
    });

    it('Complex predicate must includes all values and match the snapshot', () => {
        const {valuesInPredicate, predicate} = buildComplexPredicate();

        const allValuesCheck = valuesInPredicate.every((value) =>
            predicate.includes(value)
        );

        expect(predicate).toMatchSnapshot();
        expect(allValuesCheck).toBe(true);
    });

    it('When predicate includes all values in order then check must be true', () => {
        const {valuesInPredicate, predicate} = buildComplexPredicate();

        const allValuesInProperOrder = valuesInPredicate.every(
            (value, index) => {
                const inOrder =
                    predicate.indexOf(valuesInPredicate[index - 1]) <
                    predicate.indexOf(value);

                return index === 0 ? true : inOrder;
            }
        );

        expect(allValuesInProperOrder).toBe(true);
    });

    it('When predicate includes values not in order then check must be false', () => {
        const {valuesInPredicate, predicate} = buildComplexPredicate();
        const firstElement = valuesInPredicate[0];

        // Swap values places
        valuesInPredicate[0] = valuesInPredicate[1];
        valuesInPredicate[1] = firstElement;

        const allValuesInProperOrder = valuesInPredicate.every(
            (value, index) => {
                const inOrder =
                    predicate.indexOf(valuesInPredicate[index - 1]) <
                    predicate.indexOf(value);

                return index === 0 ? true : inOrder;
            }
        );

        expect(allValuesInProperOrder).toBe(false);
    });
});
