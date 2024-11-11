const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UTSMasterRouterProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const endpointAddress = m.getParameter("endpointAddress"); 
    const getRouterGasLimit = m.getParameter("getRouterGasLimit");

    const masterRouterImplementation = m.contract("UTSMasterRouter", [endpointAddress, getRouterGasLimit]);

    const masterRouterProxy = m.contract('ERC1967Proxy', [masterRouterImplementation, initializeCalldata]);

    return { masterRouterImplementation, masterRouterProxy };
});