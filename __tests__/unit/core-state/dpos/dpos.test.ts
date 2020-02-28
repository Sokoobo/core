import "jest-extended";

import { setUp } from "../setup";
import { DposState } from "../../../../packages/core-state/src/dpos/dpos";
import { WalletRepository } from "../../../../packages/core-state/src/wallets";
import { Identities, Utils as CryptoUtils } from "@arkecosystem/crypto";
import { SATOSHI } from "@arkecosystem/crypto/dist/constants";
import { Utils } from "@arkecosystem/core-kernel";
import { RoundInfo } from "@arkecosystem/core-kernel/dist/contracts/shared";

let dposState: DposState;
let walletRepo: WalletRepository;
let debugLogger: jest.SpyInstance;

beforeAll(() => {
    const initialEnv = setUp();
    dposState = initialEnv.dPosState;
    walletRepo = initialEnv.walletRepo;
    debugLogger = initialEnv.spies.logger.debug;
});

export const buildDelegateAndVoteWallets = (numberDelegates: number, walletRepo: WalletRepository) => {
    for (let i = 0; i < numberDelegates; i++) {
        const delegateKey = i.toString().repeat(66);
        const delegate = walletRepo.createWallet(Identities.Address.fromPublicKey(delegateKey));
        delegate.publicKey = delegateKey;
        delegate.setAttribute("delegate.username", `delegate${i}`);
        delegate.setAttribute("delegate.voteBalance", CryptoUtils.BigNumber.ZERO);

        const voter = walletRepo.createWallet(Identities.Address.fromPublicKey((i + numberDelegates).toString().repeat(66)));
        const totalBalance = CryptoUtils.BigNumber.make(i + 1)
            .times(1000)
            .times(SATOSHI);
        voter.balance = totalBalance.div(2);
        voter.publicKey = `v${delegateKey}`;
        voter.setAttribute("vote", delegateKey);
        // TODO: is this correct?
        // that buildVoteBalances should only be triggered if there is a htlc lockedBalance?
        voter.setAttribute("htlc.lockedBalance", totalBalance.div(2));

        walletRepo.index([delegate, voter]);
    }
}

describe("dpos", () => {

    beforeEach(() => {
        walletRepo.reset();

        buildDelegateAndVoteWallets(5, walletRepo);
    });

    describe("buildVoteBalances", () => {
        it("should update delegate votes of htlc locked balances", async () => {
            dposState.buildVoteBalances();
    
            const delegates = walletRepo.allByUsername();
            for (let i = 0; i < 5; i++) {
                const delegate = delegates[4 - i];
                expect(delegate.getAttribute<CryptoUtils.BigNumber>("delegate.voteBalance")).toEqual(
                    CryptoUtils.BigNumber.make(5 - i)
                        .times(1000)
                        .times(SATOSHI),
                );
            }
        });
    });

    describe("buildDelegateRanking", () => {
        it("should build ranking and sort delegates by vote balance", async () => {
            dposState.buildVoteBalances();
            dposState.buildDelegateRanking();

            const delegates = dposState.getActiveDelegates();

            for (let i = 0; i < 5; i++) {
                const delegate = delegates[i];
                expect(delegate.getAttribute<number>("delegate.rank")).toEqual(i + 1);
                expect(delegate.getAttribute<CryptoUtils.BigNumber>("delegate.voteBalance")).toEqual(
                    CryptoUtils.BigNumber.make((5 - i) * 1000 * SATOSHI),
                );
            }
        });
    });

    describe("setDelegatesRound", () => {
        it("should throw if there are not enough delegates", () => {
            dposState.buildVoteBalances();
            dposState.buildDelegateRanking();
            const round = Utils.roundCalculator.calculateRound(1);
            const errorMessage = `Expected to find 51 delegates but only found 5.This indicates an issue with the genesis block & delegates`;
            expect(() => dposState.setDelegatesRound(round)).toThrowError(errorMessage);
        });

        it("should set the delegates of a round", () => {
            dposState.buildVoteBalances();
            dposState.buildDelegateRanking();
            const round = Utils.roundCalculator.calculateRound(1);
            round.maxDelegates = 4;
            dposState.setDelegatesRound(round);
            const delegates = dposState.getActiveDelegates();
            const roundDelegates= dposState.getRoundDelegates();
            expect(dposState.getRoundInfo()).toEqual(round);
            expect(roundDelegates).toEqual(delegates.slice(0, 4));

            for (let i = 0; i < round.maxDelegates; i++) {
                const delegate = walletRepo.findByPublicKey(roundDelegates[i].publicKey);
                expect(delegate.getAttribute("delegate.round")).toEqual(round.round);
            }
            // TODO: when we remove Assertion checks, this won't throw
            // instead it should not.toEqual(round)
            expect(() => delegates[4].getAttribute("delegate.round")).toThrow();

            expect(debugLogger).toHaveBeenCalledWith("Loaded 4 active delegates");
        });
    });

    describe("getters", () => {
        let round: RoundInfo;

        beforeEach(() => {
            dposState.buildVoteBalances();
            dposState.buildDelegateRanking();
            round = Utils.roundCalculator.calculateRound(1);
            round.maxDelegates = 5;
            dposState.setDelegatesRound(round);
        });

        it("getRoundInfo", () => {
            expect(dposState.getRoundInfo()).toEqual(round);
        });
    
        it("getAllDelegates", () => {
            expect(dposState.getAllDelegates()).toEqual(walletRepo.allByUsername());
        });
    
        it("getActiveDelegates", () => {
            expect(dposState.getActiveDelegates()).toContainAllValues(walletRepo.allByUsername() as any);
        });
    
        it("getRoundDelegates", () => {
            expect(dposState.getRoundDelegates()).toContainAllValues(walletRepo.allByUsername() as any);
        });
    });
});