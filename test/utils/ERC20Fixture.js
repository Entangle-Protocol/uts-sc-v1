const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const UTSDeploymentRouterProxyModule = require("../../ignition/modules/UTSDeploymentRouterProxyModule");
const UTSFactoryProxyModule = require("../../ignition/modules/UTSFactoryProxyModule");
const UTSRouterProxyModule = require("../../ignition/modules/UTSRouterProxyModule");
const UTSCodeStorageModule = require("../../ignition/modules/UTSCodeStorageModule");

const { coreFixture, testCurChainId, testDstChainId, withDecimals } = require("./CoreFixture");

async function ERC20Fixture() {
    const {
        admin, user, executor, registry, zeroHash, zeroAddress, adminRole, approverRole, factoryRole, routerRole, endpoint, masterRouter,
        protocolId, functionSelector, providerRole, baseFeePerGasInWei, feeCollector, priceFeed, prices, groupId, initCalldata
    } = await loadFixture(coreFixture);

    const ERC20Mock = await ethers.getContractFactory("ERC20Mock", admin);
    const paymentToken = await ERC20Mock.deploy(18);
    await paymentToken.waitForDeployment();

    const { factoryProxy } = await ignition.deploy(UTSFactoryProxyModule, {
        parameters: {
            UTSFactoryProxyModule: {
                initializeCalldata: initCalldata,
                masterRouterAddress: masterRouter.target,
                registryAddress: registry.target,
            },
        },
    });

    const { routerProxy } = await ignition.deploy(UTSRouterProxyModule, {
        parameters: {
            UTSRouterProxyModule: {
                initializeCalldata: initCalldata,
                masterRouterAddress: masterRouter.target,
                priceFeedAddress: priceFeed.target,
                storeGasLimit: 45000,
                serviceGas: 125000,
                updateGasLimit: 30000,
                paymentTransferGasLimit: 3000,
            },
        },
    });

    const { dRouterProxy } = await ignition.deploy(UTSDeploymentRouterProxyModule, {
        parameters: {
            UTSDeploymentRouterProxyModule: {
                initializeCalldata: initCalldata,
                masterRouterAddress: masterRouter.target,
                priceFeedAddress: priceFeed.target,
                factoryAddress: factoryProxy.target,
                registryAddress: registry.target,
                paymentTokenAddress: paymentToken.target,
                paymentTokenDecimals: 18,
                nativeTokenDecimals: 18,
                paymentTransferGasLimit: 3000,
                availableChainsNumber: 12
            },
        },
    });

    const {
        codeStorage,
        codeStorageMintable,
        codeStorageTokenWithFee,
        codeStorageMintableWithFee,
        codeStoragePure,
        codeStorageConnectorWithFee
    } = await ignition.deploy(UTSCodeStorageModule);

    const factory = await ethers.getContractAt("UTSFactory", factoryProxy);
    const router = await ethers.getContractAt("UTSRouter", routerProxy);
    const dRouter = await ethers.getContractAt("UTSDeploymentRouter", dRouterProxy);

    const justToken = await ERC20Mock.deploy(18);
    await justToken.waitForDeployment();

    const RouterMock = await ethers.getContractFactory("RouterMock", admin);
    const mockRouter = await RouterMock.deploy();
    await mockRouter.waitForDeployment();

    const pauserRole = await factory.PAUSER_ROLE();
    const managerRole = await router.MANAGER_ROLE();

    const minGasLimit = 200000n;
    const deployTokenGas = 3300000n;
    const deployConnectorGas = 2500000n;

    await factory.connect(admin).setCodeStorage(
        [0, 1, 2, 3, 4, 5],
        [
            codeStorage.target,
            codeStorageMintable.target,
            codeStorageTokenWithFee.target,
            codeStorageMintableWithFee.target,
            codeStoragePure.target,
            codeStorageConnectorWithFee.target
        ]
    );

    await masterRouter.connect(admin).grantRole(routerRole, router.target);
    await masterRouter.connect(admin).grantRole(routerRole, dRouter.target);
    await registry.connect(admin).grantRole(factoryRole, factory.target);
    await factory.connect(admin).setRouter(dRouter.target);

    await router.connect(admin).grantRole(managerRole, admin);
    await router.connect(admin).setDstMinGasLimit([testDstChainId], [minGasLimit]);

    await dRouter.connect(admin).setDstDeployConfig(
        [testDstChainId],
        [[factory.target, deployTokenGas, deployConnectorGas, 0n]]
    );

    await justToken.connect(admin).transfer(user, withDecimals("10000"));
    await justToken.connect(admin).transfer(executor, withDecimals("10000"));

    const paymentTokenToNativeRateChainId = await dRouter.EOB_CHAIN_ID();

    return {
        admin, user, executor, factory, router, registry, justToken, zeroHash, zeroAddress, adminRole, approverRole, factoryRole, routerRole,
        mockRouter, endpoint, masterRouter, protocolId, functionSelector, pauserRole, managerRole, minGasLimit, providerRole, baseFeePerGasInWei,
        feeCollector, priceFeed, prices, groupId, dRouter, paymentToken, deployTokenGas, deployConnectorGas, codeStorage, paymentTokenToNativeRateChainId,
        codeStorageMintable, codeStorageTokenWithFee, codeStorageMintableWithFee, codeStoragePure, codeStorageConnectorWithFee
    };
};

module.exports = { ERC20Fixture, testCurChainId, testDstChainId, withDecimals };