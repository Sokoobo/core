import { Support, Types } from "@arkecosystem/core-kernel";
import { defaults } from "./defaults";
import { WinstonLogger } from "./driver";

export class ServiceProvider extends Support.AbstractServiceProvider {
    public async register(): Promise<void> {
        this.app.bind("logger", await this.app.resolve("factoryLogger").make(new WinstonLogger(this.opts)));
    }

    public getDefaults(): Record<string, any> {
        return defaults;
    }

    public getPackageJson(): Types.PackageJson {
        return require("../package.json");
    }
}