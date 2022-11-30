"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.readFromDb = exports.httpHandler = exports.peersTotal = exports.accountsTotal = exports.transactionsTotal = exports.blocksTotal = void 0;
const tslib_1 = require("tslib");
const zipWith_1 = tslib_1.__importDefault(require("lodash/zipWith"));
const prom_client_1 = require("prom-client");
const config_1 = tslib_1.__importDefault(require("./config"));
function counterSet(counter, value) {
    counter.reset();
    counter.inc(value);
}
const prefix = 'explorer';
_a = [
    'blocks',
    'transactions',
    'accounts',
    'peers',
].map(name => new prom_client_1.Counter({
    name: `${prefix}_${name}_total`,
    help: `${name} count`,
})), exports.blocksTotal = _a[0], exports.transactionsTotal = _a[1], exports.accountsTotal = _a[2], exports.peersTotal = _a[3];
function httpHandler(req, res) {
    if (config_1.default.disableSync) {
        res.statusCode = 501;
        res.end();
    }
    else {
        res.setHeader('Content-Type', prom_client_1.register.contentType);
        res.end(prom_client_1.register.metrics());
    }
}
exports.httpHandler = httpHandler;
async function readFromDb(db) {
    (0, zipWith_1.default)([
        exports.blocksTotal,
        exports.transactionsTotal,
        exports.accountsTotal,
        exports.peersTotal,
    ], await Promise.all([
        db.blockCount(),
        db.transactionCount(),
        db.accountCount(),
        db.peerCount(),
    ]), counterSet);
}
exports.readFromDb = readFromDb;
//# sourceMappingURL=prometheus.js.map