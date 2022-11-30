"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.account3 = exports.account2 = exports.account1 = exports.steps = exports.Step = exports.makeBlock = void 0;
const block_pb_1 = require("iroha-helpers/lib/proto/block_pb");
const commands_pb_1 = require("iroha-helpers/lib/proto/commands_pb");
const transaction_pb_1 = require("iroha-helpers/lib/proto/transaction_pb");
function makeBlock(height, createdTime, transactions) {
    const payload = new block_pb_1.Block_v1.Payload();
    payload.setHeight(height);
    payload.setCreatedTime(new Date(createdTime).getTime());
    payload.setTransactionsList(transactions);
    const blockV1 = new block_pb_1.Block_v1();
    blockV1.setPayload(payload);
    const block = new block_pb_1.Block();
    block.setBlockV1(blockV1);
    return block;
}
exports.makeBlock = makeBlock;
function transaction(creatorAccountId, commands) {
    const reducedPayload = new transaction_pb_1.Transaction.Payload.ReducedPayload();
    reducedPayload.setCommandsList(commands);
    reducedPayload.setCreatorAccountId(creatorAccountId);
    const payload = new transaction_pb_1.Transaction.Payload();
    payload.setReducedPayload(reducedPayload);
    const transaction = new transaction_pb_1.Transaction();
    transaction.setPayload(payload);
    return transaction;
}
function createAccount(id) {
    const createAccount = new commands_pb_1.CreateAccount();
    const [name, domain] = id.split('@');
    createAccount.setAccountName(name);
    createAccount.setDomainId(domain);
    const command = new commands_pb_1.Command();
    command.setCreateAccount(createAccount);
    return command;
}
function createDomain(id) {
    const createDomain = new commands_pb_1.CreateDomain();
    createDomain.setDefaultRole('mock');
    createDomain.setDomainId(id);
    const command = new commands_pb_1.Command();
    command.setCreateDomain(createDomain);
    return command;
}
function setAccountQuorum(accountId, quorum) {
    const setAccountQuorum = new commands_pb_1.SetAccountQuorum();
    setAccountQuorum.setQuorum(quorum);
    setAccountQuorum.setAccountId(accountId);
    const command = new commands_pb_1.Command();
    command.setSetAccountQuorum(setAccountQuorum);
    return command;
}
class Step {
    constructor(prev, block) {
        this.block = block;
        this.blocks = [];
        this.transactions = [];
        this.accountQuorum = {};
        if (prev) {
            this.blocks = prev.blocks.slice();
            this.transactions = prev.transactions.slice();
            this.accountQuorum = Object.assign({}, prev.accountQuorum);
        }
        this.blocks.push(block);
        for (const transaction of block.getBlockV1().getPayload().getTransactionsList()) {
            this.transactions.push(transaction);
            for (const command of transaction.getPayload().getReducedPayload().getCommandsList()) {
                if (command.hasCreateAccount()) {
                    const createAccount = command.getCreateAccount();
                    this.accountQuorum[`${createAccount.getAccountName()}@${createAccount.getDomainId()}`] = 1;
                }
                else if (command.hasSetAccountQuorum()) {
                    const setAccountQuorum = command.getSetAccountQuorum();
                    this.accountQuorum[setAccountQuorum.getAccountId()] = setAccountQuorum.getQuorum();
                }
            }
        }
    }
}
exports.Step = Step;
exports.steps = [];
function addStep(createdTime, transactions) {
    exports.steps.push(new Step(exports.steps.length ? exports.steps[exports.steps.length - 1] : null, makeBlock(exports.steps.length + 1, createdTime, transactions)));
}
exports.account1 = 'alice@explorer';
exports.account2 = 'bob@explorer';
exports.account3 = 'eve@explorer';
addStep('2019-01-01T09:00Z', [
    transaction(exports.account1, [
        createDomain('explorer'),
        createAccount(exports.account1),
    ]),
]);
addStep('2019-01-01T11:57Z', [
    transaction(exports.account1, [
        createAccount(exports.account2),
    ]),
    transaction(exports.account2, [
        setAccountQuorum(exports.account1, 3),
    ]),
]);
addStep('2019-01-01T11:59Z', [
    transaction(exports.account2, [
        createAccount(exports.account3),
    ]),
]);
//# sourceMappingURL=iroha-data.js.map