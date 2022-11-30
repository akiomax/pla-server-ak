"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = exports.sync = void 0;
const tslib_1 = require("tslib");
const slonik_1 = require("slonik");
const config_1 = tslib_1.__importDefault(require("./config"));
const iroha_api_1 = require("./iroha-api");
const iroha_db_1 = require("./iroha-db");
const logger_1 = require("./logger");
const prometheus = tslib_1.__importStar(require("./prometheus"));
function sync(api, db) {
    let end = false;
    let stream = null;
    return {
        promise: db.blockCount().then((blockCount) => {
            if (end) {
                return;
            }
            stream = api.streamBlocks(blockCount + 1, async (block) => {
                logger_1.logger.info(`sync block ${(0, iroha_api_1.blockHeight)(block)}`);
                await db.applyBlock(block);
                await prometheus.readFromDb(db);
            });
            return stream.promise;
        }),
        end() {
            end = true;
            if (stream) {
                stream.end();
            }
        },
    };
}
exports.sync = sync;
async function main() {
    const api = new iroha_api_1.IrohaApi(config_1.default.iroha.host, config_1.default.iroha.admin.accountId, config_1.default.iroha.admin.privateKey);
    const db = new iroha_db_1.IrohaDb((0, slonik_1.createPool)(config_1.default.postgres));
    const stream = sync(api, db);
    process.once('SIGTERM', () => stream.end());
    await stream.promise;
}
exports.main = main;
if (module === require.main) {
    // tslint:disable-next-line:no-floating-promises
    main();
}
//# sourceMappingURL=sync.js.map