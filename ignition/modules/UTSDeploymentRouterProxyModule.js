const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UTSDeploymentRouterProxyModule", (m) => {

    const initializeCalldata = m.getParameter("initializeCalldata");
    const masterRouterAddress = m.getParameter("masterRouterAddress");
    const priceFeedAddress = m.getParameter("priceFeedAddress");
    const factoryAddress = m.getParameter("factoryAddress");
    const registryAddress = m.getParameter("registryAddress");
    const paymentTokenAddress = m.getParameter("paymentTokenAddress");
    const paymentTokenDecimals = m.getParameter("paymentTokenDecimals");
    const nativeTokenDecimals = m.getParameter("nativeTokenDecimals");
    const paymentTransferGasLimit = m.getParameter("paymentTransferGasLimit");
    const availableChainsNumber = m.getParameter("availableChainsNumber");

    const dRouterImplementation = m.contract(
        "UTSDeploymentRouter", 
        [
            masterRouterAddress, 
            priceFeedAddress, 
            factoryAddress, 
            registryAddress, 
            paymentTokenAddress, 
            paymentTokenDecimals, 
            nativeTokenDecimals, 
            paymentTransferGasLimit, 
            availableChainsNumber
        ]
    );

    const dRouterProxy = m.contract('ERC1967Proxy', [dRouterImplementation, initializeCalldata]);

    return { dRouterImplementation, dRouterProxy };
});