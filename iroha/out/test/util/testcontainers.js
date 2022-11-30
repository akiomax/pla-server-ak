"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDockerfile = exports.startWithLinks = exports.inspectIp = void 0;
const testcontainers_1 = require("testcontainers");
const docker_client_factory_1 = require("testcontainers/dist/docker-client-factory");
const repo_tag_1 = require("testcontainers/dist/repo-tag");
/** HACK: get dockerode client */
const dockerodeContainer = (instance) => instance.container.container;
/** HACK: get ip address via docker inspect */
async function inspectIp(instance) {
    const result = await dockerodeContainer(instance).inspect();
    return result.NetworkSettings.IPAddress;
}
exports.inspectIp = inspectIp;
/** HACK: pass extra arguments to dockerode */
async function startWithLinks(container, links) {
    const linksList = Object.entries(links).map(([alias, instance]) => `${dockerodeContainer(instance).id}:${alias}`);
    // tslint:disable-next-line:ter-prefer-arrow-callback
    const containerOverlay = new (Object.assign(function () { }, { prototype: container }));
    containerOverlay.dockerClient = containerOverlay.dockerClientFactory.getClient();
    const client = containerOverlay.dockerClient.dockerode;
    const createContainer = client.createContainer;
    client.createContainer = function (options) {
        options.HostConfig.Links = linksList;
        return createContainer.call(this, options);
    };
    return containerOverlay.start();
}
exports.startWithLinks = startWithLinks;
async function buildDockerfile(image, tag, context) {
    await new docker_client_factory_1.DockerodeClientFactory().getClient().buildImage(new repo_tag_1.RepoTag(image, tag), context);
    return new testcontainers_1.GenericContainer(image, tag);
}
exports.buildDockerfile = buildDockerfile;
//# sourceMappingURL=testcontainers.js.map