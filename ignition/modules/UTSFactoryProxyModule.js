const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UTSFactoryProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const masterRouterAddress = m.getParameter("masterRouterAddress");
    const registryAddress = m.getParameter("registryAddress");

    const factoryImplementation = m.contract("UTSFactory", [masterRouterAddress, registryAddress]);

    const factoryProxy = m.contract('ERC1967Proxy', [factoryImplementation, initializeCalldata]);

    return { factoryImplementation, factoryProxy };
});