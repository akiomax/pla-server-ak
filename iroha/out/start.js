"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
require("./logger");
const config_1 = tslib_1.__importDefault(require("./config"));
const db = tslib_1.__importStar(require("./db"));
const init = tslib_1.__importStar(require("./init"));
const prometheus = tslib_1.__importStar(require("./prometheus"));
const server = tslib_1.__importStar(require("./server"));
const sync = tslib_1.__importStar(require("./sync"));
async function main() {
    await db.connect();
    await init.main();
    // tslint:disable-next-line:no-floating-promises
    server.main();
    if (!config_1.default.disableSync) {
        // tslint:disable-next-line:no-floating-promises
        prometheus.readFromDb(db.db);
        // tslint:disable-next-line:no-floating-promises
        sync.main();
    }
}
// tslint:disable-next-line:no-floating-promises
main();
//# sourceMappingURL=start.js.map