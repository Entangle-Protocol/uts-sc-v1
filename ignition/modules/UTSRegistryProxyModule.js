const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UTSRegistryProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");

    const registryImplementation = m.contract("UTSRegistry");

    const registryProxy = m.contract('ERC1967Proxy', [registryImplementation, initializeCalldata]);

    return { registryImplementation, registryProxy };
});