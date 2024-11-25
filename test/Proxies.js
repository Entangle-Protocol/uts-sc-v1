const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testCurChainId, testDstChainId } = require("./utils/ERC20Fixture");
const { globalProtocolVersion } = require("./utils/GlobalConstants");

describe("Proxies test", function () {
    it("Base test", async function () {
        const { feeCollector, admin, adminRole, user, factory, router, registry, approverRole, masterRouter, priceFeed, dRouter, deployTokenGas, deployConnectorGas } = await loadFixture(ERC20Fixture);

        expect(await masterRouter.hasRole(adminRole, admin)).to.equal(true);
        expect(await priceFeed.hasRole(adminRole, admin)).to.equal(true);
        expect(await registry.hasRole(adminRole, admin)).to.equal(true);
        expect(await factory.hasRole(adminRole, admin)).to.equal(true);
        expect(await dRouter.hasRole(adminRole, admin)).to.equal(true);
        expect(await router.hasRole(adminRole, admin)).to.equal(true);

        await expect(masterRouter.connect(user).upgradeToAndCall(
            registry.target,
            "0x"
        )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

        await expect(factory.connect(user).upgradeToAndCall(
            registry.target,
            "0x"
        )).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");

        await expect(registry.connect(user).upgradeToAndCall(
            factory.target,
            "0x"
        )).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

        await expect(router.connect(user).upgradeToAndCall(
            factory.target,
            "0x"
        )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

        await expect(priceFeed.connect(user).upgradeToAndCall(
            factory.target,
            "0x"
        )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");

        await expect(dRouter.connect(user).upgradeToAndCall(
            factory.target,
            "0x"
        )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");

        await expect(masterRouter.connect(user).initialize(
            user,
            user
        )).to.be.revertedWithCustomError(masterRouter, "InvalidInitialization");

        await expect(factory.connect(user).initialize(
            user,
            user
        )).to.be.revertedWithCustomError(factory, "InvalidInitialization");

        await expect(registry.connect(user).initialize(
            user
        )).to.be.revertedWithCustomError(registry, "InvalidInitialization");

        await expect(router.connect(user).initialize(
            user,
            user
        )).to.be.revertedWithCustomError(router, "InvalidInitialization");

        await expect(priceFeed.connect(user).initialize(
            user
        )).to.be.revertedWithCustomError(priceFeed, "InvalidInitialization");

        await expect(dRouter.connect(user).initialize(
            user
        )).to.be.revertedWithCustomError(dRouter, "InvalidInitialization");

        await expect(router.connect(user).pause()).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");
        await expect(router.connect(user).unpause()).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");
        await expect(factory.connect(user).pause()).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
        await expect(factory.connect(user).unpause()).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");
        await expect(priceFeed.connect(user).pause()).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
        await expect(priceFeed.connect(user).unpause()).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
        await expect(dRouter.connect(user).pause()).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        await expect(dRouter.connect(user).unpause()).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");

        expect(await masterRouter.feeCollector()).to.equal(feeCollector);
        expect(await factory.router()).to.equal(dRouter.target);
        expect(await router.MASTER_ROUTER()).to.equal(masterRouter.target);
        expect(await dRouter.dstTokenDeployGas(testDstChainId)).to.equal(deployTokenGas);
        expect(await dRouter.dstConnectorDeployGas(testDstChainId)).to.equal(deployConnectorGas);

        expect(await router.protocolVersion()).to.equal(globalProtocolVersion);
        expect(await factory.protocolVersion()).to.equal(globalProtocolVersion);
        expect(await dRouter.protocolVersion()).to.equal(globalProtocolVersion);

        expect(await router.paused()).to.equal(false);
        expect(await factory.paused()).to.equal(false);
        expect(await priceFeed.paused()).to.equal(false);
        expect(await dRouter.paused()).to.equal(false);

        let chainInfo = await priceFeed.getChainInfo(testDstChainId);
        expect(chainInfo.reserved).to.equal(0);
        expect(chainInfo.groupId).to.equal(2);
        expect(chainInfo.slotOffset).to.equal(0);
        expect(chainInfo.pricePerByte).to.equal(0);

        const RouterImplMock = await ethers.getContractFactory("RouterImplMock", admin);
        const mockImplRouter = await RouterImplMock.deploy();
        await mockImplRouter.waitForDeployment();

        const MasterRouterImplMock = await ethers.getContractFactory("MasterRouterImplMock", admin);
        const mockImplMasterRouter = await MasterRouterImplMock.deploy();
        await mockImplMasterRouter.waitForDeployment();

        const FactoryImplMock = await ethers.getContractFactory("FactoryImplMock", admin);
        const mockImplFactory = await FactoryImplMock.deploy();
        await mockImplFactory.waitForDeployment();

        const RegistryImplMock = await ethers.getContractFactory("RegistryImplMock", admin);
        const mockImplRegistry = await RegistryImplMock.deploy();
        await mockImplRegistry.waitForDeployment();

        const PriceFeedImplMock = await ethers.getContractFactory("PriceFeedImplMock", admin);
        const mockImplPriceFeed = await PriceFeedImplMock.deploy();
        await mockImplPriceFeed.waitForDeployment();

        const DeploymentRouterImplMock = await ethers.getContractFactory("DeploymentRouterImplMock", admin);
        const mockImplDeploymentRouter = await DeploymentRouterImplMock.deploy();
        await mockImplDeploymentRouter.waitForDeployment();

        await registry.connect(admin).grantRole(approverRole, admin);

        await registry.connect(admin).approveRequestBatch([[
            registry.target,
            admin.address,
            registry.target,
            globalProtocolVersion
        ]]);

        expect(await registry.totalDeployments()).to.equal(1n);

        await registry.connect(admin).upgradeToAndCall(mockImplRegistry.target, "0x");
        await factory.connect(admin).upgradeToAndCall(mockImplFactory.target, "0x");
        await router.connect(admin).upgradeToAndCall(mockImplRouter.target, "0x");
        await masterRouter.connect(admin).upgradeToAndCall(mockImplMasterRouter.target, "0x");
        await priceFeed.connect(admin).upgradeToAndCall(mockImplPriceFeed.target, "0x");
        await dRouter.connect(admin).upgradeToAndCall(mockImplDeploymentRouter.target, "0x");

        const upgradedRegistry = await ethers.getContractAt("RegistryImplMock", registry.target);
        const upgradedMasterRouter = await ethers.getContractAt("MasterRouterImplMock", masterRouter.target);

        expect(await upgradedRegistry.protocolVersion()).to.equal("0xffff");
        expect(await factory.protocolVersion()).to.equal("0xffff");
        expect(await router.protocolVersion()).to.equal("0xffff");
        expect(await upgradedMasterRouter.protocolVersion()).to.equal("0xffff");
        expect(await dRouter.protocolVersion()).to.equal("0xffff");

        expect(await registry.totalDeployments()).to.equal(1n);
        expect(await factory.router()).to.equal(dRouter.target);
        expect(await upgradedMasterRouter.feeCollector()).to.equal(feeCollector);
        expect(await dRouter.dstTokenDeployGas(testDstChainId)).to.equal(deployTokenGas);
        expect(await dRouter.dstConnectorDeployGas(testDstChainId)).to.equal(deployConnectorGas);

        chainInfo = await priceFeed.getChainInfo(testDstChainId);
        expect(chainInfo.reserved).to.equal(0);
        expect(chainInfo.groupId).to.equal(2);
        expect(chainInfo.slotOffset).to.equal(0);
        expect(chainInfo.pricePerByte).to.equal(0);

        chainInfo = await priceFeed.getChainInfo(testCurChainId);
        expect(chainInfo.reserved).to.equal(17);
        expect(chainInfo.groupId).to.equal(27);
        expect(chainInfo.slotOffset).to.equal(37);
        expect(chainInfo.pricePerByte).to.equal(47);
    });
});