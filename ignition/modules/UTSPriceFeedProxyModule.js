const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UTSPriceFeedProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");

    const priceFeedImplementation = m.contract("UTSPriceFeed");

    const priceFeedProxy = m.contract('ERC1967Proxy', [priceFeedImplementation, initializeCalldata]);

    return { priceFeedImplementation, priceFeedProxy };
});