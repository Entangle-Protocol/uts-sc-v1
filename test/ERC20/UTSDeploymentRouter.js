const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("../utils/ERC20Fixture");
const { globalProtocolVersion, routerBridgeMessageType } = require("../utils/GlobalConstants");
const {
    convertToBytes, encodeParamsToDeployToken, encodeParamsToDeployConnector,
    encodeParamsToDeploy, validateDeployFee, deployTokenByFactory, AbiCoder
} = require("../utils/ERC20UtilFunctions");

describe("UTS DeploymentRouter", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { dRouter, factory, masterRouter, priceFeed, registry, paymentToken, deployTokenGas, deployConnectorGas, paymentTokenToNativeRateChainId } = await loadFixture(ERC20Fixture);

            expect(await dRouter.dstFactory(testDstChainId)).to.equal(factory.target.toLowerCase());
            expect(await dRouter.MASTER_ROUTER()).to.equal(masterRouter.target);
            expect(await dRouter.PRICE_FEED()).to.equal(priceFeed.target);
            expect(await dRouter.FACTORY()).to.equal(factory.target);
            expect(await dRouter.REGISTRY()).to.equal(registry.target);
            expect(await dRouter.PAYMENT_TOKEN()).to.equal(paymentToken.target);
            expect(await dRouter.EOB_CHAIN_ID()).to.equal(paymentTokenToNativeRateChainId);
            expect(await dRouter.dstTokenDeployGas(testDstChainId)).to.equal(deployTokenGas);
            expect(await dRouter.dstConnectorDeployGas(testDstChainId)).to.equal(deployConnectorGas);
            expect(await dRouter.protocolVersion()).to.equal(globalProtocolVersion);
        });
    });

    describe("Pausable", function () {
        it("sendDeployRequest", async function () {
            const { masterRouter, priceFeed, paymentToken, admin, router, dRouter, pauserRole } = await loadFixture(ERC20Fixture);

            await paymentToken.connect(admin).approve(dRouter, await paymentToken.balanceOf(admin));

            const [tokenDeployParams, localParams, params] = await encodeParamsToDeployToken(
                dRouter,
                admin,
                admin,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await dRouter.paused()).to.equal(false);

            await dRouter.connect(admin).grantRole(pauserRole, admin);
            await dRouter.connect(admin).pause();

            expect(await dRouter.paused()).to.equal(true);

            await expect(dRouter.connect(admin).sendDeployRequest([[
                testDstChainId,
                false,
                tokenDeployParams
            ]], paymentToken.target
            )).to.be.revertedWithCustomError(dRouter, "EnforcedPause");

            await dRouter.connect(admin).unpause();

            expect(await dRouter.paused()).to.equal(false);

            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

            const tokenChainIds = [testDstChainId];
            const connectorChainIds = [];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

            await expect(() => dRouter.connect(admin).sendDeployRequest(
                [[
                    testDstChainId,
                    false,
                    tokenDeployParams
                ]], paymentToken.target
            )).to.changeTokenBalances(paymentToken, [admin, await masterRouter.feeCollector()], [-deployFee, deployFee]);

            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);
        });

        it("execute", async function () {
            const { endpoint, user, factory, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter, pauserRole } = await loadFixture(ERC20Fixture);

            const [tokenDeployParams, localParams, params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await dRouter.paused()).to.equal(false);

            await dRouter.connect(admin).grantRole(pauserRole, admin);
            await dRouter.connect(admin).pause();

            expect(await dRouter.paused()).to.equal(true);

            let tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            let filter = masterRouter.filters.ProposalExecuted;
            let events = await masterRouter.queryFilter(filter, -1);
            let args = events[0].args;

            expect(await args[0]).to.equal(3);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            await dRouter.connect(admin).unpause();

            expect(await dRouter.paused()).to.equal(false);

            tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            filter = factory.filters.Deployed;
            events = await factory.queryFilter(filter, -1);
            args = events[0].args;

            const deployedToken = await ethers.getContractAt("UTSToken", args[0]);

            expect(args[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(args[4]).to.equal(args[0]);
            expect(await deployedToken.name()).to.equal("name");
        });
    });

    describe("AccessControl", function () {
        it("pause", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).pause(
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("unpause", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).unpause(
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstDeployConfig", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).setDstDeployConfig(
                [testDstChainId],
                [[ethers.zeroPadValue(user.address, 32), 99999n, 99999n, 0n]]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstDeployGas", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).setDstDeployGas(
                [1], [1], [1]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstProtocolFee", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).setDstProtocolFee(
                [1], [1]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });

        it("setDstFactory", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const newChainId = 999;

            await expect(dRouter.connect(user).setDstFactory(
                [newChainId],
                [newAddress]
            )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
        });
    });

    describe("sendDeployRequest", function () {
        it("UTS DeploymentRouter E0", async function () {
            const { user, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(user).sendDeployRequest(
                [], dRouter.target
            )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E0");
        });

        it("UTS DeploymentRouter E1", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [138, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E1");
        });

        it("UTS DeploymentRouter E3", async function () {
            const { user, router, dRouter } = await loadFixture(ERC20Fixture);

            let tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [1],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [["0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00", 1, 1, false]],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

            let connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [1],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, true, connectorDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

            connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [],
                [["0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00", 1, 1, false]],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, true, connectorDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams], [137, true, connectorDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");
        });

        it("UTS DeploymentRouter E4", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            let tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                false,
                true,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                false,
                false,
                true,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E4");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                true,
                true,
                true,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E4");

            const tokenDeployParamsTwo = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParamsTwo], [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E4");
        });

        it("UTS DeploymentRouter E5", async function () {
            const { admin, masterRouter, router, user, dRouter, zeroAddress, factory } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).setDstMasterRouter(
                [137, 56],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await dRouter.connect(admin).setDstFactory(
                [137, 56],
                [ethers.zeroPadValue(factory.target, 32), ethers.zeroPadValue(factory.target, 32)]
            );

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams]],
                zeroAddress
            )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E5");

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams]],
                dRouter.target
            )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E5");

            let paymentAmount = await dRouter.estimateDeployTotal([137], []);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams]],
                dRouter.target,
                { value: paymentAmount[1] - 1n }
            )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E5");

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            paymentAmount = await dRouter.estimateDeployTotal([137], [56]);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[137, false, tokenDeployParams], [56, true, connectorDeployParams]],
                dRouter.target,
                { value: paymentAmount[1] - 1n }
            )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E5");
        });

        it("UTS DeploymentRouter E6", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            let tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000001,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E6");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                0,
                1,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E6");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000001,
                false,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E6");

            tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                0,
                1,
                false,
                false,
                true,
                false,
                true,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E6");
        });

        it("UTS DeploymentRouter E7", async function () {
            const { justToken, executor, factory, user, router, dRouter } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00ff";
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const config = [configPeer, 150000n, 18, true];

            const chainIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
            const configs = [config, config, config, config, config, config, config, config, config, config, config, config, config]

            const [tokenDeployParams, ,] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                false,
                true,
                true,
                true,
                router,
                chainIds,
                configs,
                salt
            );

            const [connectorDeployParams, ,] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                true,
                router,
                chainIds,
                configs,
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, false, tokenDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E7");

            await expect(dRouter.connect(user).sendDeployRequest([
                [137, true, connectorDeployParams]
            ], dRouter.target)).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E7");
        });

        it("Should revert by wrong encoded params", async function () {
            const { router, user, dRouter } = await loadFixture(ERC20Fixture);

            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                salt
            ]);

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                user.address,
                false,
                router.target,
                [],
                [],
                salt
            ]);

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, tokenDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, connectorDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, salt]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, salt]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, tokenDeployParams], [testDstChainId, false, tokenDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, connectorDeployParams], [testDstChainId, true, connectorDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, true, salt], [testDstChainId, false, tokenDeployParams]], dRouter.target
            )).to.be.reverted;

            await expect(dRouter.connect(user).sendDeployRequest(
                [[testDstChainId, false, salt], [testDstChainId, false, tokenDeployParams]], dRouter.target
            )).to.be.reverted;
        });

        it("Single token deploy current chain case", async function () {
            const { masterRouter, priceFeed, zeroHash, endpoint, paymentToken, factory, registry, router, user, dRouter } = await loadFixture(ERC20Fixture);

            const balanceBefore = await paymentToken.balanceOf(user);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18n,
                10000000000000n,
                10000000000000n,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            expect(await registry.totalDeployments()).to.equal(0n);

            const paymentTokenBalanceBefore = await paymentToken.balanceOf(user);
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testCurChainId, false, tokenDeployParams]
            ], paymentToken.target);

            const tokenChainIds = [testCurChainId];
            const connectorChainIds = [];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
            expect(paymentTokenBalanceBefore - deployFee).to.equal(await paymentToken.balanceOf(user));
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);

            await tx.wait();
            const filter = factory.filters.Deployed;
            const events = await factory.queryFilter(filter, -1);
            const args = events[0].args;

            const deployedToken = await ethers.getContractAt("UTSToken", args[0]);

            expect(args[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(args[4]).to.equal(args[0]);
            expect(await deployedToken.name()).to.equal("name");
            expect(await deployedToken.decimals()).to.equal(18n);

            expect(await endpoint.lastProposal()).to.equal(zeroHash);
            expect(await registry.totalDeployments()).to.equal(1n);
            expect(balanceBefore).to.equal(await paymentToken.balanceOf(user));

            const data = await registry.deploymentData(deployedToken.target);

            expect(data.deployer).to.equal(user.address.toLowerCase());
            expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
            expect(data.underlyingToken).to.equal(deployedToken.target);
        });

        it("Single connector deploy current chain case", async function () {
            const { priceFeed, masterRouter, zeroHash, endpoint, paymentToken, factory, registry, justToken, router, user, dRouter } = await loadFixture(ERC20Fixture);

            const balanceBefore = await paymentToken.balanceOf(user);

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                justToken.target,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            expect(await registry.totalDeployments()).to.equal(0n);

            const paymentTokenBalanceBefore = await paymentToken.balanceOf(user);
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testCurChainId, true, connectorDeployParams]
            ], paymentToken.target);

            const tokenChainIds = [];
            const connectorChainIds = [testCurChainId];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
            expect(paymentTokenBalanceBefore - deployFee).to.equal(await paymentToken.balanceOf(user));
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);

            await tx.wait();
            const filter = factory.filters.Deployed;
            const events = await factory.queryFilter(filter, -1);
            const args = events[0].args;

            const deployedConnector = await ethers.getContractAt("UTSConnector", args[0]);

            expect(args[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(args[4]).to.equal(justToken.target);
            expect(await deployedConnector.underlyingToken()).to.equal(justToken.target);

            expect(await endpoint.lastProposal()).to.equal(zeroHash);
            expect(await registry.totalDeployments()).to.equal(1n);
            expect(balanceBefore).to.equal(await paymentToken.balanceOf(user));

            const data = await registry.deploymentData(deployedConnector.target);

            expect(data.deployer).to.equal(user.address.toLowerCase());
            expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
            expect(data.underlyingToken).to.equal(justToken.target);
        });

        it("Single token deploy remote chain case", async function () {
            const { priceFeed, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            await paymentToken.connect(admin).transfer(user, await paymentToken.balanceOf(admin));
            await paymentToken.connect(user).approve(dRouter.target, await paymentToken.balanceOf(user));

            const [tokenDeployParams, localParams, params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                user,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            const paymentTokenBalanceBefore = await paymentToken.balanceOf(user);
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testDstChainId, false, tokenDeployParams]
            ], paymentToken.target);

            const tokenChainIds = [testDstChainId];
            const connectorChainIds = [];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
            expect(paymentTokenBalanceBefore - deployFee).to.equal(await paymentToken.balanceOf(user));
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);

            await tx.wait();
            const filter = endpoint.filters.Propose;
            const events = await endpoint.queryFilter(filter, -1);
            const args = events[0].args;

            expect(args[0]).to.equal(protocolId);
            expect(args[1]).to.equal(0);
            expect(args[2]).to.equal(0);
            expect(args[3]).to.equal(testDstChainId);
            expect(args[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(args[5]).to.equal(functionSelector);
            expect(args[6]).to.equal(params);
            expect(args[7]).to.equal("0x");

            const hash = await endpoint.getHash(protocolId, testDstChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastProposal()).to.equal(hash);
            expect(await registry.totalDeployments()).to.equal(0n);
            expect(paymentTokenBalanceBefore).to.above(await paymentToken.balanceOf(user));
        });

        it("Single connector deploy remote chain case", async function () {
            const { priceFeed, justToken, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            await paymentToken.connect(admin).transfer(user, await paymentToken.balanceOf(admin));
            await paymentToken.connect(user).approve(dRouter.target, await paymentToken.balanceOf(user));

            const balanceBefore = await paymentToken.balanceOf(user);

            const [connectorDeployParams, localParams, params] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            const paymentTokenBalanceBefore = await paymentToken.balanceOf(user);
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testDstChainId, true, connectorDeployParams]
            ], paymentToken.target);

            const tokenChainIds = [];
            const connectorChainIds = [testDstChainId];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
            expect(paymentTokenBalanceBefore - deployFee).to.equal(await paymentToken.balanceOf(user));
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);

            await tx.wait();
            const filter = endpoint.filters.Propose;
            const events = await endpoint.queryFilter(filter, -1);
            const args = events[0].args;

            expect(args[0]).to.equal(protocolId);
            expect(args[1]).to.equal(0);
            expect(args[2]).to.equal(0);
            expect(args[3]).to.equal(testDstChainId);
            expect(args[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(args[5]).to.equal(functionSelector);
            expect(args[6]).to.equal(params);
            expect(args[7]).to.equal("0x");

            const hash = await endpoint.getHash(protocolId, testDstChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastProposal()).to.equal(hash);
            expect(await registry.totalDeployments()).to.equal(0n);
            expect(balanceBefore).to.above(await paymentToken.balanceOf(user));
        });

        it("Multi deploy remote chain case", async function () {
            const { priceFeed, justToken, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            await paymentToken.connect(admin).transfer(user, await paymentToken.balanceOf(admin));
            await paymentToken.connect(user).approve(dRouter.target, await paymentToken.balanceOf(user));

            const balanceBefore = await paymentToken.balanceOf(user);

            const [tokenDeployParams, , paramsT] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                user,
                "name",
                "symbol",
                18n,
                10000000000000n,
                10000000000000n,
                true,
                true,
                false,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const [connectorDeployParams, , paramsC] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                true,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            const paymentTokenBalanceBefore = await paymentToken.balanceOf(user);
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testDstChainId, false, tokenDeployParams],
                [testDstChainId, true, connectorDeployParams]
            ], paymentToken.target);

            const tokenChainIds = [testDstChainId];
            const connectorChainIds = [testDstChainId];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
            expect(paymentTokenBalanceBefore - deployFee).to.equal(await paymentToken.balanceOf(user));
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);

            await tx.wait();
            const filter = endpoint.filters.Propose;
            const events = await endpoint.queryFilter(filter, -1);
            const argsT = events[0].args;
            const argsC = events[1].args;

            expect(argsT[0]).to.equal(protocolId);
            expect(argsT[1]).to.equal(0);
            expect(argsT[2]).to.equal(0);
            expect(argsT[3]).to.equal(testDstChainId);
            expect(argsT[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsT[5]).to.equal(functionSelector);
            expect(argsT[6]).to.equal(paramsT);
            expect(argsT[7]).to.equal("0x");

            expect(argsC[0]).to.equal(protocolId);
            expect(argsC[1]).to.equal(0);
            expect(argsC[2]).to.equal(0);
            expect(argsC[3]).to.equal(testDstChainId);
            expect(argsC[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsC[5]).to.equal(functionSelector);
            expect(argsC[6]).to.equal(paramsC);
            expect(argsC[7]).to.equal("0x");

            const hash = await endpoint.getHash(protocolId, testDstChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, paramsC);

            expect(await endpoint.lastProposal()).to.equal(hash);
            expect(await registry.totalDeployments()).to.equal(0n);
            expect(balanceBefore).to.above(await paymentToken.balanceOf(user));
        });

        it("Multi deploy arbitrary chain case", async function () {
            const { deployTokenGas, deployConnectorGas, priceFeed, justToken, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            const testDstChainIdTwo = 100n;

            await paymentToken.connect(admin).transfer(user, await paymentToken.balanceOf(admin));
            await paymentToken.connect(user).approve(dRouter.target, await paymentToken.balanceOf(user));
            await masterRouter.connect(admin).setDstMasterRouter([testDstChainIdTwo], [ethers.zeroPadValue(masterRouter.target, 32)]);

            await dRouter.connect(admin).setDstDeployConfig(
                [testDstChainIdTwo],
                [[factory.target, deployTokenGas, deployConnectorGas, 0n]]
            );

            const balanceBefore = await paymentToken.balanceOf(user);

            const [tokenDeployParams, , paramsT] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                user,
                "name",
                "symbol",
                18n,
                10000000000000n,
                10000000000000n,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const [connectorDeployParams, , paramsC] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);

            const paymentTokenBalanceBefore = await paymentToken.balanceOf(user);
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testCurChainId, false, tokenDeployParams],
                [testDstChainId, true, connectorDeployParams],
                [testDstChainIdTwo, false, tokenDeployParams],
                [testCurChainId, true, connectorDeployParams]
            ], paymentToken.target);

            const tokenChainIds = [testCurChainId, testDstChainIdTwo];
            const connectorChainIds = [testCurChainId, testDstChainId];
            const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
            const deployFeeTwo = await dRouter.estimateDeploy(tokenChainIds, connectorChainIds);
            expect(paymentTokenBalanceBefore - deployFee).to.equal(await paymentToken.balanceOf(user));
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);
            expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFeeTwo[2]);

            await tx.wait();
            const filterE = endpoint.filters.Propose;
            const eventsE = await endpoint.queryFilter(filterE, -1);
            const argsCD = eventsE[0].args;
            const argsTD = eventsE[1].args;

            const filterF = factory.filters.Deployed;
            const eventsF = await factory.queryFilter(filterF, -1);
            const argsTC = eventsF[0].args;
            const argsCC = eventsF[1].args;

            expect(argsTD[0]).to.equal(protocolId);
            expect(argsTD[1]).to.equal(0);
            expect(argsTD[2]).to.equal(0);
            expect(argsTD[3]).to.equal(testDstChainIdTwo);
            expect(argsTD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsTD[5]).to.equal(functionSelector);
            expect(argsTD[6]).to.equal(paramsT);
            expect(argsTD[7]).to.equal("0x");

            expect(argsCD[0]).to.equal(protocolId);
            expect(argsCD[1]).to.equal(0);
            expect(argsCD[2]).to.equal(0);
            expect(argsCD[3]).to.equal(testDstChainId);
            expect(argsCD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsCD[5]).to.equal(functionSelector);
            expect(argsCD[6]).to.equal(paramsC);
            expect(argsCD[7]).to.equal("0x");

            const deployedToken = await ethers.getContractAt("UTSToken", argsTC[0]);

            expect(argsTC[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(argsTC[4]).to.equal(argsTC[0]);
            expect(await deployedToken.name()).to.equal("name");

            const deployedConnector = await ethers.getContractAt("UTSConnector", argsCC[0]);

            expect(argsCC[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(argsCC[4]).to.equal(justToken.target);
            expect(await deployedConnector.underlyingToken()).to.equal(justToken.target);

            const hash = await endpoint.getHash(protocolId, testDstChainIdTwo, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, paramsT);

            expect(await endpoint.lastProposal()).to.equal(hash);
            expect(await registry.totalDeployments()).to.equal(2n);
            expect(balanceBefore).to.above(await paymentToken.balanceOf(user));
        });

        it("Multi deploy arbitrary chain case native payment", async function () {
            const { paymentToken, deployTokenGas, deployConnectorGas, priceFeed, justToken, masterRouter, admin, endpoint, zeroAddress, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            const tokenBalanceBefore = await paymentToken.balanceOf(user.address);

            const testDstChainIdTwo = 100n;

            await masterRouter.connect(admin).setDstMasterRouter([testDstChainIdTwo], [ethers.zeroPadValue(masterRouter.target, 32)]);

            await masterRouter.connect(admin).setFeeCollector(zeroAddress);

            await dRouter.connect(admin).setDstDeployConfig(
                [testDstChainIdTwo],
                [[factory.target, deployTokenGas, deployConnectorGas, 0n]]
            );

            const etherBalanceBefore = await ethers.provider.getBalance(user.address);

            const [tokenDeployParams, , paramsT] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                user,
                user,
                "name",
                "symbol",
                18n,
                10000000000000n,
                10000000000000n,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const [connectorDeployParams, , paramsC] = await encodeParamsToDeployConnector(
                dRouter,
                factory,
                user,
                user,
                justToken,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            expect(await registry.totalDeployments()).to.equal(0n);
            expect(await ethers.provider.getBalance(await masterRouter.feeCollector())).to.equal(0n);

            const tokenChainIds = [testCurChainId, testDstChainIdTwo];
            const connectorChainIds = [testCurChainId, testDstChainId];
            validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

            const deployFee = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);
            const deployFeeNative = await dRouter.estimateDeployNative(tokenChainIds, connectorChainIds);

            expect(deployFee[1]).to.equal(deployFeeNative[2]);

            await expect(dRouter.connect(user).sendDeployRequest([
                [testCurChainId, false, tokenDeployParams],
                [testDstChainId, true, connectorDeployParams],
                [testDstChainIdTwo, false, tokenDeployParams],
                [testCurChainId, true, connectorDeployParams]
            ], zeroAddress, { value: deployFee[1] - 1n }
            )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E5");

            const tx = await dRouter.connect(user).sendDeployRequest([
                [testCurChainId, false, tokenDeployParams],
                [testDstChainId, true, connectorDeployParams],
                [testDstChainIdTwo, false, tokenDeployParams],
                [testCurChainId, true, connectorDeployParams]
            ], zeroAddress, { value: deployFee[1] });

            expect(etherBalanceBefore - deployFee[1]).to.above(await ethers.provider.getBalance(user.address));
            expect(await ethers.provider.getBalance(await masterRouter.feeCollector())).to.equal(deployFee[1]);

            await tx.wait();
            const filterE = endpoint.filters.Propose;
            const eventsE = await endpoint.queryFilter(filterE, -1);
            const argsCD = eventsE[0].args;
            const argsTD = eventsE[1].args;

            const filterF = factory.filters.Deployed;
            const eventsF = await factory.queryFilter(filterF, -1);
            const argsTC = eventsF[0].args;
            const argsCC = eventsF[1].args;

            expect(argsTD[0]).to.equal(protocolId);
            expect(argsTD[1]).to.equal(0);
            expect(argsTD[2]).to.equal(0);
            expect(argsTD[3]).to.equal(testDstChainIdTwo);
            expect(argsTD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsTD[5]).to.equal(functionSelector);
            expect(argsTD[6]).to.equal(paramsT);
            expect(argsTD[7]).to.equal("0x");

            expect(argsCD[0]).to.equal(protocolId);
            expect(argsCD[1]).to.equal(0);
            expect(argsCD[2]).to.equal(0);
            expect(argsCD[3]).to.equal(testDstChainId);
            expect(argsCD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(argsCD[5]).to.equal(functionSelector);
            expect(argsCD[6]).to.equal(paramsC);
            expect(argsCD[7]).to.equal("0x");

            const deployedToken = await ethers.getContractAt("UTSToken", argsTC[0]);

            expect(argsTC[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(argsTC[4]).to.equal(argsTC[0]);
            expect(await deployedToken.name()).to.equal("name");

            const deployedConnector = await ethers.getContractAt("UTSConnector", argsCC[0]);

            expect(argsCC[2]).to.eql((await convertToBytes(user)).toLowerCase());
            expect(argsCC[4]).to.equal(justToken.target);
            expect(await deployedConnector.underlyingToken()).to.equal(justToken.target);

            const hash = await endpoint.getHash(protocolId, testDstChainIdTwo, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, paramsT);

            expect(await endpoint.lastProposal()).to.equal(hash);
            expect(await registry.totalDeployments()).to.equal(2n);
            expect(etherBalanceBefore).to.above(await ethers.provider.getBalance(user.address));
            expect(tokenBalanceBefore).to.equal(await paymentToken.balanceOf(user.address));
        });
    });

    describe("execute", function () {
        it("UTS DeploymentRouter E2", async function () {
            const { admin, dRouter } = await loadFixture(ERC20Fixture);

            await expect(dRouter.connect(admin).execute(
                admin,
                "0xff",
                "0x"
            )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E2");
        });

        it("Should return error code by zero factory address", async function () {
            const { zeroAddress, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const [tokenDeployParams, , params] = await encodeParamsToDeployToken(
                dRouter,
                zeroAddress,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(5);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by EOA factory address", async function () {
            const { endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const [tokenDeployParams, , params] = await encodeParamsToDeployToken(
                dRouter,
                user,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(5);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by incompatible router type", async function () {
            const { adminRole, zeroAddress, registry, factory, executor, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedToken } = await deployTokenByFactory(
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router,
                allowedChainIds,
                configMinGasLimit,
                configPeer,
                configDecimals,
                salt,
                factory,
                registry,
                zeroAddress,
                zeroHash,
                adminRole
            );

            const tokenDeployParams = AbiCoder.encode([
                "tuple(bytes, string, string, uint8, uint256, bool, bool, bool, bool, bool, bytes, uint256[], tuple(bytes, uint64, uint8, bool)[], bytes32)"
            ], [[
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                true,
                false,
                false,
                false,
                false,
                router.target,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]]);

            const localParams = AbiCoder.encode([
                "bool",
                "bytes",
                "bytes"
            ], [
                false,
                user.address,
                tokenDeployParams
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                deployedToken.target,
                routerBridgeMessageType,
                localParams
            ]);

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(10);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by router zero address", async function () {
            const { routerRole, adminRole, zeroAddress, registry, factory, executor, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedToken } = await deployTokenByFactory(
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router,
                allowedChainIds,
                configMinGasLimit,
                configPeer,
                configDecimals,
                salt,
                factory,
                registry,
                zeroAddress,
                zeroHash,
                adminRole
            );

            await deployedToken.connect(user).setRouter(zeroAddress);
            await masterRouter.connect(admin).grantRole(routerRole, zeroAddress);

            const [tokenDeployParams, , params] = await encodeParamsToDeployToken(
                dRouter,
                deployedToken,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(10);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by unauthorized factory", async function () {
            const { mockRouter, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            await mockRouter.setProtocolVersion(globalProtocolVersion);
            await mockRouter.setRouter(dRouter.target);

            const [tokenDeployParams, , params] = await encodeParamsToDeployToken(
                dRouter,
                mockRouter,
                user,
                admin,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                true,
                true,
                false,
                false,
                router,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(4);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by invalid token deploy params", async function () {
            const { justToken, factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, router, dRouter } = await loadFixture(ERC20Fixture);

            const connectorDeployParams = await dRouter.getDeployConnectorParams([
                user.address,
                justToken.target,
                false,
                router.target,
                [],
                [],
                "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            const [localParams, params] = await encodeParamsToDeploy(factory, false, user, connectorDeployParams);

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(9);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by invalid connector deploy params", async function () {
            const { factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(ERC20Fixture);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                admin.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            const [localParams, params] = await encodeParamsToDeploy(factory, true, user, tokenDeployParams);

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(9);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by deploy to same address", async function () {
            const { adminRole, registry, executor, factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, zeroAddress, router, dRouter } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            await deployTokenByFactory(
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router,
                allowedChainIds,
                configMinGasLimit,
                configPeer,
                configDecimals,
                salt,
                factory,
                registry,
                zeroAddress,
                zeroHash,
                adminRole
            );

            const [tokenDeployParams, , params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                executor,
                user,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                false,
                false,
                false,
                router,
                [],
                [],
                salt
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(9);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by paused factory", async function () {
            const { admin, pauserRole, executor, factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, router, dRouter } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [testDstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            const [tokenDeployParams, , params] = await encodeParamsToDeployToken(
                dRouter,
                factory,
                executor,
                user,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router,
                allowedChainIds,
                chainConfigs,
                salt
            );

            await factory.connect(admin).grantRole(pauserRole, admin);
            await factory.connect(admin).pause();

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(3);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by invalid protocol version", async function () {
            const { factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, router, dRouter } = await loadFixture(ERC20Fixture);

            const tokenDeployParams = await dRouter.getDeployTokenParams([
                user.address,
                "name",
                "symbol",
                18,
                10000000000000,
                10000000000000,
                false,
                true,
                true,
                false,
                false,
                router.target,
                [],
                [],
                "0x14050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00"
            ]);

            const localParams = AbiCoder.encode([
                "bool",
                "bytes",
                "bytes"
            ], [
                false,
                user.address,
                tokenDeployParams
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                factory.target,
                "0xff",
                localParams
            ]);

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                testDstChainId,
                0,
                [zeroHash, zeroHash],
                0,
                testCurChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[0]).to.equal(12);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });
    });

    describe("estimateDeployTotal", function () {
        it("Math test", async function () {
            const { admin, priceFeed, dRouter, deployTokenGas, deployConnectorGas, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            let tokenChainIds = [1, 10, 56];
            let connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstDeployGas(
                connectorChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

            tokenChainIds = [56, 100, 81457];
            connectorChainIds = [];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstProtocolFee([56, 100, 81457], [1, 111, 999]);

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

            tokenChainIds = [];
            connectorChainIds = [];

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

            tokenChainIds = [1, 56, testDstChainId];
            connectorChainIds = [81457, 559999, 17];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstDeployGas(
                connectorChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstProtocolFee([81457, 56, testDstChainId], [100, 0, 7690]);

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

            const groupId = [4n]
            const prices = [207919288430829661534269173292308851077110717309661052642059096598901248n];

            await priceFeed.connect(admin).setPrices(groupId, prices);

            tokenChainIds = [1, testCurChainId, 56, testDstChainId, 81457, 5000, 8453];
            connectorChainIds = [testCurChainId, 559999, 17, 1];

            await dRouter.connect(admin).setDstDeployGas(
                tokenChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstDeployGas(
                connectorChainIds,
                [deployTokenGas, deployTokenGas, deployTokenGas, deployTokenGas],
                [deployConnectorGas, deployConnectorGas, deployConnectorGas, deployConnectorGas]
            );

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 5000, 17], [1000, 3, 7690]);

            await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
        });

        it("Master test", async function () {
            const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 10, testDstChainId], [1000, 1500, 8000]);

            const tokenChainIds = [1, 10, 56];
            const connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                [1, 10, 56, testCurChainId, testDstChainId],
                [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                [25000000n, 500000n, 500000999n, 238769n, 400000n]
            );

            const paymentAmount = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

            expect(paymentAmount[0]).to.equal(1204230637538101189381n);
        });
    });

    describe("estimateDeploy", function () {
        it("Master test", async function () {
            const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 10, testDstChainId], [1000, 1500, 8000]);

            const tokenChainIds = [1, 10, 56];
            const connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                [1, 10, 56, testCurChainId, testDstChainId],
                [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                [25000000n, 500000n, 500000999n, 238769n, 400000n]
            );

            const deploymentsPayment = await dRouter.estimateDeploy(tokenChainIds, connectorChainIds);
            const deploymentsPaymentTotal = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

            expect(deploymentsPayment[0][0]).to.equal(589680564000000000000n);
            expect(deploymentsPayment[0][1]).to.equal(9972538950000000000n);
            expect(deploymentsPayment[0][2]).to.equal(599528828347501189381n);
            expect(deploymentsPayment[1][0]).to.equal(0n);
            expect(deploymentsPayment[1][1]).to.equal(4986269475000000000n);
            expect(deploymentsPayment[1][2]).to.equal(62436765600000000n);
            expect(deploymentsPayment[2]).to.equal(1204230637538101189381n);
            expect(deploymentsPayment[2]).to.equal(deploymentsPaymentTotal[0]);
        });
    });

    describe("estimateDeployNative", function () {
        it("Master test", async function () {
            const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 10, testDstChainId], [1000, 1500, 8000]);

            const tokenChainIds = [1, 10, 56];
            const connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                [1, 10, 56, testCurChainId, testDstChainId],
                [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                [25000000n, 500000n, 500000999n, 238769n, 400000n]
            );

            const deploymentsPayment = await dRouter.estimateDeployNative(tokenChainIds, connectorChainIds);
            const deploymentsPaymentTotal = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

            expect(deploymentsPayment[0][0]).to.equal(34000000000000000000n);
            expect(deploymentsPayment[0][1]).to.equal(575000000000000000n);
            expect(deploymentsPayment[0][2]).to.equal(34567834533232200000n);
            expect(deploymentsPayment[1][0]).to.equal(0n);
            expect(deploymentsPayment[1][1]).to.equal(287500000000000000n);
            expect(deploymentsPayment[1][2]).to.equal(3600000000000000n);
            expect(deploymentsPayment[2]).to.equal(69433934533232200000n);
            expect(deploymentsPayment[2]).to.equal(deploymentsPaymentTotal[1]);
        });

        it("Compare test", async function () {
            const { admin, dRouter, managerRole, priceFeed } = await loadFixture(ERC20Fixture);

            await dRouter.connect(admin).grantRole(managerRole, admin);

            await dRouter.connect(admin).setDstProtocolFee([testCurChainId, 10, testDstChainId], [1000, 1500, 8000]);

            const tokenChainIds = [1, 10, 56];
            const connectorChainIds = [testCurChainId, 10, testDstChainId];

            await dRouter.connect(admin).setDstDeployGas(
                [1, 10, 56, testCurChainId, testDstChainId],
                [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                [25000000n, 500000n, 500000999n, 238769n, 400000n]
            );

            const deploymentsPayment = await dRouter.estimateDeployNative(tokenChainIds, connectorChainIds);
            const deploymentsPaymentTotal = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);
            const deploymentsPaymentToken = await dRouter.estimateDeploy(tokenChainIds, connectorChainIds);
            const tokenToNativeRate = await priceFeed.getDstGasPriceAtSrcNative(33033);
            const precision = 1000000n;

            expect(deploymentsPayment[0][0] * tokenToNativeRate / precision).to.equal(deploymentsPaymentToken[0][0]);
            expect(deploymentsPayment[0][1] * tokenToNativeRate / precision).to.equal(deploymentsPaymentToken[0][1]);
            expect(deploymentsPayment[0][2] * tokenToNativeRate / precision).to.equal(deploymentsPaymentToken[0][2]);
            expect(deploymentsPayment[1][0] * tokenToNativeRate / precision).to.equal(deploymentsPaymentToken[1][0]);
            expect(deploymentsPayment[1][1] * tokenToNativeRate / precision).to.equal(deploymentsPaymentToken[1][1]);
            expect(deploymentsPayment[1][2] * tokenToNativeRate / precision).to.equal(deploymentsPaymentToken[1][2]);
            expect(deploymentsPayment[2]).to.equal(69433934533232200000n);
            expect(deploymentsPaymentToken[2]).to.equal(1204230637538101189381n);
            expect(deploymentsPayment[2]).to.equal(deploymentsPaymentTotal[1]);
            expect(deploymentsPaymentToken[2]).to.equal(deploymentsPaymentTotal[0]);
        });
    });

    describe("Admin's functions", function () {
        describe("setDstProtocolFee", function () {
            it("Base test", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstProtocolFee([1], [1]);

                expect(await dRouter.dstProtocolFee(1)).to.equal(1);

                await dRouter.connect(admin).setDstProtocolFee([1, testDstChainId], [9, 999]);

                expect(await dRouter.dstProtocolFee(1)).to.equal(9);
                expect(await dRouter.dstProtocolFee(testDstChainId)).to.equal(999);
            });

            it("UTS DeploymentRouter E3", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await expect(dRouter.connect(admin).setDstProtocolFee(
                    [1], [1, 2]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstProtocolFee(
                    [1, 2], [1]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");
            });
        });

        describe("setDstDeployConfig", function () {
            it("Base test", async function () {
                const { admin, dRouter } = await loadFixture(ERC20Fixture);

                const newConfig = [
                    ethers.zeroPadValue(dRouter.target, 32),
                    8889789n,
                    1234567n,
                    3333n
                ];

                await dRouter.connect(admin).setDstDeployConfig(
                    [testDstChainId],
                    [newConfig]
                );

                expect(await dRouter.dstDeployConfig(testDstChainId)).to.eql(newConfig);
            });

            it("UTS DeploymentRouter E3", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                const newConfig = [
                    ethers.zeroPadValue(dRouter.target, 32),
                    8889789n,
                    1234567n,
                    3333n
                ];

                await expect(dRouter.connect(admin).setDstDeployConfig(
                    [1, 2], [newConfig]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstDeployConfig(
                    [1], [newConfig, newConfig]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");
            });
        });

        describe("setDstDeployGas", function () {
            it("Base test", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstDeployGas(
                    [testDstChainId, testCurChainId],
                    [1000n, 888n],
                    [500n, 777n]
                );

                expect(await dRouter.dstTokenDeployGas(testDstChainId)).to.equal(1000n);
                expect(await dRouter.dstConnectorDeployGas(testDstChainId)).to.equal(500n);
                expect(await dRouter.dstTokenDeployGas(testCurChainId)).to.equal(888n);
                expect(await dRouter.dstConnectorDeployGas(testCurChainId)).to.equal(777n);
            });

            it("UTS DeploymentRouter E3", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(ERC20Fixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await expect(dRouter.connect(admin).setDstDeployGas(
                    [1, 2], [1], [1, 2]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstDeployGas(
                    [1, 2], [1, 2], [1]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");
            });
        });

        describe("setDstFactory", function () {
            it("Base test", async function () {
                const { admin, dRouter } = await loadFixture(ERC20Fixture);

                const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const newChainId = 999;

                await dRouter.connect(admin).setDstFactory(
                    [newChainId],
                    [newAddress]
                );

                expect(await dRouter.dstFactory(newChainId)).to.equal(newAddress);
            });

            it("UTS DeploymentRouter E3", async function () {
                const { admin, dRouter } = await loadFixture(ERC20Fixture);

                const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const newChainId = 999;

                await expect(dRouter.connect(admin).setDstFactory(
                    [newChainId, 1],
                    [newAddress]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

                await expect(dRouter.connect(admin).setDstFactory(
                    [newChainId],
                    [newAddress, newAddress]
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E3");

                await dRouter.connect(admin).setDstFactory([newChainId, testCurChainId], [newAddress, newAddress]);

                expect(await dRouter.dstFactory(newChainId)).to.equal(newAddress);
                expect(await dRouter.dstFactory(testCurChainId)).to.equal(newAddress);
            });
        });
    });
});