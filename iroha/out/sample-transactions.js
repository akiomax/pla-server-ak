"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = exports.setMyQuorum = exports.addMySignatory = exports.createAccount = void 0;
const tslib_1 = require("tslib");
const ed25519_js_1 = require("ed25519.js");
const grpc = tslib_1.__importStar(require("grpc"));
const iroha_helpers_1 = require("iroha-helpers");
const endpoint_grpc_pb_1 = require("iroha-helpers/lib/proto/endpoint_grpc_pb");
const config_1 = tslib_1.__importDefault(require("./config"));
const publicKey = (0, ed25519_js_1.derivePublicKey)(Buffer.from(config_1.default.iroha.admin.privateKey, 'hex')).toString('hex');
const commandService = new endpoint_grpc_pb_1.CommandService_v1Client(config_1.default.iroha.host, grpc.credentials.createInsecure());
const commandOptions = {
    commandService,
    privateKeys: [config_1.default.iroha.admin.privateKey],
    creatorAccountId: config_1.default.iroha.admin.accountId,
    quorum: 1,
    timeoutLimit: 5000,
};
const createAccount = (accountName, domainId) => iroha_helpers_1.commands.createAccount(commandOptions, { accountName, domainId, publicKey });
exports.createAccount = createAccount;
const addMySignatory = (creatorAccountId, publicKey) => iroha_helpers_1.commands.addSignatory(Object.assign(Object.assign({}, commandOptions), { creatorAccountId }), { accountId: creatorAccountId, publicKey });
exports.addMySignatory = addMySignatory;
const setMyQuorum = (creatorAccountId, quorum) => iroha_helpers_1.commands.setAccountQuorum(Object.assign(Object.assign({}, commandOptions), { creatorAccountId }), { accountId: creatorAccountId, quorum });
exports.setMyQuorum = setMyQuorum;
/** TODO: remove when iroha-helpers treats NOT_RECEIVED as non-terminal status */
async function retry(tx) {
    while (true) {
        try {
            return await tx();
        }
        catch (e) {
            if (e.message && e.message.includes('actual=NOT_RECEIVED')) {
                continue;
            }
            throw e;
        }
    }
}
const main = async () => {
    const key1 = '01'.repeat(32);
    const key2 = '02'.repeat(32);
    const key3 = '03'.repeat(32);
    await retry(() => (0, exports.createAccount)('alice', 'explorer'));
    await retry(() => (0, exports.addMySignatory)('alice@explorer', key1));
    await retry(() => (0, exports.addMySignatory)('alice@explorer', key2));
    await retry(() => (0, exports.setMyQuorum)('alice@explorer', 3));
    await retry(() => (0, exports.createAccount)('bob', 'explorer'));
    await retry(() => (0, exports.addMySignatory)('bob@explorer', key2));
    await retry(() => (0, exports.createAccount)('eve', 'explorer'));
    await retry(() => (0, exports.addMySignatory)('eve@explorer', key3));
    await retry(() => (0, exports.setMyQuorum)('eve@explorer', 2));
};
exports.main = main;
if (module === require.main) {
    // tslint:disable-next-line:no-floating-promises
    (0, exports.main)();
}
//# sourceMappingURL=sample-transactions.js.map