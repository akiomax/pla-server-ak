"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const tslib_1 = require("tslib");
require("./logger");
const slonik_1 = require("slonik");
const config_1 = tslib_1.__importDefault(require("./config"));
const iroha_db_1 = require("./iroha-db");
async function main() {
    await iroha_db_1.IrohaDb.init((0, slonik_1.createPool)(config_1.default.postgres));
}
exports.main = main;
if (module === require.main) {
    // tslint:disable-next-line:no-floating-promises
    main();
}
//# sourceMappingURL=init.js.map