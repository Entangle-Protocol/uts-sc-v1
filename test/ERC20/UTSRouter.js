const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { convertToBytes, encodeParamsToRedeem, validateBridgeFee, deployTokenByFactory, AbiCoder } = require("../utils/ERC20UtilFunctions");
const { ERC20Fixture, testCurChainId, testDstChainId, withDecimals } = require("../utils/ERC20Fixture");
const { globalProtocolVersion, routerBridgeMessageType } = require("../utils/GlobalConstants");

describe("UTS Router", function () {
    describe("Deploy", function () {
        it("Init settings", async function () {
            const { router, masterRouter, minGasLimit } = await loadFixture(ERC20Fixture);

            expect(await router.dstProtocolFee(0)).to.equal(0);
            expect(await router.dstProtocolFee(testDstChainId)).to.equal(0);
            expect(await router.dstProtocolFee(testCurChainId)).to.equal(0);
            expect(await router.dstMinGasLimit(0)).to.equal(0);
            expect(await router.dstMinGasLimit(testDstChainId)).to.equal(minGasLimit);
            expect(await router.dstMinGasLimit(testCurChainId)).to.equal(0);
            expect(await router.MASTER_ROUTER()).to.equal(masterRouter.target);
            expect(await router.protocolVersion()).to.equal(globalProtocolVersion);
        });
    });

    describe("AccessControl", function () {
        it("setDstMinGasLimit", async function () {
            const { admin, user, router, managerRole } = await loadFixture(ERC20Fixture);

            await expect(router.connect(user).setDstMinGasLimit(
                [1],
                [1]
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).grantRole(managerRole, user);

            await router.connect(user).setDstMinGasLimit([1], [1]);

            expect(await router.dstMinGasLimit(1)).to.equal(1);
        });

        it("setDstProtocolFee", async function () {
            const { admin, user, router } = await loadFixture(ERC20Fixture);

            await expect(router.connect(user).setDstProtocolFee(
                [1], [1]
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).setDstProtocolFee([1], [1]);

            expect(await router.dstProtocolFee(1)).to.equal(1);
        });

        it("setDstUpdateGas", async function () {
            const { admin, user, router, managerRole } = await loadFixture(ERC20Fixture);

            await expect(router.connect(user).setDstUpdateGas(
                [1], [1]
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).grantRole(managerRole, user);

            await router.connect(admin).setDstUpdateGas([1], [1]);

            expect(await router.dstUpdateGas(1)).to.equal(1);
        });

        it("pause", async function () {
            const { admin, pauserRole, router } = await loadFixture(ERC20Fixture);

            await expect(router.connect(admin).pause(
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).grantRole(pauserRole, admin);
            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);
        });

        it("unpause", async function () {
            const { admin, user, router, pauserRole } = await loadFixture(ERC20Fixture);

            await router.connect(admin).grantRole(pauserRole, admin);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

            await expect(router.connect(user).unpause(
            )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);
        });
    });

    describe("Pausable", function () {
        it("bridge", async function () {
            const { admin, router, pauserRole } = await loadFixture(ERC20Fixture);

            expect(await router.paused()).to.equal(false);

            await router.connect(admin).grantRole(pauserRole, admin);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

            await expect(router.connect(admin).bridge(
                ethers.zeroPadValue(router.target, 32),
                admin.address,
                ethers.zeroPadValue(router.target, 32),
                1,
                12,
                123,
                1234,
                "0x",
                "0x",
            )).to.be.revertedWithCustomError(router, "EnforcedPause");

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);
        });

        it("requestToUpdateConfig", async function () {
            const { admin, router, pauserRole } = await loadFixture(ERC20Fixture);

            expect(await router.paused()).to.equal(false);

            await router.connect(admin).grantRole(pauserRole, admin);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

            await expect(router.connect(admin).requestToUpdateConfig(
                admin.address,
                [],
                [],
                []
            )).to.be.revertedWithCustomError(router, "EnforcedPause");

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);
        });

        it("redeem", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, admin, factory, router, endpoint, protocolId, zeroHash, functionSelector, pauserRole } = await loadFixture(ERC20Fixture);

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

            await router.connect(admin).grantRole(pauserRole, admin);

            expect(await router.paused()).to.equal(false);

            await router.connect(admin).pause();

            expect(await router.paused()).to.equal(true);

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

            expect(await args[0]).to.equal(3);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            await router.connect(admin).unpause();

            expect(await router.paused()).to.equal(false);

            await endpoint.executeOperation([
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
        });
    });

    describe("getBridgeFee", function () {
        it("Math test", async function () {
            const { router, priceFeed, admin, providerRole } = await loadFixture(ERC20Fixture);

            let chainId = testDstChainId;
            let gasLimit = 0n;
            let payloadLength = 0n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            gasLimit = 1237890n;
            payloadLength = 123n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            gasLimit = 0n;
            payloadLength = 1234n;

            await router.connect(admin).setDstProtocolFee([chainId], [3137]);
            expect(await router.dstProtocolFee(chainId)).to.equal(3137);

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            gasLimit = 1237790n;
            payloadLength = 0n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            chainId = 0n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            chainId = 56n;
            gasLimit = 7989789n;
            payloadLength = 777n;

            await router.connect(admin).setDstProtocolFee([chainId], [9999]);
            expect(await router.dstProtocolFee(chainId)).to.equal(9999);

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            await priceFeed.connect(admin).grantRole(providerRole, admin);

            const groupId = [1n]
            const prices = [
                62017011138835482832437730536824915658235399606085787397919460150518842n,
            ];

            await priceFeed.connect(admin).setPrices(groupId, prices);

            await priceFeed.connect(admin).setDstPricePerByteInWei(
                [56],
                [178905]
            );

            gasLimit = 777890n;
            payloadLength = 1n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            gasLimit = 99999n;
            payloadLength = 0n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            await router.connect(admin).setDstProtocolFee([chainId], [1]);
            expect(await router.dstProtocolFee(chainId)).to.equal(1);

            gasLimit = 1n;
            payloadLength = 77n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            chainId = 100n;

            await router.connect(admin).setDstProtocolFee([chainId, testDstChainId], [3333, 105]);
            expect(await router.dstProtocolFee(chainId)).to.equal(3333);
            expect(await router.dstProtocolFee(testDstChainId)).to.equal(105);

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            gasLimit = 0n;
            payloadLength = 100000n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);

            await router.connect(admin).setDstProtocolFee([chainId], [10000]);
            expect(await router.dstProtocolFee(chainId)).to.equal(10000);

            gasLimit = 999999n;
            payloadLength = 999n;

            await validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength);
        });
    });

    describe("getUpdateFee", function () {
        it("Math test", async function () {
            const { router, priceFeed, admin, managerRole } = await loadFixture(ERC20Fixture);

            const gasPrice = await priceFeed.getDstGasPriceAtSrcNative(testDstChainId);
            const gasPriceTwo = await priceFeed.getDstGasPriceAtSrcNative(56);

            await router.connect(admin).grantRole(managerRole, admin);

            await router.connect(admin).setDstUpdateGas([testDstChainId, 56], [13333, 77777]);

            let estimatedPayment = await router.getUpdateFee([testDstChainId], [0]);

            expect(estimatedPayment).to.equal(gasPrice * 13333n * 4n);

            estimatedPayment = await router.getUpdateFee([testDstChainId, 56], [13, 7]);

            expect(estimatedPayment).to.equal((gasPrice * 13333n * (4n + 13n)) + (gasPriceTwo * 77777n * (4n + 7n)));
        });
    });

    describe("Payment", function () {
        it("Invalid receiver", async function () {
            const { masterRouter, admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, justToken } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).setFeeCollector(justToken.target);
            expect(await masterRouter.feeCollector()).to.equal(justToken.target);

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

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const tokenAmountToBridge = 1000n;
            const etherTokenBalanceBefore = await ethers.provider.getBalance(justToken.target);
            const etherRouterBalanceBefore = await ethers.provider.getBalance(router.target);

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                tokenAmountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit }
            );

            expect(etherTokenBalanceBefore).to.equal(await ethers.provider.getBalance(justToken.target));
            expect(etherRouterBalanceBefore + baseFeePerGasInWei * configMinGasLimit).to.equal(await ethers.provider.getBalance(router.target));
            expect(await deployedToken.balanceOf(user) + tokenAmountToBridge).to.equal(tokenBalanceBefore);
        });

        it("Bridge after invalid receiver", async function () {
            const { masterRouter, admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, justToken, feeCollector } = await loadFixture(ERC20Fixture);

            await masterRouter.connect(admin).setFeeCollector(justToken.target);
            expect(await masterRouter.feeCollector()).to.equal(justToken.target);

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

            const tokenBalanceBefore = await deployedToken.balanceOf(user);
            const tokenAmountToBridge = 1000n;
            const etherTokenBalanceBefore = await ethers.provider.getBalance(justToken.target);
            const etherRouterBalanceBefore = await ethers.provider.getBalance(router.target);

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                tokenAmountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit }
            );

            const etherTokenBalanceAfter = await ethers.provider.getBalance(justToken.target);
            const etherRouterBalanceAfter = await ethers.provider.getBalance(router.target);
            const etherCollectorBalanceAfter = await ethers.provider.getBalance(feeCollector);

            expect(etherTokenBalanceBefore).to.equal(etherTokenBalanceAfter);
            expect(etherRouterBalanceBefore + baseFeePerGasInWei * configMinGasLimit).to.equal(etherRouterBalanceAfter);
            expect(await deployedToken.balanceOf(user) + tokenAmountToBridge).to.equal(tokenBalanceBefore);

            await masterRouter.connect(admin).setFeeCollector(feeCollector);
            expect(await masterRouter.feeCollector()).to.equal(feeCollector);

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                tokenAmountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: 1 }
            )).to.be.revertedWithCustomError(router, "UTSRouter__E0");

            await deployedToken.connect(user).bridge(
                user.address,
                user.address,
                tokenAmountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit }
            );

            expect(etherTokenBalanceBefore).to.equal(await ethers.provider.getBalance(justToken.target));
            expect(etherRouterBalanceAfter - baseFeePerGasInWei * configMinGasLimit).to.equal(await ethers.provider.getBalance(router.target));
            expect(etherCollectorBalanceAfter + 2n * (baseFeePerGasInWei * configMinGasLimit)).to.equal(await ethers.provider.getBalance(feeCollector));
        });
    });

    describe("Redeem", function () {
        it("Infinite redeem return data", async function () {
            const { admin, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            const UTSTokenMockTwo = await ethers.getContractFactory("UTSTokenMockTwo", admin);
            const mock = await UTSTokenMockTwo.deploy(router.target);
            await mock.waitForDeployment();

            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const amountToRedeem = withDecimals("1500");
            const gasLimit = 1000000n;
            const customPayload = "0xffaa0011";

            const params = await encodeParamsToRedeem(
                user,
                mock,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                gasLimit,
                customPayload
            );

            const userBalanceBefore = await mock.balanceOf(user);
            const totalSupplyBefore = await mock.totalSupply();

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

            const receipt = await tx.wait();
            let filter = masterRouter.filters.ProposalExecuted;
            let events = await masterRouter.queryFilter(filter, -1);
            let args = events[0].args;

            expect(userBalanceBefore).to.equal(await mock.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await mock.totalSupply());

            expect(235000 >= receipt.gasUsed).to.equal(true);
            expect(await args[0]).to.equal(1);
            expect(await mock.isExecutionFailed(
                user,
                amountToRedeem,
                customPayload,
                [user.address, allowedChainIds[0], configPeer, configDecimals],
                1
            )).to.equal(true);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            filter = mock.filters.ExecutionFailed;
            events = await mock.queryFilter(filter, -1);
            args = events[0].args;

            expect(args[0]).to.equal(user.address);
            expect(args[1]).to.equal(amountToRedeem);
            expect(args[2]).to.equal(customPayload);
        });

        it("Infinite storeFailedExecution return data", async function () {
            const { admin, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

            const UTSTokenMock = await ethers.getContractFactory("UTSTokenMock", admin);
            const mock = await UTSTokenMock.deploy(router.target);
            await mock.waitForDeployment();

            const allowedChainIds = [testDstChainId];
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;

            const amountToRedeem = withDecimals("1500");
            const gasLimit = 1000000n;

            const params = await encodeParamsToRedeem(
                user,
                mock,
                user,
                amountToRedeem,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                gasLimit,
                "0xff"
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

            const receipt = await tx.wait();
            const filter = masterRouter.filters.ProposalExecuted;
            const events = await masterRouter.queryFilter(filter, -1);
            const args = events[0].args;

            expect(178000 >= receipt.gasUsed).to.equal(true);
            expect(await args[0]).to.equal(2);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("Should return error code by invalid protocol version", async function () {
            const { adminRole, zeroAddress, registry, factory, executor, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(ERC20Fixture);

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
            const gasLimit = 1000000n;

            const localParams = AbiCoder.encode([
                "bytes",
                "bytes",
                "uint256",
                "uint256",
                "bytes",
                "uint8",
                "uint64",
                "bytes"
            ], [
                user.address,
                user.address,
                amountToRedeem,
                testDstChainId,
                configPeer,
                configDecimals,
                gasLimit,
                "0x"
            ]);

            const params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                deployedToken.target,
                "0xff",
                localParams
            ]);

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

            expect(await args[0]).to.equal(12);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });
    });

    describe("Errors", function () {
        it("Should return error code by srcToken eq zero address", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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
                999n,
                allowedChainIds[0],
                "0x",
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

            expect(await args[0]).to.equal(8);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);
        });

        it("UTS Router E0 bridge", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
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

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                withDecimals("1"),
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: baseFeePerGasInWei * configMinGasLimit - 1n }
            )).to.be.revertedWithCustomError(router, "UTSRouter__E0");
        });

        it("UTS Router E0 update", async function () {
            const { admin, masterRouter, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
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

            await masterRouter.connect(admin).setDstMasterRouter(
                [testDstChainId, 138],
                [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
            );

            await router.connect(admin).setDstUpdateGas(
                [testDstChainId, 138],
                [123456, 78900]
            );

            const paymentAmount = await router.getUpdateFee([testDstChainId, 138], [10, 1]);
            const paymentAmountBase = await deployedToken.estimateUpdateFee([testDstChainId, 138], [10, 1]);

            expect(paymentAmount).to.equal(paymentAmountBase);

            const config = ["0xf4c3efb93eec00", 123n, 243n, true];
            const updateConfigTen = [
                [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                [config, config, config, config, config, config, config, config, config, config]
            ];

            await deployedToken.connect(user).setChainConfig(
                [testDstChainId, 138],
                [config, config]
            );

            await expect(deployedToken.connect(user).setChainConfigToDestination(
                [testDstChainId, 138],
                [updateConfigTen, [[1n], [config]]],
                { value: paymentAmount - 1n }
            )).to.be.revertedWithCustomError(router, "UTSRouter__E0");
        });

        it("UTS Router E1 bridge", async function () {
            const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
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

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                withDecimals("1"),
                testCurChainId,
                configMinGasLimit,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(router, "UTSRouter__E1");
        });

        it("UTS Router E1 redeem", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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

            let params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                testCurChainId,
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

            expect(await args[0]).to.equal(6);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            await endpoint.executeOperation([
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
        });

        it("UTS Router E2", async function () {
            const { mockRouter, admin, router } = await loadFixture(ERC20Fixture);

            await mockRouter.setProtocolVersion("0xffff");

            expect(await router.protocolVersion()).to.equal(globalProtocolVersion);

            await expect(mockRouter.connect(admin).bridge(
                router.target,
                ethers.zeroPadValue(router.target, 32),
                ethers.zeroPadValue(router.target, 32),
                1,
                12,
                31336,
                1234,
                "0x",
                "0x",
            )).to.be.revertedWithCustomError(router, "UTSRouter__E2");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [],
                [],
                []
            )).to.be.revertedWithCustomError(router, "UTSRouter__E2");
        });

        it("UTS Router E3", async function () {
            const { admin, router } = await loadFixture(ERC20Fixture);

            await expect(router.connect(admin).execute(
                admin,
                "0xff",
                "0x"
            )).to.be.revertedWithCustomError(router, "UTSRouter__E3");
        });

        it("UTS Router E4", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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

            let params = await encodeParamsToRedeem(
                user,
                deployedToken,
                zeroAddress,
                999n,
                allowedChainIds[0],
                zeroHash,
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

            expect(await args[0]).to.equal(7);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            await endpoint.executeOperation([
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
        });

        it("UTS Router E5 bridge", async function () {
            const { adminRole, zeroAddress, registry, factory, user, executor, router, zeroHash } = await loadFixture(ERC20Fixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
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

            await expect(deployedToken.connect(user).bridge(
                user.address,
                user.address,
                withDecimals("1"),
                allowedChainIds[0] + 1,
                500000n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(router, "UTSRouter__E5");
        });

        it("UTS Router E5 redeem empty address", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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

            let params = await encodeParamsToRedeem(
                user,
                deployedToken,
                zeroAddress,
                999n,
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

            expect(await args[0]).to.equal(7);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            await endpoint.executeOperation([
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
        });

        it("UTS Router E5 redeem zero address", async function () {
            const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(ERC20Fixture);

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

            const localParams = AbiCoder.encode([
                "bytes",
                "bytes",
                "uint256",
                "uint256",
                "bytes",
                "uint8",
                "uint64",
                "bytes"
            ], [
                user.address,
                zeroAddress,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            ]);

            let params = AbiCoder.encode([
                "bytes",
                "bytes1",
                "bytes"
            ], [
                await convertToBytes(deployedToken),
                routerBridgeMessageType,
                localParams
            ]);

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

            expect(await args[0]).to.equal(7);
            expect(await args[1]).to.equal(deployedToken.target);
            expect(await args[2]).to.equal(router.target);
            expect(await args[3]).to.equal(params);

            const hash = await endpoint.getHash(protocolId, testCurChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

            expect(await endpoint.lastExecution()).to.equal(hash);

            params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                999n,
                allowedChainIds[0],
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            await endpoint.executeOperation([
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
        });

        it("UTS Router E6", async function () {
            const { mockRouter, admin, router, managerRole } = await loadFixture(ERC20Fixture);

            const gasLimit = 1000n;
            const ltestDstChainId = 31336n;
            await mockRouter.setProtocolVersion(globalProtocolVersion);
            await router.connect(admin).grantRole(managerRole, admin);
            await router.connect(admin).setDstMinGasLimit([ltestDstChainId], [gasLimit]);

            expect(await router.dstMinGasLimit(ltestDstChainId)).to.equal(gasLimit);

            await expect(mockRouter.connect(admin).bridge(
                router.target,
                ethers.zeroPadValue(mockRouter.target, 32),
                ethers.zeroPadValue(mockRouter.target, 32),
                1,
                12,
                ltestDstChainId,
                gasLimit - 1n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(router, "UTSRouter__E6");
        });

        it("UTS Router E7", async function () {
            const { mockRouter, admin, router } = await loadFixture(ERC20Fixture);

            await expect(router.connect(admin).setDstProtocolFee(
                [1], [1, 2]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(router.connect(admin).setDstProtocolFee(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(router.connect(admin).setDstMinGasLimit(
                [1], [1, 2]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(router.connect(admin).setDstMinGasLimit(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(router.connect(admin).setDstUpdateGas(
                [1], [1, 2]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(router.connect(admin).setDstUpdateGas(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await mockRouter.setProtocolVersion("0x0101");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [1],
                [],
                []
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [],
                ["0x01"],
                []
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [],
                ["0x01"],
                [[[1], []]]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(mockRouter.connect(admin).setChainConfigToDestination(
                router.target,
                admin.address,
                [1],
                ["0x01"],
                []
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(router.connect(admin).getUpdateFee(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");

            await expect(router.connect(admin).getUpdateFee(
                [1, 2], [1]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E7");
        });
    });
});