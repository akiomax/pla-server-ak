"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantablePermissionName = exports.rolePermissionName = exports.accountDomain = exports.transactionHash = exports.blockHeight = exports.blockHash = exports.IrohaApi = exports.TransactionProto = exports.BlockProto = void 0;
const tslib_1 = require("tslib");
const grpc = tslib_1.__importStar(require("grpc"));
const js_sha3_1 = require("js-sha3");
const invert_1 = tslib_1.__importDefault(require("lodash/invert"));
const propertyOf_1 = tslib_1.__importDefault(require("lodash/propertyOf"));
const iroha_helpers_1 = require("iroha-helpers");
const endpoint_grpc_pb_1 = require("iroha-helpers/lib/proto/endpoint_grpc_pb");
const primitive_pb_1 = require("iroha-helpers/lib/proto/primitive_pb");
const qry_responses_pb_1 = require("iroha-helpers/lib/proto/qry_responses_pb");
var block_pb_1 = require("iroha-helpers/lib/proto/block_pb");
Object.defineProperty(exports, "BlockProto", { enumerable: true, get: function () { return block_pb_1.Block; } });
var transaction_pb_1 = require("iroha-helpers/lib/proto/transaction_pb");
Object.defineProperty(exports, "TransactionProto", { enumerable: true, get: function () { return transaction_pb_1.Transaction; } });
class IrohaApi {
    constructor(host, accountId, privateKey) {
        this.host = host;
        this.accountId = accountId;
        this.privateKey = privateKey;
        this.queryService = new endpoint_grpc_pb_1.QueryService_v1Client(this.host, grpc.credentials.createInsecure());
    }
    streamBlocks(firstHeight, onBlock) {
        let height = firstHeight;
        let end = false;
        let result = null;
        let onBlockLock = true;
        const streamQueue = [];
        const stream = this.fetchCommits((block) => {
            streamQueue.push(block);
            return streamTryConsume();
        });
        async function streamTryConsume() {
            if (!onBlockLock) {
                onBlockLock = true;
                try {
                    while (streamQueue.length) {
                        const block = streamQueue.shift();
                        if (end) {
                            return;
                        }
                        if ((0, exports.blockHeight)(block) === height) {
                            await onBlock(block);
                            height += 1;
                        }
                    }
                    onBlockLock = false;
                }
                catch (error) {
                    result = error;
                    stream.end();
                }
            }
        }
        return {
            promise: Promise.all([
                (async () => {
                    try {
                        while (true) {
                            const block = await this.getBlock(height);
                            if (end || block === null || streamQueue.length && (0, exports.blockHeight)(streamQueue[0]) <= height) {
                                break;
                            }
                            await onBlock(block);
                            height += 1;
                        }
                        onBlockLock = false;
                    }
                    catch (error) {
                        result = error;
                        stream.end();
                        return;
                    }
                    if (!end) {
                        await streamTryConsume();
                    }
                })(),
                stream.promise,
            ]).then(() => result && Promise.reject(result)),
            end() {
                end = true;
                stream.end();
            },
        };
    }
    fetchCommits(onBlock) {
        let end = false;
        const query = this.prepareQuery(iroha_helpers_1.queryHelper.emptyBlocksQuery());
        const stream = this.queryService.fetchCommits(query);
        const promise = new Promise((resolve, reject) => {
            stream.on('error', (error) => {
                if (error.details === 'Cancelled') {
                    resolve();
                }
                else {
                    reject(error);
                }
            });
            stream.on('data', (response) => {
                if (response.hasBlockErrorResponse()) {
                    /** currently BlockErrorResponse contains only message */
                    reject(new Error(response.getBlockErrorResponse().getMessage()));
                }
                else if (!end) {
                    onBlock(response.getBlockResponse().getBlock());
                }
            });
        });
        return {
            promise,
            end() {
                end = true;
                stream.cancel();
            },
        };
    }
    getBlock(height) {
        return new Promise((resolve, reject) => {
            const query = this.prepareQuery(iroha_helpers_1.queryHelper.addQuery(iroha_helpers_1.queryHelper.emptyQuery(), 'getBlock', { height }));
            this.queryService.find(query, (err, response) => {
                if (err) {
                    reject(err);
                }
                else {
                    if (response.hasErrorResponse()) {
                        const errorResponse = response.getErrorResponse();
                        if (errorResponse.getReason() === qry_responses_pb_1.ErrorResponse.Reason.STATEFUL_INVALID && errorResponse.getErrorCode() === 3 && errorResponse.getMessage() !== 'query signatories did not pass validation') {
                            resolve(null);
                        }
                        else {
                            const error = new Error();
                            error.errorResponse = errorResponse;
                            error.message = error.errorResponse.getMessage();
                            reject(error);
                        }
                    }
                    else {
                        resolve(response.getBlockResponse().getBlock());
                    }
                }
            });
        });
    }
    prepareQuery(query) {
        return iroha_helpers_1.queryHelper.sign(iroha_helpers_1.queryHelper.addMeta(query, { creatorAccountId: this.accountId }), this.privateKey);
    }
}
exports.IrohaApi = IrohaApi;
const blockHash = (block) => (0, js_sha3_1.sha3_256)(block.getBlockV1().getPayload().serializeBinary());
exports.blockHash = blockHash;
const blockHeight = (block) => block.getBlockV1().getPayload().getHeight();
exports.blockHeight = blockHeight;
const transactionHash = (transaction) => (0, js_sha3_1.sha3_256)(transaction.getPayload().serializeBinary());
exports.transactionHash = transactionHash;
const ACCOUNT_REGEX = /^[^@]+@([^@]+)$/;
function accountDomain(accountId) {
    const match = accountId.match(ACCOUNT_REGEX);
    return match && match[1];
}
exports.accountDomain = accountDomain;
exports.rolePermissionName = (0, propertyOf_1.default)((0, invert_1.default)(primitive_pb_1.RolePermission));
exports.grantablePermissionName = (0, propertyOf_1.default)((0, invert_1.default)(primitive_pb_1.GrantablePermission));
//# sourceMappingURL=iroha-api.js.map