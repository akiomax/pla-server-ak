"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.frontendPath = exports.docPath = exports.postgresSql = exports.graphqlGql = exports.graphiqlHtml = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const root = (0, path_1.resolve)(__dirname, '..');
const read = (path) => (0, fs_1.readFileSync)((0, path_1.resolve)(root, path)).toString();
exports.graphiqlHtml = read('files/graphiql.html');
exports.graphqlGql = read('files/graphql.gql');
exports.postgresSql = read('files/postgres.sql');
exports.docPath = (0, path_1.resolve)(root, 'doc');
exports.frontendPath = (0, path_1.resolve)(root, 'frontend');
//# sourceMappingURL=files.js.map