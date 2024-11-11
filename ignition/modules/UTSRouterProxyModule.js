const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UTSRouterProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const masterRouterAddress = m.getParameter("masterRouterAddress");
    const priceFeedAddress = m.getParameter("priceFeedAddress");
    const storeGasLimit = m.getParameter("storeGasLimit");
    const updateGasLimit = m.getParameter("updateGasLimit");
    const paymentTransferGasLimit = m.getParameter("paymentTransferGasLimit");

    const routerImplementation = m.contract("UTSRouter", [masterRouterAddress, priceFeedAddress, storeGasLimit, updateGasLimit, paymentTransferGasLimit]);

    const routerProxy = m.contract('ERC1967Proxy', [routerImplementation, initializeCalldata]);

    return { routerImplementation, routerProxy };
});