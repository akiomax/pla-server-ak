"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresContainer = void 0;
const tslib_1 = require("tslib");
const testcontainers_1 = require("testcontainers");
const Url = tslib_1.__importStar(require("url"));
const waitOn = require("wait-on");
const testcontainers_2 = require("./testcontainers");
class PostgresContainer {
    static async create(password) {
        const instance = await new testcontainers_1.GenericContainer('postgres', '9.5')
            .withEnv('POSTGRES_PASSWORD', password)
            .start();
        try {
            const url = Url.parse(`postgres://postgres:${password}@${await (0, testcontainers_2.inspectIp)(instance)}:5432/postgres`);
            await waitOn({ resources: [`tcp:${url.host}`] });
            return new PostgresContainer(instance, password, url);
        }
        catch (e) {
            await instance.stop();
            throw e;
        }
    }
    constructor(instance, password, url) {
        this.instance = instance;
        this.password = password;
        this.url = url;
    }
    stop() {
        return this.instance.stop();
    }
}
exports.PostgresContainer = PostgresContainer;
//# sourceMappingURL=postgres-container.js.map