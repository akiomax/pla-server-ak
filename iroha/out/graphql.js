"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schema = void 0;
const tslib_1 = require("tslib");
const graphql_tools_1 = require("graphql-tools");
const flatMap_1 = tslib_1.__importDefault(require("lodash/fp/flatMap"));
const map_1 = tslib_1.__importDefault(require("lodash/fp/map"));
const prop_1 = tslib_1.__importDefault(require("lodash/fp/prop"));
const uniq_1 = tslib_1.__importDefault(require("lodash/uniq"));
const files_1 = require("./files");
const iroha_api_1 = require("./iroha-api");
const iroha_db_1 = require("./iroha-db");
exports.schema = (0, graphql_tools_1.makeExecutableSchema)({
    typeDefs: files_1.graphqlGql,
    resolvers: {
        Block: {
            height: iroha_api_1.blockHeight,
            hash: iroha_api_1.blockHash,
            transactionCount: (block) => block.getBlockV1().getPayload().getTransactionsList().length,
            time: (block) => new Date(block.getBlockV1().getPayload().getCreatedTime()).toISOString(),
            transactions: iroha_db_1.getBlockTransactions,
            previousBlockHash: (block) => block.getBlockV1().getPayload().getPrevBlockHash(),
        },
        Transaction: {
            hash: (transaction) => (0, iroha_api_1.transactionHash)(transaction.protobuf),
            createdBy: (transaction, {}, { accountLoader }) => {
                const creatorId = transaction.protobuf.getPayload().getReducedPayload().getCreatorAccountId();
                return creatorId && accountLoader.load(creatorId);
            },
            blockHeight: (transaction) => transaction.block_height,
            signatories: (transaction) => transaction.protobuf.getSignaturesList().map(signature => signature.getPublicKey()),
            commandsJson: (transaction) => JSON.stringify(transaction.protobuf.getPayload().getReducedPayload().toObject().commandsList),
        },
        Account: {
            roles: (account, {}, { roleLoader }) => roleLoader.loadMany(account.roles),
            permissions: (account, {}, { roleLoader }) => roleLoader.loadMany(account.roles)
                .then((0, flatMap_1.default)((0, prop_1.default)('permissions')))
                .then(uniq_1.default)
                .then((0, map_1.default)(iroha_api_1.rolePermissionName)),
            permissionsGrantedBy: (account) => account.permissions_granted.filter(x => x.by === account.id),
            permissionsGrantedTo: (account) => account.permissions_granted.filter(x => x.to === account.id),
        },
        PermissionGranted: {
            permission: ({ permission }) => (0, iroha_api_1.grantablePermissionName)(permission),
        },
        Peer: {
            publicKey: (peer) => peer.public_key,
        },
        Role: {
            permissions: (role) => role.permissions.map(iroha_api_1.rolePermissionName),
        },
        Domain: {
            defaultRole: (domain, {}, { roleLoader }) => roleLoader.load(domain.default_role),
        },
        Query: {
            blockCount: (_, {}, db) => db.blockCount(),
            transactionCount: (_, {}, db) => db.transactionCount(),
            accountCount: (_, {}, db) => db.accountCount(),
            peerCount: (_, {}, db) => db.peerCount(),
            roleCount: (_, {}, db) => db.roleCount(),
            domainCount: (_, {}, db) => db.domainCount(),
            blockByHeight: (_, { height }, { blockLoader }) => blockLoader.load(height),
            transactionByHash: (_, { hash }, { transactionLoader }) => transactionLoader.load(hash),
            accountById: (_, { id }, { accountLoader }) => accountLoader.load(id),
            peerByPublicKey: (_, { publicKey }, { peerLoader }) => peerLoader.load(publicKey),
            roleByName: (_, { name }, { roleLoader }) => roleLoader.load(name),
            domainById: (_, { id }, { domainLoader }) => domainLoader.load(id),
            blockList: (_, { after, count, timeAfter, timeBefore, reverse }, db) => db.blockList({ after, count, reverse, timeAfter, timeBefore }),
            transactionList: (_, { after, count, timeAfter, timeBefore, creatorId }, db) => db.transactionList({ after, count, timeAfter, timeBefore, creatorId }),
            accountList: (_, { after, count, id }, db) => db.accountList({ after, count, id }),
            peerList: (_, { after, count }, db) => db.peerList({ after, count }),
            roleList: (_, { after, count }, db) => db.roleList({ after, count }),
            domainList: (_, { after, count }, db) => db.domainList({ after, count }),
            transactionCountPerMinute: (_, { count }, db) => db.transactionCountPerMinute(count),
            transactionCountPerHour: (_, { count }, db) => db.transactionCountPerHour(count),
            blockCountPerMinute: (_, { count }, db) => db.blockCountPerMinute(count),
            blockCountPerHour: (_, { count }, db) => db.blockCountPerHour(count),
            transactionCountPerDomain: (_, {}, db) => db.transactionCountPerDomain(),
        },
    },
});
//# sourceMappingURL=graphql.js.map