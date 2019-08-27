import { Providers } from "@arkecosystem/core-kernel";
import { Managers } from "@arkecosystem/crypto";
import { start } from "@arkecosystem/exchange-json-rpc";

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        if (!this.config().get("enabled")) {
            this.app.log.info("Exchange JSON-RPC Server is disabled");
            return;
        }

        this.config().set("network", Managers.configManager.get("network.name"));

        this.app.bind("exchange-json-rpc").toConstantValue(
            await start({
                database: this.config().get("database"),
                server: this.config().all(),
                logger: this.app.log,
            }),
        );
    }

    public async dispose(): Promise<void> {
        if (this.config().get("enabled")) {
            this.app.log.info("Stopping Exchange JSON-RPC Server");

            await this.app.get<any>("exchange-json-rpc").stop();
        }
    }
}
