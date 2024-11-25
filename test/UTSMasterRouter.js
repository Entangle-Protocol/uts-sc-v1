const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("./utils/ERC20Fixture");
const { encodeParamsToRedeem, deployTokenByFactory } = require("./utils/ERC20UtilFunctions");
const { globalProtocolVersion } = require("./utils/GlobalConstants");

describe("UTS MasterRouter", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { router, masterRouter, feeCollector } = await loadFixture(ERC20Fixture);

            expect(await masterRouter.dstMasterRouter(testDstChainId)).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
            expect(await masterRouter.PAYLOAD_SIZE_LIMIT()).to.equal(2048n);
            expect(await masterRouter.feeCollector()).to.equal(feeCollector);
            expect(await masterRouter.validateRouter(router.target)).to.equal(true);
        });

        it("UTS MasterRouter E3", async function () {
            const { admin, masterRouter } = await loadFixture(ERC20Fixture);

            const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const newChainId = 999;

            await expect(masterRouter.connect(admin).setDstMasterRouter(
                [newChainId, 1],
                [newAddress]
            )).to.be.revertedWithCustomError(masterRouter, "UTSMasterRouter__E3");

            await expect(masterRouter.connect(admin).setDstMasterRouter(
                [newChainId],
                [newAddress, newAddress]
            )).to.be.revertedWithCustomError(masterRouter, "UTSMasterRouter__E3");

            await masterRouter.connect(admin).setDstMasterRouter([newChainId, testCurChainId], [newAddress, newAddress]);

            expect(await masterRouter.dstMasterRouter(newChainId)).to.equal(newAddress);
            expect(await masterRouter.dstMasterRouter(testCurChainId)).to.equal(newAddress);
        });
    });

    describe("AccessControl", function () {
        it("sendProposal", async function () {
            const { user, masterRouter } = await loadFixture(ERC20Fixture);

            await expect(masterRouter.connect(user).sendProposal(
                0,
                1,
                "0x"
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");
        });

        it("setFeeCollector", async function () {
            const { admin, user, masterRouter } = await loadFixture(ERC20Fixture);

            await expect(masterRouter.connect(user).setFeeCollector(
                user
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

            await masterRouter.connect(admin).setFeeCollector(user);

            expect(await masterRouter.feeCollector()).to.equal(user);
        });

        it("setDstMasterRouter", async function () {
            const { admin, user, masterRouter } = await loadFixture(ERC20Fixture);

            const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const newChainId = 999;

            await expect(masterRouter.connect(user).setDstMasterRouter(
                [newChainId],
                [newAddress]
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

            await masterRouter.connect(admin).setDstMasterRouter([newChainId], [newAddress]);

            expect(await masterRouter.dstMasterRouter(newChainId)).to.equal(newAddress);
        });

        it("pause", async function () {
            const { admin, masterRouter, pauserRole } = await loadFixture(ERC20Fixture);

            await expect(masterRouter.connect(admin).pause(
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

            await masterRouter.connect(admin).grantRole(pauserRole, admin);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);
        });

        it("unpause", async function () {
            const { admin, user, masterRouter, pauserRole } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).grantRole(pauserRole, admin);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);

            await expect(masterRouter.connect(user).unpause(
            )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

            await masterRouter.connect(admin).unpause();

            expect(await masterRouter.paused()).to.equal(false);
        });
    });

    describe("Pausable", function () {
        it("sendProposal", async function () {
            const { admin, routerRole, zeroHash, endpoint, masterRouter, pauserRole } = await loadFixture(ERC20Fixture);

            expect(await endpoint.lastProposal()).to.equal(zeroHash);

            await masterRouter.connect(admin).grantRole(pauserRole, admin);
            await masterRouter.connect(admin).grantRole(routerRole, admin);

            expect(await masterRouter.paused()).to.equal(false);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);

            await expect(masterRouter.connect(admin).sendProposal(
                0,
                0,
                "0x"
            )).to.be.revertedWithCustomError(masterRouter, "EnforcedPause");

            await masterRouter.connect(admin).unpause();

            expect(await masterRouter.paused()).to.equal(false);

            await masterRouter.connect(admin).sendProposal(0, testDstChainId, "0x");

            expect(await endpoint.lastProposal() != zeroHash).to.equal(true);
        });

        it("executeProposal", async function () {
            const { adminRole, zeroAddress, registry, factory, router, user, executor, admin, zeroHash, endpoint, masterRouter, pauserRole, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            expect(await endpoint.lastExecution() == zeroHash).to.equal(true);

            await masterRouter.connect(admin).grantRole(pauserRole, admin);

            expect(await masterRouter.paused()).to.equal(false);

            await masterRouter.connect(admin).pause();

            expect(await masterRouter.paused()).to.equal(true);

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

            const amountToRedeem = withDecimals("1500");

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
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

            expect(await args[0]).to.equal(11);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            await masterRouter.connect(admin).unpause();

            expect(await masterRouter.paused()).to.equal(false);
        });
    });

    describe("sendProposal", function () {
        it("Base test", async function () {
            const { admin, routerRole, endpoint, masterRouter, functionSelector, protocolId } = await loadFixture(ERC20Fixture);

            const chainId = 999;
            const params = "0xf4a89e12bd90116bc12f";

            await masterRouter.connect(admin).grantRole(routerRole, admin);
            await masterRouter.connect(admin).setDstMasterRouter([chainId], [ethers.zeroPadValue(masterRouter.target, 32)]);
            await masterRouter.connect(admin).sendProposal(0, chainId, params);

            const hash = await endpoint.getHash(protocolId, chainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastProposal()).to.equal(hash);
        });

        it("Base non-evm test", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

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
            const configPeer = "0xfff4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00ff";
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

            const tokenAmountToBridge = await deployedToken.balanceOf(user);

            await deployedToken.connect(user).bridge(
                user.address,
                configPeer,
                tokenAmountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit }
            );
        });

        it("UTS MasterRouter E1", async function () {
            const { mockRouter, masterRouter, admin, router } = await loadFixture(ERC20Fixture);

            await mockRouter.setProtocolVersion(globalProtocolVersion);

            const largePayload = ethers.randomBytes(2049);

            await expect(mockRouter.connect(admin).bridge(
                router.target,
                ethers.zeroPadValue(router.target, 32),
                ethers.zeroPadValue(router.target, 32),
                1,
                12,
                testDstChainId,
                1000000,
                largePayload,
                "0x",
                { value: withDecimals("1") }
            )).to.be.revertedWithCustomError(masterRouter, "UTSMasterRouter__E1");
        });

        it("UTS MasterRouter E2", async function () {
            const { mockRouter, masterRouter, admin, router, routerRole } = await loadFixture(ERC20Fixture);

            await mockRouter.setProtocolVersion(globalProtocolVersion);

            await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);

            await expect(mockRouter.connect(admin).bridge(
                router.target,
                ethers.zeroPadValue(router.target, 32),
                ethers.zeroPadValue(router.target, 32),
                1,
                12,
                81457,
                1000000,
                "0x",
                "0x",
                { value: withDecimals("1") }
            )).to.be.revertedWithCustomError(masterRouter, "UTSMasterRouter__E2");
        });
    });

    describe("executeProposal", function () {
        it("Success case", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

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

            const amountToRedeem = withDecimals("1500");

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
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

            expect(await args[0]).to.equal(0);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Record case", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

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

            const amountToRedeem = withDecimals("1500");

            const invalidConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToRedeem,
                allowedChainIds[0],
                invalidConfigPeer,
                configDecimals,
                500000n,
                "0x"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
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

            expect(await args[0]).to.equal(1);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Failure case", async function () {
            const { admin, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            const UTSTokenMock = await ethers.getContractFactory("UTSTokenMock", admin);
            const mock = await UTSTokenMock.deploy(router.target);
            await mock.waitForDeployment();

            const allowedChainIds = [testDstChainId];
            const configDecimals = 18n;

            const amountToRedeem = withDecimals("1500");

            const invalidConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const params = await encodeParamsToRedeem(
                user,
                mock,
                user,
                amountToRedeem,
                allowedChainIds[0],
                invalidConfigPeer,
                configDecimals,
                25000n,
                "0x"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
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

            expect(await args[0]).to.equal(2);
            expect(await args[1]).to.equal(mock.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("UTS MasterRouter E0", async function () {
            const { admin, masterRouter } = await loadFixture(ERC20Fixture);

            await expect(masterRouter.connect(admin).executeProposal(
                "0x"
            )).to.be.revertedWithCustomError(masterRouter, "UTSMasterRouter__E0");
        });

        it("Unauthorized router", async function () {
            const { functionSelector, endpoint, routerRole, adminRole, zeroAddress, router, factory, executor, registry, user, admin, zeroHash, masterRouter, protocolId } = await loadFixture(ERC20Fixture);

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

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                initialSupply,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                25000n,
                "0x"
            );

            await masterRouter.connect(admin).revokeRole(routerRole, router);

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
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
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Invalid dstPeer", async function () {
            const { functionSelector, endpoint, zeroAddress, registry, user, zeroHash, masterRouter, protocolId } = await loadFixture(ERC20Fixture);

            const initialSupply = withDecimals("1");
            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const params = await encodeParamsToRedeem(
                user,
                registry,
                user,
                initialSupply,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                25000n,
                "0x"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
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
            expect(await args[1]).to.equal(registry.target);
            expect(await args[2]).to.equal(zeroAddress);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Invalid router address", async function () {
            const { zeroAddress, functionSelector, endpoint, user, zeroHash, masterRouter, protocolId } = await loadFixture(ERC20Fixture);

            const initialSupply = withDecimals("1");
            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const params = await encodeParamsToRedeem(
                user,
                zeroAddress,
                user,
                initialSupply,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                25000n,
                "0x"
            );

            const tx = await endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
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
            expect(await args[1]).to.equal(zeroAddress);
            expect(await args[2]).to.equal(zeroAddress);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });
    });
});