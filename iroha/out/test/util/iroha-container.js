"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IrohaContainer = void 0;
const tslib_1 = require("tslib");
const path = tslib_1.__importStar(require("path"));
const waitOn = require("wait-on");
const postgres_container_1 = require("./postgres-container");
const testcontainers_1 = require("./testcontainers");
class IrohaContainer {
    static async create() {
        const container = await (0, testcontainers_1.buildDockerfile)('iroha-explorer-iroha-test', 'latest', path.resolve(__dirname, '../../../docker/iroha'));
        container.withEnv('KEY', 'node');
        const postgres = await postgres_container_1.PostgresContainer.create('iroha-explorer-backend');
        try {
            const instance = await (0, testcontainers_1.startWithLinks)(container, { 'iroha-explorer-iroha-postgres': postgres.instance });
            try {
                const host = `${await (0, testcontainers_1.inspectIp)(instance)}:50051`;
                await waitOn({ resources: [`tcp:${host}`] });
                return new IrohaContainer(postgres, instance, host);
            }
            catch (e) {
                await instance.stop();
                throw e;
            }
        }
        catch (e) {
            await postgres.stop();
            throw e;
        }
    }
    constructor(postgres, instance, host) {
        this.postgres = postgres;
        this.instance = instance;
        this.host = host;
    }
    stop() {
        return Promise.all([
            this.instance.stop(),
            this.postgres.stop(),
        ]);
    }
}
exports.IrohaContainer = IrohaContainer;
//# sourceMappingURL=iroha-container.js.map