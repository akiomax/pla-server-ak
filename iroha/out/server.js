"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const tslib_1 = require("tslib");
const logger_1 = require("./logger");
const graphql_yoga_1 = require("graphql-yoga");
const serve_static_1 = tslib_1.__importDefault(require("serve-static"));
const slonik_1 = require("slonik");
const config_1 = tslib_1.__importDefault(require("./config"));
const files_1 = require("./files");
const graphql_1 = require("./graphql");
const iroha_db_1 = require("./iroha-db");
const prometheus = tslib_1.__importStar(require("./prometheus"));
const db = new iroha_db_1.IrohaDb((0, slonik_1.createPool)(config_1.default.postgres));
const server = new graphql_yoga_1.GraphQLServer({ schema: graphql_1.schema, context: db.fork });
server.get('/graphql', (_, res) => res.end(files_1.graphiqlHtml));
server.use('/doc', (0, serve_static_1.default)(files_1.docPath));
server.use('/', (0, serve_static_1.default)(files_1.frontendPath));
server.post('/logLevel', (req, res) => {
    const { level } = req.query;
    if ((0, logger_1.checkLogLevel)(level)) {
        (0, logger_1.setLogLevel)(level);
    }
    else {
        res.statusCode = 400;
    }
    res.end();
});
server.get('/prometheus', prometheus.httpHandler);
server.get('/health', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'UP' });
});
async function main() {
    const http = await server.start({ endpoint: '/graphql', playground: false }, () => logger_1.logger.info(`Server is running on localhost:${server.options.port}`));
    process.once('SIGTERM', () => http.close());
}
exports.main = main;
if (module === require.main) {
    // tslint:disable-next-line:no-floating-promises
    main();
}
//# sourceMappingURL=server.js.map