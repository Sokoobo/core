import { Application, Container, Contracts, Providers, Services } from "@packages/core-kernel";
import { Identifiers } from "@packages/core-kernel/src/ioc";
import { NullEventDispatcher } from "@packages/core-kernel/src/services/events/drivers/null";
import { Wallets } from "@packages/core-state";
import { StateStore } from "@packages/core-state/src/stores/state";
import {
    addressesIndexer,
    ipfsIndexer,
    locksIndexer,
    publicKeysIndexer,
    usernamesIndexer,
} from "@packages/core-state/src/wallets/indexers/indexers";
import { FactoryBuilder } from "@packages/core-test-framework/src/factories";
import passphrases from "@packages/core-test-framework/src/internal/passphrases.json";
import { getWalletAttributeSet } from "@packages/core-test-framework/src/internal/wallet-attributes";
import { Collator } from "@packages/core-transaction-pool/src";
import { DynamicFeeMatcher } from "@packages/core-transaction-pool/src/dynamic-fee-matcher";
import { ExpirationService } from "@packages/core-transaction-pool/src/expiration-service";
import { Memory } from "@packages/core-transaction-pool/src/memory";
import { Query } from "@packages/core-transaction-pool/src/query";
import { SenderState } from "@packages/core-transaction-pool/src/sender-state";
import { One, Two } from "@packages/core-transactions/src/handlers";
import { TransactionHandlerProvider } from "@packages/core-transactions/src/handlers/handler-provider";
import { TransactionHandlerRegistry } from "@packages/core-transactions/src/handlers/handler-registry";
import { Identities, Utils } from "@packages/crypto";
import { IMultiSignatureAsset } from "@packages/crypto/src/interfaces";

import { blockRepository } from "../__mocks__/block-repository";
import { transactionRepository } from "../__mocks__/transaction-repository";

const logger = {
    notice: jest.fn(),
    debug: jest.fn(),
    warning: jest.fn(),
};

export const initApp = (): Application => {
    const app: Application = new Application(new Container.Container());
    app.bind(Identifiers.ApplicationNamespace).toConstantValue("testnet");

    app.bind(Identifiers.LogService).toConstantValue(logger);

    app.bind<Services.Attributes.AttributeSet>(Identifiers.WalletAttributes)
        .to(Services.Attributes.AttributeSet)
        .inSingletonScope();

    app.bind<Contracts.State.WalletIndexerIndex>(Identifiers.WalletRepositoryIndexerIndex).toConstantValue({
        name: Contracts.State.WalletIndexes.Addresses,
        indexer: addressesIndexer,
    });

    app.bind<Contracts.State.WalletIndexerIndex>(Container.Identifiers.WalletRepositoryIndexerIndex).toConstantValue({
        name: Contracts.State.WalletIndexes.PublicKeys,
        indexer: publicKeysIndexer,
    });

    app.bind<Contracts.State.WalletIndexerIndex>(Container.Identifiers.WalletRepositoryIndexerIndex).toConstantValue({
        name: Contracts.State.WalletIndexes.Usernames,
        indexer: usernamesIndexer,
    });

    app.bind<Contracts.State.WalletIndexerIndex>(Container.Identifiers.WalletRepositoryIndexerIndex).toConstantValue({
        name: Contracts.State.WalletIndexes.Ipfs,
        indexer: ipfsIndexer,
    });

    app.bind<Contracts.State.WalletIndexerIndex>(Container.Identifiers.WalletRepositoryIndexerIndex).toConstantValue({
        name: Contracts.State.WalletIndexes.Locks,
        indexer: locksIndexer,
    });

    app.bind(Identifiers.WalletFactory).toFactory<Contracts.State.Wallet>(
        (context: Container.interfaces.Context) => (address: string) =>
            new Wallets.Wallet(
                address,
                new Services.Attributes.AttributeMap(
                    context.container.get<Services.Attributes.AttributeSet>(Identifiers.WalletAttributes),
                ),
            ),
    );

    app.bind(Container.Identifiers.PluginConfiguration)
        .to(Providers.PluginConfiguration)
        .inSingletonScope();

    app.get<Providers.PluginConfiguration>(Container.Identifiers.PluginConfiguration).set("maxTransactionAge", 500);
    app.get<Providers.PluginConfiguration>(Container.Identifiers.PluginConfiguration).set(
        "maxTransactionBytes",
        2000000,
    );
    app.get<Providers.PluginConfiguration>(Container.Identifiers.PluginConfiguration).set(
        "maxTransactionsPerSender",
        300,
    );

    app.bind(Container.Identifiers.StateStore)
        .to(StateStore)
        .inTransientScope();

    app.bind(Identifiers.TransactionPoolMemory)
        .to(Memory)
        .inSingletonScope();

    app.bind(Identifiers.TransactionPoolQuery)
        .to(Query)
        .inSingletonScope();

    app.bind(Container.Identifiers.TransactionPoolCollator).to(Collator);
    app.bind(Container.Identifiers.TransactionPoolDynamicFeeMatcher).to(DynamicFeeMatcher);
    app.bind(Container.Identifiers.TransactionPoolExpirationService).to(ExpirationService);

    app.bind(Container.Identifiers.TransactionPoolSenderState).to(SenderState);
    app.bind(Container.Identifiers.TransactionPoolSenderStateFactory).toAutoFactory(
        Container.Identifiers.TransactionPoolSenderState,
    );

    app.bind(Identifiers.WalletRepository)
        .to(Wallets.WalletRepository)
        .inSingletonScope();

    app.bind(Identifiers.EventDispatcherService)
        .to(NullEventDispatcher)
        .inSingletonScope();

    app.bind(Identifiers.BlockRepository).toConstantValue(blockRepository);

    app.bind(Identifiers.TransactionRepository).toConstantValue(transactionRepository);

    app.bind(Identifiers.TransactionHandler).to(One.TransferTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.TransferTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(One.SecondSignatureRegistrationTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.SecondSignatureRegistrationTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(One.DelegateRegistrationTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.DelegateRegistrationTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(One.VoteTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.VoteTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(One.MultiSignatureRegistrationTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.MultiSignatureRegistrationTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.IpfsTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.MultiPaymentTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.DelegateResignationTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.HtlcLockTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.HtlcClaimTransactionHandler);
    app.bind(Identifiers.TransactionHandler).to(Two.HtlcRefundTransactionHandler);

    app.bind(Identifiers.TransactionHandlerProvider)
        .to(TransactionHandlerProvider)
        .inSingletonScope();
    app.bind(Identifiers.TransactionHandlerRegistry)
        .to(TransactionHandlerRegistry)
        .inSingletonScope();

    return app;
};

export const buildSenderWallet = (factoryBuilder: FactoryBuilder): Wallets.Wallet => {
    const wallet: Wallets.Wallet = factoryBuilder
        .get("Wallet")
        .withOptions({
            passphrase: passphrases[0],
            nonce: 0,
        })
        .make();

    wallet.balance = Utils.BigNumber.make(7527654310);

    return wallet;
};

export const buildRecipientWallet = (factoryBuilder: FactoryBuilder): Wallets.Wallet => {
    return factoryBuilder
        .get("Wallet")
        .withOptions({
            passphrase: "passphrase2",
        })
        .make();
};

export const buildSecondSignatureWallet = (factoryBuilder: FactoryBuilder): Wallets.Wallet => {
    const wallet: Wallets.Wallet = factoryBuilder
        .get("Wallet")
        .withOptions({
            passphrase: passphrases[1],
            nonce: 0,
        })
        .make();

    wallet.balance = Utils.BigNumber.make(7527654310);
    wallet.setAttribute("secondPublicKey", "038082dad560a22ea003022015e3136b21ef1ffd9f2fd50049026cbe8e2258ca17");

    return wallet;
};

export const buildMultiSignatureWallet = (): Wallets.Wallet => {
    const multiSignatureAsset: IMultiSignatureAsset = {
        publicKeys: [
            Identities.PublicKey.fromPassphrase(passphrases[0]),
            Identities.PublicKey.fromPassphrase(passphrases[1]),
            Identities.PublicKey.fromPassphrase(passphrases[2]),
        ],
        min: 2,
    };

    const wallet = new Wallets.Wallet(
        Identities.Address.fromMultiSignatureAsset(multiSignatureAsset),
        new Services.Attributes.AttributeMap(getWalletAttributeSet()),
    );
    wallet.publicKey = Identities.PublicKey.fromMultiSignatureAsset(multiSignatureAsset);
    wallet.balance = Utils.BigNumber.make(100390000000);
    wallet.setAttribute("multiSignature", multiSignatureAsset);

    return wallet;
};