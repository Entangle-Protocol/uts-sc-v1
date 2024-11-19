const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const withDecimals = ethers.parseEther;
const curChainId = 31337;
const dstChainId = 137;
const globalProtocolVersion = "0x0101";
const routerBridgeMessageType = "0x01";
const dRouterDeployMessageType = "0x02";
const routerUpdateMessageType = "0x03";
const AbiCoder = new ethers.AbiCoder();

const UTSDeploymentRouterProxyModule = require("../ignition/modules/UTSDeploymentRouterProxyModule");
const UTSMasterRouterProxyModule = require("../ignition/modules/UTSMasterRouterProxyModule");
const UTSPriceFeedProxyModule = require("../ignition/modules/UTSPriceFeedProxyModule");
const UTSRegistryProxyModule = require("../ignition/modules/UTSRegistryProxyModule");
const UTSFactoryProxyModule = require("../ignition/modules/UTSFactoryProxyModule");
const UTSRouterProxyModule = require("../ignition/modules/UTSRouterProxyModule");
const UTSCodeStorageModule = require("../ignition/modules/UTSCodeStorageModule");

describe("UTS ERC20 V1 Tests", function () {

    async function globalFixture() {
        const [admin, user, executor, feeCollector] = await ethers.getSigners();

        const EndpointMock = await ethers.getContractFactory("EndpointMock", admin);
        const endpoint = await EndpointMock.deploy();
        await endpoint.waitForDeployment();

        const ERC20Mock = await ethers.getContractFactory("ERC20Mock", admin);
        const paymentToken = await ERC20Mock.deploy(18);
        await paymentToken.waitForDeployment();

        const initCalldata = "0xc4d66de8000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266";

        const { registryProxy } = await ignition.deploy(UTSRegistryProxyModule, {
            parameters: {
                UTSRegistryProxyModule: {
                    initializeCalldata: initCalldata,
                },
            },
        });

        const { masterRouterProxy } = await ignition.deploy(UTSMasterRouterProxyModule, {
            parameters: {
                UTSMasterRouterProxyModule: {
                    initializeCalldata: initCalldata,
                    endpointAddress: endpoint.target,
                    getRouterGasLimit: 10000,
                },
            },
        });

        const { factoryProxy } = await ignition.deploy(UTSFactoryProxyModule, {
            parameters: {
                UTSFactoryProxyModule: {
                    initializeCalldata: initCalldata,
                    masterRouterAddress: masterRouterProxy.target,
                    registryAddress: registryProxy.target,
                },
            },
        });

        const { priceFeedProxy } = await ignition.deploy(UTSPriceFeedProxyModule, {
            parameters: {
                UTSPriceFeedProxyModule: {
                    initializeCalldata: initCalldata,
                },
            },
        });

        const { routerProxy } = await ignition.deploy(UTSRouterProxyModule, {
            parameters: {
                UTSRouterProxyModule: {
                    initializeCalldata: initCalldata,
                    masterRouterAddress: masterRouterProxy.target,
                    priceFeedAddress: priceFeedProxy.target,
                    storeGasLimit: 45000,
                    updateGasLimit: 30000,
                    paymentTransferGasLimit: 3000,
                },
            },
        });

        const { dRouterProxy } = await ignition.deploy(UTSDeploymentRouterProxyModule, {
            parameters: {
                UTSDeploymentRouterProxyModule: {
                    initializeCalldata: initCalldata,
                    masterRouterAddress: masterRouterProxy.target,
                    priceFeedAddress: priceFeedProxy.target,
                    factoryAddress: factoryProxy.target,
                    registryAddress: registryProxy.target,
                    paymentTokenAddress: paymentToken.target,
                    paymentTokenDecimals: 18,
                    nativeTokenDecimals: 18,
                    paymentTransferGasLimit: 3000,
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

        const registry = await ethers.getContractAt("UTSRegistry", registryProxy);
        const masterRouter = await ethers.getContractAt("UTSMasterRouter", masterRouterProxy);
        const factory = await ethers.getContractAt("UTSFactory", factoryProxy);
        const priceFeed = await ethers.getContractAt("UTSPriceFeed", priceFeedProxy);
        const router = await ethers.getContractAt("UTSRouter", routerProxy);
        const dRouter = await ethers.getContractAt("UTSDeploymentRouter", dRouterProxy);

        const justToken = await ERC20Mock.deploy(18);
        await justToken.waitForDeployment();

        const RouterMock = await ethers.getContractFactory("RouterMock", admin);
        const mockRouter = await RouterMock.deploy();
        await mockRouter.waitForDeployment();

        const adminRole = await registry.DEFAULT_ADMIN_ROLE();
        const approverRole = await registry.APPROVER_ROLE();
        const factoryRole = await registry.FACTORY_ROLE();
        const routerRole = await masterRouter.ROUTER_ROLE();
        const pauserRole = await factory.PAUSER_ROLE();
        const managerRole = await router.MANAGER_ROLE();
        const providerRole = await priceFeed.PROVIDER_ROLE();

        const groupId = [1n, 2n, 3n, 4n]
        const prices = [
            1129878312369602537502204908980629571524956592795160865310248716800000n,
            207919288430829661534269173292308851077110717309661052642059096598901248n,
            1967466187033702554253712744551684260132822172337025861599922503609177n,
            62017011138835482832437730536824915658235399606085787397919460150518842n
        ];
        const minGasLimit = 100000n;
        const deployTokenGas = 3300000n;
        const deployConnectorGas = 2500000n;

        await priceFeed.connect(admin).setChainInfo(
            [1, 10, 56, 100, 137, 5000, 8453, 42161, 43114, 59144, 81457, 534352, 33033, 559999, 569999, 570001],
            [
                4722366482869645213696n,
                4740813226943354765312n,
                4759259971017064316928n,
                4777706715090773868544n,
                9444732965739290427392n,
                9463179709812999979008n,
                9481626453886709530624n,
                9500073197960419082240n,
                14167099448608935641088n,
                14185546192682645192704n,
                14203992936756354744320n,
                14222439680830064295936n,
                18889465931478580854784n,
                18907912675552290406400n,
                18926359419625999958016n,
                18944806163699709509632n
            ]
        );

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
        await masterRouter.connect(admin).setFeeCollector(feeCollector);
        await masterRouter.connect(admin).grantRole(routerRole, router.target);
        await masterRouter.connect(admin).grantRole(routerRole, dRouter.target);
        await masterRouter.connect(admin).setDstMasterRouter([dstChainId], [ethers.zeroPadValue(masterRouter.target, 32)]);
        await registry.connect(admin).grantRole(factoryRole, factory.target);
        await factory.connect(admin).setRouter(dRouter.target);
        await priceFeed.connect(admin).grantRole(providerRole, admin);
        await priceFeed.connect(admin).setPrices(groupId, prices);

        await router.connect(admin).grantRole(managerRole, admin);
        await router.connect(admin).setDstMinGasLimit([dstChainId], [minGasLimit]);

        await dRouter.connect(admin).setDstDeployConfig(
            [dstChainId],
            [[factory.target, deployTokenGas, deployConnectorGas, 0n]]
        );

        await justToken.connect(admin).transfer(user, withDecimals("10000"));
        await justToken.connect(admin).transfer(executor, withDecimals("10000"));

        const zeroHash = ethers.ZeroHash;
        const zeroAddress = ethers.ZeroAddress;
        const protocolId = "0x4554530000000000000000000000000000000000000000000000000000000000";
        const functionSelector = "0x002030faa25900000000000000000000000000000000000000000000000000000000";

        const baseFeePerGasInWei = await priceFeed.getDstGasPriceAtSrcNative(dstChainId);
        const paymentTokenToNativeRateChainId = await dRouter.EOB_CHAIN_ID();

        return {
            admin, user, executor, factory, router, registry, justToken, zeroHash, zeroAddress, adminRole, approverRole, factoryRole, routerRole,
            mockRouter, endpoint, masterRouter, protocolId, functionSelector, pauserRole, managerRole, minGasLimit, providerRole, baseFeePerGasInWei,
            feeCollector, priceFeed, prices, groupId, dRouter, paymentToken, deployTokenGas, deployConnectorGas, codeStorage, paymentTokenToNativeRateChainId,
            codeStorageMintable, codeStorageTokenWithFee, codeStorageMintableWithFee, codeStoragePure, codeStorageConnectorWithFee
        };
    };

    async function convert(amount, decimalsIn, decimalsOut) {
        if (decimalsOut > decimalsIn) {
            return amount * (10n ** (decimalsOut - decimalsIn));
        } else {
            if (decimalsOut < decimalsIn) {
                return amount / (10n ** (decimalsIn - decimalsOut));
            }
        }

        return amount;
    };

    async function convertToBytes(instance) {
        let bytesAddress;

        const code = await ethers.provider.getCode(instance);

        if (instance == ethers.ZeroAddress || instance == ethers.ZeroHash) {
            bytesAddress = "0x";
        } else {
            if (code == "0x") {
                bytesAddress = instance.address;
            } else {
                bytesAddress = instance.target;
            }
        }

        return bytesAddress;
    }

    async function encodeParamsToRedeem(
        msgSender,
        dstToken,
        dstTo,
        amount,
        srcChainId,
        srcPeer,
        srcDecimals,
        gasLimit,
        customPayload
    ) {
        const dstTokenAddress = await convertToBytes(dstToken);
        const dstToAddress = await convertToBytes(dstTo);
        const senderAddress = await convertToBytes(msgSender);

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
            senderAddress,
            dstToAddress,
            amount,
            srcChainId,
            srcPeer,
            srcDecimals,
            gasLimit,
            customPayload
        ]);

        const params = AbiCoder.encode([
            "bytes",
            "bytes1",
            "bytes"
        ], [
            dstTokenAddress,
            routerBridgeMessageType,
            localParams
        ]);

        return params;
    };

    async function encodeParamsToUpdateConfig(msgSender, dstToken, srcChainId, srcPeer, updateConfig) {
        const senderAddress = await convertToBytes(msgSender);
        const dstTokenAddress = await convertToBytes(dstToken);

        const localParams = AbiCoder.encode([
            "bytes",
            "uint256",
            "bytes",
            "tuple(uint256[], tuple(bytes, uint64, uint8, bool)[])"
        ], [
            senderAddress,
            srcChainId,
            srcPeer,
            updateConfig
        ]);

        const params = AbiCoder.encode([
            "bytes",
            "bytes1",
            "bytes"
        ], [
            dstTokenAddress,
            routerUpdateMessageType,
            localParams
        ]);

        return params;
    };

    async function encodeParamsToDeployToken(
        dRouter,
        dstfactory,
        dstPayer,
        owner,
        name,
        symbol,
        decimals,
        initialSupply,
        mintedAmountToOwner,
        mintable,
        globalBurnable,
        onlyRoleBurnable,
        feeModule,
        router,
        allowedChainIds,
        chainConfigs,
        salt
    ) {
        const ownerAddress = await convertToBytes(owner);
        const routerAddress = await convertToBytes(router);

        const tokenDeployParams = AbiCoder.encode([
            "tuple(bytes, string, string, uint8, uint256, uint256, bool, bool, bool, bool, bool, bytes, uint256[], tuple(bytes, uint64, uint8, bool)[], bytes32)"
        ], [[
            ownerAddress,
            name,
            symbol,
            decimals,
            initialSupply,
            mintedAmountToOwner,
            false,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            routerAddress,
            allowedChainIds,
            chainConfigs,
            salt
        ]]);

        const tokenDeployParamsOnchain = await dRouter.getDeployTokenParams([
            ownerAddress,
            name,
            symbol,
            decimals,
            initialSupply,
            mintedAmountToOwner,
            false,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            routerAddress,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        expect(tokenDeployParams).to.equal(tokenDeployParamsOnchain);

        const [localParams, params] = await encodeParamsToDeploy(dstfactory, false, dstPayer, tokenDeployParams);

        return [tokenDeployParams, localParams, params];
    };

    async function encodeParamsToDeployConnector(
        dRouter,
        dstfactory,
        dstPayer,
        owner,
        underlyingToken,
        feeModule,
        router,
        allowedChainIds,
        chainConfigs,
        salt
    ) {
        const underlyingTokenAddress = await convertToBytes(underlyingToken);
        const ownerAddress = await convertToBytes(owner);
        const routerAddress = await convertToBytes(router);

        const connectorDeployParams = AbiCoder.encode([
            "tuple(bytes, bytes, bool, bytes, uint256[], tuple(bytes, uint64, uint8, bool)[], bytes32)"
        ], [[
            ownerAddress,
            underlyingTokenAddress,
            feeModule,
            routerAddress,
            allowedChainIds,
            chainConfigs,
            salt
        ]]);

        const connectorDeployParamsOnchain = await dRouter.getDeployConnectorParams([
            ownerAddress,
            underlyingTokenAddress,
            feeModule,
            routerAddress,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        expect(connectorDeployParams).to.equal(connectorDeployParamsOnchain);

        const [localParams, params] = await encodeParamsToDeploy(dstfactory, true, dstPayer, connectorDeployParams);

        return [connectorDeployParams, localParams, params];
    };

    async function encodeParamsToDeploy(dstfactory, isConnector, dstPayer, deployParams) {
        const dstFactoryAddress = await convertToBytes(dstfactory);
        const dstPayerAddress = await convertToBytes(dstPayer);

        const localParams = AbiCoder.encode([
            "bool",
            "bytes",
            "bytes"
        ], [
            isConnector,
            dstPayerAddress,
            deployParams
        ]);

        const params = AbiCoder.encode([
            "bytes",
            "bytes1",
            "bytes"
        ], [
            dstFactoryAddress,
            dRouterDeployMessageType,
            localParams
        ]);

        return [localParams, params];
    };

    async function validateBridgeFee(router, priceFeed, chainId, gasLimit, payloadLength) {
        const gasPrice = await priceFeed.getDstGasPriceAtSrcNative(chainId);
        const pricePerByte = await priceFeed.getDstPricePerByteInWei(chainId);
        const BPS = 10000n;
        const feeBPS = await router.dstProtocolFee(chainId);

        expect(BPS + 1n).to.above(feeBPS);

        const fee = await router.getBridgeFee(chainId, gasLimit, payloadLength, "0x");
        const baseFee = (gasLimit * gasPrice + payloadLength * pricePerByte);
        const calcFee = baseFee * (BPS + feeBPS) / BPS;

        expect(fee).to.equal(calcFee);
        expect(fee + 1n).to.above(baseFee);
        expect(baseFee * 2n + 1n).to.above(fee);

        if (gasLimit == 0 && payloadLength == 0) {
            expect(fee).to.equal(0n);
            expect(baseFee).to.equal(0n);
        }

        if (feeBPS == 0) {
            expect(fee).to.equal(baseFee);
        }

        return fee, baseFee, calcFee;
    };

    async function validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed) {
        const deployTokenGas = await dRouter.dstTokenDeployGas(dstChainId);
        const deployConnectorGas = await dRouter.dstConnectorDeployGas(dstChainId);
        const paymentTokenToNativeRateChainId = await dRouter.EOB_CHAIN_ID();
        const BPS = 10000n;

        let baseNativePaymentAmount = 0n;
        let extraNativePaymentAmount = 0n;

        for (let i = 0n; tokenChainIds.length > i; i++) {
            if (tokenChainIds[i] != curChainId) baseNativePaymentAmount += deployTokenGas * await priceFeed.getDstGasPriceAtSrcNative(tokenChainIds[i]);
        }

        for (let i = 0n; connectorChainIds.length > i; i++) {
            if (connectorChainIds[i] != curChainId) baseNativePaymentAmount += deployConnectorGas * await priceFeed.getDstGasPriceAtSrcNative(connectorChainIds[i]);
        }

        for (let i = 0n; tokenChainIds.length > i; i++) {
            let feeBPS = await dRouter.dstProtocolFee(tokenChainIds[i]);
            expect(BPS + 1n).to.above(feeBPS);
            if (tokenChainIds[i] != curChainId) extraNativePaymentAmount += deployTokenGas * await priceFeed.getDstGasPriceAtSrcNative(tokenChainIds[i]) * (BPS + feeBPS) / BPS;
        }

        for (let i = 0n; connectorChainIds.length > i; i++) {
            let feeBPS = await dRouter.dstProtocolFee(connectorChainIds[i]);
            expect(BPS + 1n).to.above(feeBPS);
            if (connectorChainIds[i] != curChainId) extraNativePaymentAmount += deployConnectorGas * await priceFeed.getDstGasPriceAtSrcNative(connectorChainIds[i]) * (BPS + feeBPS) / BPS;
        }

        const paymentTokenToNativeRate = await priceFeed.getDstGasPriceAtSrcNative(paymentTokenToNativeRateChainId);
        const feeFreeTokenPaymentAmount = baseNativePaymentAmount * paymentTokenToNativeRate / 1000000n;
        const tokenPaymentAmount = extraNativePaymentAmount * paymentTokenToNativeRate / 1000000n;
        const contractPaymentAmount = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

        expect(tokenPaymentAmount + 1n).to.above(feeFreeTokenPaymentAmount);
        expect(tokenPaymentAmount).to.equal(contractPaymentAmount[0]);
        expect(baseNativePaymentAmount * 2n + 1n).to.above(extraNativePaymentAmount);
        expect(contractPaymentAmount[1] + 1n).to.above(baseNativePaymentAmount);

        if (tokenChainIds.length == 0 && connectorChainIds.length == 0) {
            expect(baseNativePaymentAmount).to.equal(0n);
            expect(tokenPaymentAmount).to.equal(0n);
            expect(extraNativePaymentAmount).to.equal(0n);
        } else {
            if (paymentTokenToNativeRate > 0 && baseNativePaymentAmount > 0) {
                expect(tokenPaymentAmount).to.above(0n);
                expect(feeFreeTokenPaymentAmount).to.above(0n);
                expect(contractPaymentAmount[1]).to.above(0n);
            }
        }

        return tokenPaymentAmount;
    };

    async function deployTokenByFactory(
        deployer,
        owner,
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
    ) {
        const deployerAddress = await convertToBytes(deployer);
        const ownerAddress = await convertToBytes(owner);

        const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];
        const deploymentsBefore = await registry.totalDeployments();
        let blueprint = 0;

        if (mintable) blueprint = 1;
        if (feeModule) blueprint = 2;
        if (mintable && feeModule) blueprint = 3;

        let precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, false);

        expect(precompute.hasCode).to.equal(false);

        const tx = await factory.connect(deployer).deployToken([
            ownerAddress,
            name,
            symbol,
            decimals,
            initialSupply,
            initialSupply,
            false,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        await tx.wait();

        expect(await registry.totalDeployments()).to.equal(deploymentsBefore + 1n);

        const deploymentsByIndex = await registry.deploymentsByIndex([deploymentsBefore]);

        expect(precompute.deployment).to.equal(deploymentsByIndex[0]);

        precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, false);
        expect(precompute.deployment).to.equal(deploymentsByIndex[0]);
        expect(precompute.hasCode).to.equal(true);

        let deployedToken;

        if (blueprint == 0) deployedToken = await ethers.getContractAt("UTSToken", deploymentsByIndex[0]);
        if (blueprint == 1) {
            deployedToken = await ethers.getContractAt("UTSTokenMintable", deploymentsByIndex[0]);

            expect(await deployedToken.MINTER_ROLE()).to.equal("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6");
        }
        if (blueprint == 2) {
            deployedToken = await ethers.getContractAt("UTSTokenWithFee", deploymentsByIndex[0]);

            expect(await deployedToken.feeCollector()).to.equal(zeroAddress);
        }
        if (blueprint == 3) {
            deployedToken = await ethers.getContractAt("UTSTokenMintableWithFee", deploymentsByIndex[0]);

            expect(await deployedToken.MINTER_ROLE()).to.equal("0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6");
            expect(await deployedToken.feeCollector()).to.equal(zeroAddress);
        }

        const data = await registry.deploymentData(deployedToken.target);
        const allowedChainId = allowedChainIds[0];
        const chainConfigData = await deployedToken.getChainConfigs([allowedChainId]);

        let filter = registry.filters.ChainConfigUpdated;
        let events = await registry.queryFilter(filter, -1);
        let args = events[0].args;

        expect(await args[0]).to.equal(deployedToken.target);

        filter = registry.filters.RouterUpdated;
        events = await registry.queryFilter(filter, -1);
        args = events[0].args;

        expect(await args[0]).to.equal(deployedToken.target);
        expect(await args[1]).to.equal(router.target);

        expect(deployedToken.target).to.equal(data.underlyingToken);
        expect(data.deployer).to.equal(deployer.address.toLowerCase());
        expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
        expect(data.underlyingToken).to.equal(deployedToken.target);
        expect(chainConfigData[0].peerAddress).to.equal(configPeer);
        expect(chainConfigData[0].minGasLimit).to.equal(configMinGasLimit);
        expect(chainConfigData[0].decimals).to.equal(configDecimals);
        expect(chainConfigData[0].paused).to.equal(false);
        expect(await deployedToken.protocolVersion()).to.equal(await factory.protocolVersion());
        expect(await deployedToken.underlyingToken()).to.equal(deployedToken.target);
        expect(await deployedToken.totalSupply()).to.equal(initialSupply);
        expect(await deployedToken.balanceOf(owner)).to.equal(initialSupply);
        expect(await deployedToken.name()).to.equal(name);
        expect(await deployedToken.symbol()).to.equal(symbol);
        expect(await deployedToken.decimals()).to.equal(decimals);
        expect(await deployedToken.router()).to.equal(router.target);

        if (onlyRoleBurnable) {
            expect(await deployedToken.globalBurnable()).to.equal(true);
        } else {
            expect(await deployedToken.globalBurnable()).to.equal(globalBurnable);
        }

        expect(await deployedToken.onlyRoleBurnable()).to.equal(onlyRoleBurnable);
        expect(await deployedToken.hasRole(adminRole, owner)).to.equal(true);
        if (deployer != owner) expect(await deployedToken.hasRole(adminRole, deployer)).to.equal(false);
        expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
        expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);

        const allowedChainIdTwo = [997];
        const configMinGasLimitTwo = 100000n;
        const configPeerTwo = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimalsTwo = 18n;

        await deployedToken.connect(owner).setChainConfig(
            allowedChainIdTwo,
            [[configPeerTwo, configMinGasLimitTwo, configDecimalsTwo, true]]
        );

        const chainConfigDataTwo = await deployedToken.getChainConfigs([allowedChainIdTwo[0]]);

        expect(chainConfigDataTwo[0].peerAddress).to.equal(configPeerTwo);
        expect(chainConfigDataTwo[0].minGasLimit).to.equal(configMinGasLimitTwo);
        expect(chainConfigDataTwo[0].decimals).to.equal(configDecimalsTwo);
        expect(chainConfigDataTwo[0].paused).to.equal(true);

        await deployedToken.connect(owner).setChainConfig(
            allowedChainIdTwo,
            [[configPeerTwo, configMinGasLimitTwo, configDecimalsTwo, false]]
        );

        const allowedChainIdThree = [997, 999];
        const configMinGasLimitThreeOne = 100000n;
        const configMinGasLimitThreeTwo = 150000n;
        const configPeerThreeOne = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
        const configPeerThreeTwo = "0xf4050b2c873c7c8d2859c07d9f9d71fff19873f7376bb93b4fc3c3efb93eec00";
        const configDecimalsThreeOne = 16n;
        const configDecimalsThreeTwo = 20n;

        await deployedToken.connect(owner).setChainConfig(
            allowedChainIdThree,
            [
                [configPeerThreeOne, configMinGasLimitThreeOne, configDecimalsThreeOne, false],
                [configPeerThreeTwo, configMinGasLimitThreeTwo, configDecimalsThreeTwo, true]
            ]
        );

        const chainConfigDataThreeOne = await deployedToken.getChainConfigs([allowedChainIdThree[0]]);
        const chainConfigDataThreeTwo = await deployedToken.getChainConfigs([allowedChainIdThree[1]]);

        expect(chainConfigDataThreeOne[0].peerAddress).to.equal(configPeerThreeOne);
        expect(chainConfigDataThreeOne[0].minGasLimit).to.equal(configMinGasLimitThreeOne);
        expect(chainConfigDataThreeOne[0].decimals).to.equal(configDecimalsThreeOne);
        expect(chainConfigDataThreeOne[0].paused).to.equal(false);
        expect(chainConfigDataThreeTwo[0].peerAddress).to.equal(configPeerThreeTwo);
        expect(chainConfigDataThreeTwo[0].minGasLimit).to.equal(configMinGasLimitThreeTwo);
        expect(chainConfigDataThreeTwo[0].decimals).to.equal(configDecimalsThreeTwo);
        expect(chainConfigDataThreeTwo[0].paused).to.equal(true);

        await expect(deployedToken.connect(owner).initializeToken([
            ownerAddress,
            "string name",
            "string symbol",
            1,
            1,
            1,
            false,
            false,
            false,
            false,
            false,
            registry.target,
            [],
            [],
            zeroHash
        ])).to.be.revertedWithCustomError(deployedToken, "UTSBase__E0");

        if (initialSupply > 2n) {
            const ownerBalanceBefore = await deployedToken.balanceOf(owner);
            const targetBalanceBefore = await deployedToken.balanceOf(registry.target);
            const amountToTransfer = 1n;

            await deployedToken.connect(owner).transfer(registry.target, amountToTransfer);

            expect(ownerBalanceBefore - amountToTransfer).to.equal(await deployedToken.balanceOf(owner));
            expect(targetBalanceBefore + amountToTransfer).to.equal(await deployedToken.balanceOf(registry.target));

            const ownerBalanceBeforeTwo = await deployedToken.balanceOf(owner);
            const targetBalanceBeforeTwo = await deployedToken.balanceOf(registry.target);

            await deployedToken.connect(owner).approve(deployer, amountToTransfer);
            expect(await deployedToken.allowance(owner, deployer)).to.equal(amountToTransfer);

            await deployedToken.connect(deployer).transferFrom(owner, registry.target, amountToTransfer);

            expect(await deployedToken.allowance(owner, deployer)).to.equal(0);
            expect(ownerBalanceBeforeTwo - amountToTransfer).to.equal(await deployedToken.balanceOf(owner));
            expect(targetBalanceBeforeTwo + amountToTransfer).to.equal(await deployedToken.balanceOf(registry.target));

            await deployedToken.connect(owner).approve(deployedToken.target, amountToTransfer);

            await expect(deployedToken.connect(owner).bridge(
                ownerAddress,
                ownerAddress,
                amountToTransfer,
                allowedChainId,
                configMinGasLimit - 1n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E6");

            await expect(deployedToken.connect(owner).bridge(
                ownerAddress,
                ownerAddress,
                amountToTransfer,
                allowedChainId,
                configMinGasLimit - 1n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E6");
        }

        await expect(deployedToken.connect(owner).initializeToken([
            ownerAddress,
            "",
            "",
            decimals,
            initialSupply,
            initialSupply,
            false,
            mintable,
            globalBurnable,
            onlyRoleBurnable,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            zeroHash
        ])).to.be.revertedWithCustomError(deployedToken, "UTSBase__E0");

        if (deployer != owner) {
            await expect(deployedToken.connect(deployer).setRouter(
                router.target
            )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

            await expect(deployedToken.connect(deployer).setChainConfig(
                allowedChainIds, chainConfigs
            )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

            await expect(deployedToken.connect(deployer).setChainConfigToDestination(
                [1, 2],
                [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
            )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");
        }

        await expect(deployedToken.connect(owner).redeem(
            owner,
            1,
            "0x",
            [owner.address, allowedChainId, configPeer, configDecimals]
        )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E1");

        await expect(deployedToken.connect(deployer).redeem(
            deployer,
            1,
            "0x",
            [owner.address, allowedChainId, configPeer, configDecimals]
        )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E1");

        await expect(deployedToken.connect(owner).storeFailedExecution(
            owner,
            1,
            "0x",
            [owner.address, allowedChainId, configPeer, configDecimals],
            "0x"
        )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E1");

        await expect(deployedToken.connect(deployer).setChainConfigByRouter(
            [],
            [],
            [owner.address, allowedChainId, configPeer, configDecimals]
        )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E1");

        await expect(deployedToken.connect(owner).setChainConfig(
            [dstChainId, 12], chainConfigs
        )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E4");

        await expect(deployedToken.connect(owner).setChainConfigToDestination(
            [1, 2, 3],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E4");

        await expect(deployedToken.connect(owner).setChainConfigToDestination(
            [1, 2],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E4");

        const allowedChainIdFour = [31338];
        const configMinGasLimitFour = 0n;
        const configPeerFour = zeroHash;
        const configDecimalsFour = 18n;

        await deployedToken.connect(owner).setChainConfig(
            allowedChainIdFour,
            [[configPeerFour, configMinGasLimitFour, configDecimalsFour, false]]
        );

        const tokenAmountToBridge = withDecimals("1");
        const ownerBalance = await deployedToken.balanceOf(owner);

        if (ownerBalance >= tokenAmountToBridge) {

            await expect(deployedToken.connect(owner).bridge(
                ownerAddress,
                zeroAddress,
                tokenAmountToBridge,
                allowedChainIdTwo[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(router, "UTSRouter__E4");

            await expect(deployedToken.connect(owner).bridge(
                ownerAddress,
                "0x",
                tokenAmountToBridge,
                allowedChainIdTwo[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(router, "UTSRouter__E4");

            await expect(deployedToken.connect(owner).bridge(
                ownerAddress,
                ownerAddress,
                tokenAmountToBridge,
                31338,
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(router, "UTSRouter__E5");

            const allowedChainIdFive = [curChainId];
            const configMinGasLimitFive = 100000n;
            const configPeerFive = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
            const configDecimalsFive = 18n;

            const zeroChainConfig = [["0x", configMinGasLimit, configDecimals, false]];

            await deployedToken.connect(owner).setChainConfig(
                [dstChainId],
                [["0x", configMinGasLimitFive, configDecimalsFive, false]]
            );

            await expect(deployedToken.connect(owner).setChainConfigToDestination(
                [dstChainId, dstChainId],
                [[allowedChainIds, zeroChainConfig], [allowedChainIds, chainConfigs]]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E5");

            await expect(deployedToken.connect(owner).setChainConfigToDestination(
                [dstChainId, dstChainId],
                [[allowedChainIds, chainConfigs], [allowedChainIds, zeroChainConfig]]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E5");

            await deployedToken.connect(owner).setChainConfig(
                allowedChainIdFive,
                [[configPeerFive, configMinGasLimitFive, configDecimalsFive, false]]
            );

            await expect(deployedToken.connect(owner).bridge(
                owner.address,
                owner.address,
                tokenAmountToBridge,
                allowedChainIdFive[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: configMinGasLimit }
            )).to.be.revertedWithCustomError(router, "UTSRouter__E1");

            await expect(deployedToken.connect(owner).setChainConfigToDestination(
                [allowedChainIdFive[0], 2],
                [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
            )).to.be.revertedWithCustomError(router, "UTSRouter__E1");

            await deployedToken.connect(owner).setChainConfig(
                [dstChainId],
                chainConfigs
            );

            const ids = [
                allowedChainId,
                allowedChainIdThree[0],
                allowedChainIdTwo[0],
                allowedChainIdThree[1],
                allowedChainIdFour[0],
                allowedChainIdFive[0]
            ];

            const configData = await deployedToken.getChainConfigs(ids);

            expect(configData[0].peerAddress).to.equal(configPeer);
            expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
            expect(configData[0].decimals).to.equal(configDecimals);
            expect(configData[0].paused).to.equal(false);
            expect(configData[1].peerAddress).to.equal(configPeerThreeOne);
            expect(configData[1].minGasLimit).to.equal(configMinGasLimitThreeOne);
            expect(configData[1].decimals).to.equal(configDecimalsThreeOne);
            expect(configData[1].paused).to.equal(false);
            expect(configData[2].peerAddress).to.equal(configPeerThreeOne);
            expect(configData[2].minGasLimit).to.equal(configMinGasLimitThreeOne);
            expect(configData[2].decimals).to.equal(configDecimalsThreeOne);
            expect(configData[2].paused).to.equal(false);
            expect(configData[3].peerAddress).to.equal(configPeerThreeTwo);
            expect(configData[3].minGasLimit).to.equal(configMinGasLimitThreeTwo);
            expect(configData[3].decimals).to.equal(configDecimalsThreeTwo);
            expect(configData[3].paused).to.equal(true);
            expect(configData[4].peerAddress).to.equal(configPeerFour);
            expect(configData[4].minGasLimit).to.equal(configMinGasLimitFour);
            expect(configData[4].decimals).to.equal(configDecimalsFour);
            expect(configData[4].paused).to.equal(false);
            expect(configData[5].peerAddress).to.equal(configPeerFive);
            expect(configData[5].minGasLimit).to.equal(configMinGasLimitFive);
            expect(configData[5].decimals).to.equal(configDecimalsFive);
            expect(configData[5].paused).to.equal(false);
        }

        return { deployedToken };
    };

    async function deployConnectorByFactory(
        deployer,
        owner,
        underlyingToken,
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
    ) {
        const deployerAddress = await convertToBytes(deployer);
        const ownerAddress = await convertToBytes(owner);

        const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];
        const deploymentsBefore = await registry.totalDeployments();

        let blueprint = 0;

        if (feeModule) blueprint = 5;

        let precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, true);

        expect(precompute.hasCode).to.equal(false);

        await factory.connect(deployer).deployConnector([
            ownerAddress,
            underlyingToken.target,
            feeModule,
            router.target,
            allowedChainIds,
            chainConfigs,
            salt
        ]);

        expect(await registry.totalDeployments()).to.equal(deploymentsBefore + 1n);

        const deploymentsByIndex = await registry.deploymentsByIndex([deploymentsBefore]);

        expect(precompute.deployment).to.equal(deploymentsByIndex[0]);

        precompute = await factory.getPrecomputedAddress(blueprint, deployerAddress, salt, true);
        expect(precompute.deployment).to.equal(deploymentsByIndex[0]);
        expect(precompute.hasCode).to.equal(true);

        let deployedConnector;

        if (blueprint == 0) deployedConnector = await ethers.getContractAt("UTSConnector", deploymentsByIndex[0]);
        if (blueprint == 5) {
            deployedConnector = await ethers.getContractAt("UTSConnectorWithFee", deploymentsByIndex[0]);

            expect(await deployedConnector.feeCollector()).to.equal(zeroAddress);
        }

        const data = await registry.deploymentData(deployedConnector.target);
        const allowedChainId = allowedChainIds[0];
        const chainConfigData = await deployedConnector.getChainConfigs([allowedChainId]);

        expect(data.deployer).to.equal(deployer.address.toLowerCase());
        expect(data.underlyingToken).to.equal(underlyingToken.target);
        expect(data.initProtocolVersion).to.equal(await factory.protocolVersion());
        expect(data.underlyingToken).to.equal(underlyingToken);
        expect(chainConfigData[0].peerAddress).to.equal(configPeer);
        expect(chainConfigData[0].minGasLimit).to.equal(configMinGasLimit);
        expect(chainConfigData[0].decimals).to.equal(configDecimals);
        expect(chainConfigData[0].paused).to.equal(false);
        expect(await deployedConnector.protocolVersion()).to.equal(await factory.protocolVersion());
        expect(await deployedConnector.underlyingDecimals()).to.equal(await underlyingToken.decimals());
        expect(await deployedConnector.underlyingToken()).to.equal(underlyingToken.target);
        expect(await deployedConnector.underlyingBalance()).to.equal(0);
        expect(await deployedConnector.underlyingName()).to.equal(await underlyingToken.name());
        expect(await deployedConnector.underlyingSymbol()).to.equal(await underlyingToken.symbol());
        expect(await deployedConnector.router()).to.equal(router.target);

        expect(await deployedConnector.hasRole(adminRole, owner)).to.equal(true);
        if (deployer != owner) expect(await deployedConnector.hasRole(adminRole, deployer)).to.equal(false);
        expect(await registry.validateUnderlyingRegistered(underlyingToken.target)).to.equal(true);
        expect(await registry.validateDeploymentRegistered(deployedConnector.target)).to.equal(true);

        const amountToBridge = withDecimals("1");

        await underlyingToken.connect(owner).approve(deployedConnector.target, amountToBridge);

        await expect(deployedConnector.connect(owner).bridge(
            owner.address,
            owner.address,
            amountToBridge,
            allowedChainId,
            configMinGasLimit - 1n,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E6");

        await expect(deployedConnector.connect(owner).bridge(
            owner.address,
            ownerAddress,
            amountToBridge,
            allowedChainId,
            configMinGasLimit - 1n,
            "0x",
            "0x"
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E6");

        const allowedChainIdTwo = [997];
        const configMinGasLimitTwo = 100000n;
        const configPeerTwo = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
        const configDecimalsTwo = 18n;

        await deployedConnector.connect(owner).setChainConfig(
            allowedChainIdTwo,
            [[configPeerTwo, configMinGasLimitTwo, configDecimalsTwo, false]]
        );

        const chainConfigDataTwo = await deployedConnector.getChainConfigs([allowedChainIdTwo[0]]);

        expect(chainConfigDataTwo[0].peerAddress).to.equal(configPeerTwo);
        expect(chainConfigDataTwo[0].minGasLimit).to.equal(configMinGasLimitTwo);
        expect(chainConfigDataTwo[0].decimals).to.equal(configDecimalsTwo);
        expect(chainConfigDataTwo[0].paused).to.equal(false);

        const allowedChainIdThree = [997, 999];
        const configMinGasLimitThreeOne = 100000n;
        const configMinGasLimitThreeTwo = 150000n;
        const configPeerThreeOne = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
        const configPeerThreeTwo = "0xf4050b2c873c7c8d2859c07d9f9d71fff19873f7376bb93b4fc3c3efb93eec00";
        const configDecimalsThreeOne = 16n;
        const configDecimalsThreeTwo = 20n;

        await deployedConnector.connect(owner).setChainConfig(
            allowedChainIdThree,
            [
                [configPeerThreeOne, configMinGasLimitThreeOne, configDecimalsThreeOne, true],
                [configPeerThreeTwo, configMinGasLimitThreeTwo, configDecimalsThreeTwo, false]
            ]
        );

        const chainConfigDataThreeOne = await deployedConnector.getChainConfigs([allowedChainIdThree[0]]);
        const chainConfigDataThreeTwo = await deployedConnector.getChainConfigs([allowedChainIdThree[1]]);

        expect(chainConfigDataThreeOne[0].peerAddress).to.equal(configPeerThreeOne);
        expect(chainConfigDataThreeOne[0].minGasLimit).to.equal(configMinGasLimitThreeOne);
        expect(chainConfigDataThreeOne[0].decimals).to.equal(configDecimalsThreeOne);
        expect(chainConfigDataThreeOne[0].paused).to.equal(true);
        expect(chainConfigDataThreeTwo[0].peerAddress).to.equal(configPeerThreeTwo);
        expect(chainConfigDataThreeTwo[0].minGasLimit).to.equal(configMinGasLimitThreeTwo);
        expect(chainConfigDataThreeTwo[0].decimals).to.equal(configDecimalsThreeTwo);
        expect(chainConfigDataThreeTwo[0].paused).to.equal(false);

        await expect(deployedConnector.connect(owner).initializeConnector(
            ownerAddress,
            underlyingToken.target,
            router.target,
            allowedChainIds,
            chainConfigs
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E0");

        if (deployer != owner) {
            await expect(deployedConnector.connect(deployer).setRouter(
                router.target
            )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

            await expect(deployedConnector.connect(deployer).setChainConfig(
                allowedChainIds, chainConfigs
            )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

            await expect(deployedConnector.connect(deployer).setChainConfigToDestination(
                [1, 2],
                [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
            )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");
        }

        await expect(deployedConnector.connect(owner).redeem(
            owner,
            1,
            "0x",
            [owner.address, allowedChainId, configPeer, configDecimals]
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E1");

        await expect(deployedConnector.connect(deployer).redeem(
            deployer,
            1,
            "0x",
            [owner.address, allowedChainId, configPeer, configDecimals]
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E1");

        await expect(deployedConnector.connect(owner).storeFailedExecution(
            owner,
            1,
            "0x",
            [owner.address, allowedChainId, configPeer, configDecimals],
            "0x"
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E1");

        await expect(deployedConnector.connect(deployer).setChainConfigByRouter(
            [],
            [],
            [owner.address, allowedChainId, configPeer, configDecimals]
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E1");

        await expect(deployedConnector.connect(owner).setChainConfig(
            [dstChainId, 12],
            chainConfigs
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E4");

        await expect(deployedConnector.connect(owner).setChainConfigToDestination(
            [1, 2, 3],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E4");

        await expect(deployedConnector.connect(owner).setChainConfigToDestination(
            [1, 2],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E4");

        const allowedChainIdFour = [31338];
        const configMinGasLimitFour = 0n;
        const configPeerFour = zeroHash;
        const configDecimalsFour = 18n;

        await deployedConnector.connect(owner).setChainConfig(
            allowedChainIdFour,
            [[configPeerFour, configMinGasLimitFour, configDecimalsFour, false]]
        );

        const tokenAmountToBridge = withDecimals("100");

        await underlyingToken.connect(owner).approve(deployedConnector.target, tokenAmountToBridge);

        await expect(deployedConnector.connect(owner).bridge(
            owner.address,
            zeroAddress,
            tokenAmountToBridge,
            allowedChainId,
            configMinGasLimit,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "UTSRouter__E4");

        await expect(deployedConnector.connect(owner).bridge(
            owner.address,
            "0x",
            tokenAmountToBridge,
            allowedChainId,
            configMinGasLimit,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "UTSRouter__E4");

        await expect(deployedConnector.connect(owner).bridge(
            owner.address,
            owner.address,
            tokenAmountToBridge,
            allowedChainIdFour[0],
            configMinGasLimit,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "UTSRouter__E5");

        const allowedChainIdFive = [curChainId];
        const configMinGasLimitFive = 100000n;
        const configPeerFive = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3c3efb93eec00";
        const configDecimalsFive = 16n;

        const zeroChainConfig = [["0x", configMinGasLimit, configDecimals, false]];

        await deployedConnector.connect(owner).setChainConfig(
            [dstChainId],
            [["0x", configMinGasLimitFive, configDecimalsFive, false]]
        );

        await expect(deployedConnector.connect(owner).setChainConfigToDestination(
            [dstChainId, dstChainId],
            [[allowedChainIds, zeroChainConfig], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(router, "UTSRouter__E5");

        await expect(deployedConnector.connect(owner).setChainConfigToDestination(
            [dstChainId, dstChainId],
            [[allowedChainIds, chainConfigs], [allowedChainIds, zeroChainConfig]]
        )).to.be.revertedWithCustomError(router, "UTSRouter__E5");

        await deployedConnector.connect(owner).setChainConfig(
            allowedChainIdFive,
            [[configPeerFive, configMinGasLimitFive, configDecimalsFive, false]]
        );

        await expect(deployedConnector.connect(owner).bridge(
            owner.address,
            owner.address,
            tokenAmountToBridge,
            allowedChainIdFive[0],
            configMinGasLimit,
            "0x",
            "0x",
            { value: configMinGasLimit }
        )).to.be.revertedWithCustomError(router, "UTSRouter__E1");

        await expect(deployedConnector.connect(owner).setChainConfigToDestination(
            [allowedChainIdFive[0], 2],
            [[allowedChainIds, chainConfigs], [allowedChainIds, chainConfigs]]
        )).to.be.revertedWithCustomError(router, "UTSRouter__E1");

        await deployedConnector.connect(owner).setChainConfig(
            [dstChainId],
            chainConfigs
        );

        return { deployedConnector };
    };

    describe("Proxies test", function () {
        it("Base test", async function () {
            const { feeCollector, admin, adminRole, user, factory, router, registry, approverRole, masterRouter, priceFeed, dRouter, deployTokenGas, deployConnectorGas } = await loadFixture(globalFixture);

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
            expect(await dRouter.dstTokenDeployGas(dstChainId)).to.equal(deployTokenGas);
            expect(await dRouter.dstConnectorDeployGas(dstChainId)).to.equal(deployConnectorGas);

            expect(await router.protocolVersion()).to.equal(globalProtocolVersion);
            expect(await factory.protocolVersion()).to.equal(globalProtocolVersion);
            expect(await dRouter.protocolVersion()).to.equal(globalProtocolVersion);

            expect(await router.paused()).to.equal(false);
            expect(await factory.paused()).to.equal(false);
            expect(await priceFeed.paused()).to.equal(false);
            expect(await dRouter.paused()).to.equal(false);

            let chainInfo = await priceFeed.getChainInfo(dstChainId);
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
            expect(await dRouter.dstTokenDeployGas(dstChainId)).to.equal(deployTokenGas);
            expect(await dRouter.dstConnectorDeployGas(dstChainId)).to.equal(deployConnectorGas);

            chainInfo = await priceFeed.getChainInfo(dstChainId);
            expect(chainInfo.reserved).to.equal(0);
            expect(chainInfo.groupId).to.equal(2);
            expect(chainInfo.slotOffset).to.equal(0);
            expect(chainInfo.pricePerByte).to.equal(0);

            chainInfo = await priceFeed.getChainInfo(curChainId);
            expect(chainInfo.reserved).to.equal(17);
            expect(chainInfo.groupId).to.equal(27);
            expect(chainInfo.slotOffset).to.equal(37);
            expect(chainInfo.pricePerByte).to.equal(47);
        });
    });

    describe("ERC165", function () {
        it("Base test", async function () {
            const { dRouter, masterRouter, justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor, priceFeed } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const pureToken = true;
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [dstChainId];
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

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                [[configPeer, configMinGasLimit, configDecimals, false]],
                salt
            ]);

            const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
            const deployedPureToken = await ethers.getContractAt("UTSTokenPure", precompute.deployment);
            expect(precompute.hasCode).to.equal(true);

            expect(await deployedPureToken.supportsInterface("0x950a21e1")).to.equal(true);
            expect(await deployedPureToken.supportsInterface("0x36372b07")).to.equal(true);
            expect(await deployedToken.supportsInterface("0x7965db0b")).to.equal(true);
            expect(await deployedToken.supportsInterface("0x36372b07")).to.equal(true);
            expect(await deployedToken.supportsInterface("0xfb0df930")).to.equal(true);
            expect(await deployedToken.supportsInterface("0x950a21e1")).to.equal(true);
            expect(await deployedConnector.supportsInterface("0x950a21e1")).to.equal(true);
            expect(await deployedConnector.supportsInterface("0x03ca2c97")).to.equal(true);
            expect(await router.supportsInterface("0x8e392e4e")).to.equal(true);
            expect(await factory.supportsInterface("0x63e0baa3")).to.equal(true);
            expect(await masterRouter.supportsInterface("0x5608a7ae")).to.equal(true);
            expect(await registry.supportsInterface("0x483e45f1")).to.equal(true);
            expect(await dRouter.supportsInterface("0x0a33324b")).to.equal(true);
            expect(await priceFeed.supportsInterface("0xb33b3780")).to.equal(true);
            expect(await deployedToken.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await deployedConnector.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await router.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await factory.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await masterRouter.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await registry.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await priceFeed.supportsInterface("0x01ffc9a7")).to.equal(true);
            expect(await dRouter.supportsInterface("0x01ffc9a7")).to.equal(true);
        });
    });

    describe("UTS MasterRouter", function () {
        describe("Deploy", function () {
            it("Init settings", async function () {
                const { router, masterRouter, feeCollector } = await loadFixture(globalFixture);

                expect(await masterRouter.dstMasterRouter(dstChainId)).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(await masterRouter.PAYLOAD_SIZE_LIMIT()).to.equal(2048n);
                expect(await masterRouter.feeCollector()).to.equal(feeCollector);
                expect(await masterRouter.validateRouter(router.target)).to.equal(true);
            });

            it("UTS MasterRouter E3", async function () {
                const { admin, masterRouter } = await loadFixture(globalFixture);

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

                await masterRouter.connect(admin).setDstMasterRouter([newChainId, curChainId], [newAddress, newAddress]);

                expect(await masterRouter.dstMasterRouter(newChainId)).to.equal(newAddress);
                expect(await masterRouter.dstMasterRouter(curChainId)).to.equal(newAddress);
            });
        });

        describe("AccessControl", function () {
            it("sendProposal", async function () {
                const { user, masterRouter } = await loadFixture(globalFixture);

                await expect(masterRouter.connect(user).sendProposal(
                    0,
                    1,
                    "0x"
                )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");
            });

            it("setFeeCollector", async function () {
                const { admin, user, masterRouter } = await loadFixture(globalFixture);

                await expect(masterRouter.connect(user).setFeeCollector(
                    user
                )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

                await masterRouter.connect(admin).setFeeCollector(user);

                expect(await masterRouter.feeCollector()).to.equal(user);
            });

            it("setDstMasterRouter", async function () {
                const { admin, user, masterRouter } = await loadFixture(globalFixture);

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
                const { admin, masterRouter, pauserRole } = await loadFixture(globalFixture);

                await expect(masterRouter.connect(admin).pause(
                )).to.be.revertedWithCustomError(masterRouter, "AccessControlUnauthorizedAccount");

                await masterRouter.connect(admin).grantRole(pauserRole, admin);

                await masterRouter.connect(admin).pause();

                expect(await masterRouter.paused()).to.equal(true);
            });

            it("unpause", async function () {
                const { admin, user, masterRouter, pauserRole } = await loadFixture(globalFixture);

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
                const { admin, routerRole, zeroHash, endpoint, masterRouter, pauserRole } = await loadFixture(globalFixture);

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

                await masterRouter.connect(admin).sendProposal(0, dstChainId, "0x");

                expect(await endpoint.lastProposal() != zeroHash).to.equal(true);
            });

            it("executeProposal", async function () {
                const { adminRole, zeroAddress, registry, factory, router, user, executor, admin, zeroHash, endpoint, masterRouter, pauserRole, protocolId, functionSelector } = await loadFixture(globalFixture);

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
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);

                await masterRouter.connect(admin).unpause();

                expect(await masterRouter.paused()).to.equal(false);
            });
        });

        describe("sendProposal", function () {
            it("Base test", async function () {
                const { admin, routerRole, endpoint, masterRouter, functionSelector, protocolId } = await loadFixture(globalFixture);

                const chainId = 999;
                const params = "0xf4a89e12bd90116bc12f";

                await masterRouter.connect(admin).grantRole(routerRole, admin);
                await masterRouter.connect(admin).setDstMasterRouter([chainId], [ethers.zeroPadValue(masterRouter.target, 32)]);
                await masterRouter.connect(admin).sendProposal(0, chainId, params);

                const hash = await endpoint.getHash(protocolId, chainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastProposal()).to.equal(hash);
            });

            it("Base non-evm test", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const { mockRouter, masterRouter, admin, router } = await loadFixture(globalFixture);

                await mockRouter.setProtocolVersion(globalProtocolVersion);

                const largePayload = ethers.randomBytes(2049);

                await expect(mockRouter.connect(admin).bridge(
                    router.target,
                    ethers.zeroPadValue(router.target, 32),
                    ethers.zeroPadValue(router.target, 32),
                    1,
                    12,
                    dstChainId,
                    1000000,
                    largePayload,
                    "0x",
                    { value: withDecimals("1") }
                )).to.be.revertedWithCustomError(masterRouter, "UTSMasterRouter__E1");
            });

            it("UTS MasterRouter E2", async function () {
                const { mockRouter, masterRouter, admin, router, routerRole } = await loadFixture(globalFixture);

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
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Record case", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Failure case", async function () {
                const { admin, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const UTSTokenMock = await ethers.getContractFactory("UTSTokenMock", admin);
                const mock = await UTSTokenMock.deploy(router.target);
                await mock.waitForDeployment();

                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("UTS MasterRouter E0", async function () {
                const { admin, masterRouter } = await loadFixture(globalFixture);

                await expect(masterRouter.connect(admin).executeProposal(
                    "0x"
                )).to.be.revertedWithCustomError(masterRouter, "UTSMasterRouter__E0");
            });

            it("Unauthorized router", async function () {
                const { functionSelector, endpoint, routerRole, adminRole, zeroAddress, router, factory, executor, registry, user, admin, zeroHash, masterRouter, protocolId } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Invalid dstPeer", async function () {
                const { functionSelector, endpoint, zeroAddress, registry, user, zeroHash, masterRouter, protocolId } = await loadFixture(globalFixture);

                const initialSupply = withDecimals("1");
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Invalid router address", async function () {
                const { zeroAddress, functionSelector, endpoint, user, zeroHash, masterRouter, protocolId } = await loadFixture(globalFixture);

                const initialSupply = withDecimals("1");
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });
        });
    });

    describe("UTS PriceFeed", function () {
        describe("AccessControl", function () {
            it("setPrices", async function () {
                const { user, priceFeed } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(user).setPrices(
                    [],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
            });

            it("setDstPricePerByteInWei", async function () {
                const { user, priceFeed } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(user).setDstPricePerByteInWei(
                    [],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
            });

            it("setChainInfo", async function () {
                const { user, priceFeed } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(user).setChainInfo(
                    [1],
                    [1]
                )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
            });
        });

        describe("Pausable", function () {
            it("pause", async function () {
                const { priceFeed, admin, pauserRole, providerRole } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(admin).pause(
                )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");

                await priceFeed.connect(admin).grantRole(pauserRole, admin);
                await priceFeed.connect(admin).grantRole(providerRole, admin);
                await priceFeed.connect(admin).pause();

                expect(await priceFeed.paused()).to.equal(true);

                await expect(priceFeed.connect(admin).setPrices(
                    [],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "EnforcedPause");

                await expect(priceFeed.connect(admin).setDstPricePerByteInWei(
                    [],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "EnforcedPause");
            });

            it("unpause", async function () {
                const { user, priceFeed, admin, pauserRole, providerRole } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(admin).pause(
                )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");

                await priceFeed.connect(admin).grantRole(pauserRole, admin);
                await priceFeed.connect(admin).grantRole(providerRole, admin);
                await priceFeed.connect(admin).pause();

                expect(await priceFeed.paused()).to.equal(true);

                await expect(priceFeed.connect(admin).setPrices(
                    [],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "EnforcedPause");

                await expect(priceFeed.connect(admin).setDstPricePerByteInWei(
                    [],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "EnforcedPause");

                await expect(priceFeed.connect(user).unpause(
                )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");

                await priceFeed.connect(admin).unpause();

                expect(await priceFeed.paused()).to.equal(false);

                await priceFeed.connect(admin).setPrices(
                    [],
                    []
                );

                await priceFeed.connect(admin).setDstPricePerByteInWei(
                    [],
                    []
                );
            });
        });

        describe("UTS PriceFeed E0", function () {
            it("setPrices", async function () {
                const { admin, priceFeed } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(admin).setPrices(
                    [1],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "UTSPriceFeed__E0");

                await expect(priceFeed.connect(admin).setPrices(
                    [1],
                    []
                )).to.be.revertedWithCustomError(priceFeed, "UTSPriceFeed__E0");
            });

            it("setDstPricePerByteInWei", async function () {
                const { admin, priceFeed } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(admin).setDstPricePerByteInWei(
                    [],
                    [1]
                )).to.be.revertedWithCustomError(priceFeed, "UTSPriceFeed__E0");

                await expect(priceFeed.connect(admin).setDstPricePerByteInWei(
                    [],
                    [1]
                )).to.be.revertedWithCustomError(priceFeed, "UTSPriceFeed__E0");
            });

            it("setChainInfo", async function () {
                const { admin, priceFeed } = await loadFixture(globalFixture);

                await expect(priceFeed.connect(admin).setChainInfo(
                    [],
                    [1]
                )).to.be.revertedWithCustomError(priceFeed, "UTSPriceFeed__E0");

                await expect(priceFeed.connect(admin).setChainInfo(
                    [],
                    [1]
                )).to.be.revertedWithCustomError(priceFeed, "UTSPriceFeed__E0");

                await priceFeed.connect(admin).setChainInfo(
                    [1, 2, 3],
                    [4, 5, 6]
                );

                expect(await priceFeed.getRawChainInfo(1)).to.equal(4);
                expect(await priceFeed.getRawChainInfo(2)).to.equal(5);
                expect(await priceFeed.getRawChainInfo(3)).to.equal(6);
            });
        });

        describe("Prices", function () {
            it("Init", async function () {
                const { priceFeed, prices, groupId } = await loadFixture(globalFixture);

                expect(await priceFeed.getDstGasPriceAtSrcNative(0)).to.equal(0);
                expect(await priceFeed.getDstGasPriceAtSrcNative(1)).to.equal(1000000000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(2)).to.equal(0);
                expect(await priceFeed.getDstGasPriceAtSrcNative(10)).to.equal(500000000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(56)).to.equal(34567800000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(100)).to.equal(180000000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(dstChainId)).to.equal(5000000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(5000)).to.equal(465461230000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(8453)).to.equal(12343546);
                expect(await priceFeed.getDstGasPriceAtSrcNative(42161)).to.equal(33123453656757);
                expect(await priceFeed.getDstGasPriceAtSrcNative(43114)).to.equal(213445465);
                expect(await priceFeed.getDstGasPriceAtSrcNative(59144)).to.equal(89790789);
                expect(await priceFeed.getDstGasPriceAtSrcNative(81457)).to.equal(21345465789);
                expect(await priceFeed.getDstGasPriceAtSrcNative(534352)).to.equal(313435446799);
                expect(await priceFeed.getDstGasPriceAtSrcNative(33033)).to.equal(17343546);
                expect(await priceFeed.getDstGasPriceAtSrcNative(559999)).to.equal(123453656757);
                expect(await priceFeed.getDstGasPriceAtSrcNative(569999)).to.equal(213445465);
                expect(await priceFeed.getDstGasPriceAtSrcNative(570000)).to.equal(0);
                expect(await priceFeed.getDstGasPriceAtSrcNative(570001)).to.equal(9879879879789);

                expect(await priceFeed.getPriceByOffset(1, 0)).to.equal(1000000000000);
                expect(await priceFeed.getPriceByOffset(1, 1)).to.equal(500000000000);
                expect(await priceFeed.getPriceByOffset(1, 2)).to.equal(34567800000);
                expect(await priceFeed.getPriceByOffset(1, 3)).to.equal(180000000000);
                expect(await priceFeed.getPriceByOffset(2, 0)).to.equal(5000000000);
                expect(await priceFeed.getPriceByOffset(2, 1)).to.equal(465461230000000);
                expect(await priceFeed.getPriceByOffset(2, 2)).to.equal(12343546);
                expect(await priceFeed.getPriceByOffset(2, 3)).to.equal(33123453656757);
                expect(await priceFeed.getPriceByOffset(3, 0)).to.equal(213445465);
                expect(await priceFeed.getPriceByOffset(3, 1)).to.equal(89790789);
                expect(await priceFeed.getPriceByOffset(3, 2)).to.equal(21345465789);
                expect(await priceFeed.getPriceByOffset(3, 3)).to.equal(313435446799);
                expect(await priceFeed.getPriceByOffset(4, 0)).to.equal(17343546);
                expect(await priceFeed.getPriceByOffset(4, 1)).to.equal(123453656757);
                expect(await priceFeed.getPriceByOffset(4, 2)).to.equal(213445465);
                expect(await priceFeed.getPriceByOffset(4, 3)).to.equal(9879879879789);

                expect(await priceFeed.getRawPrices(groupId[0])).to.equal(prices[0]);
                expect(await priceFeed.getRawPrices(groupId[1])).to.equal(prices[1]);
                expect(await priceFeed.getRawPrices(groupId[2])).to.equal(prices[2]);
                expect(await priceFeed.getRawPrices(groupId[3])).to.equal(prices[3]);

                expect(await priceFeed.getRawChainInfo(1)).to.equal(4722366482869645213696n);
                expect(await priceFeed.getRawChainInfo(10)).to.equal(4740813226943354765312n);
                expect(await priceFeed.getRawChainInfo(56)).to.equal(4759259971017064316928n);
                expect(await priceFeed.getRawChainInfo(100)).to.equal(4777706715090773868544n);
                expect(await priceFeed.getRawChainInfo(dstChainId)).to.equal(9444732965739290427392n);
                expect(await priceFeed.getRawChainInfo(5000)).to.equal(9463179709812999979008n);
                expect(await priceFeed.getRawChainInfo(8453)).to.equal(9481626453886709530624n);
                expect(await priceFeed.getRawChainInfo(42161)).to.equal(9500073197960419082240n);
                expect(await priceFeed.getRawChainInfo(43114)).to.equal(14167099448608935641088n);
                expect(await priceFeed.getRawChainInfo(59144)).to.equal(14185546192682645192704n);
                expect(await priceFeed.getRawChainInfo(81457)).to.equal(14203992936756354744320n);
                expect(await priceFeed.getRawChainInfo(534352)).to.equal(14222439680830064295936n);
                expect(await priceFeed.getRawChainInfo(33033)).to.equal(18889465931478580854784n);
                expect(await priceFeed.getRawChainInfo(559999)).to.equal(18907912675552290406400n);
                expect(await priceFeed.getRawChainInfo(569999)).to.equal(18926359419625999958016n);
                expect(await priceFeed.getRawChainInfo(570000)).to.equal(0);
                expect(await priceFeed.getRawChainInfo(570001)).to.equal(18944806163699709509632n);

                expect(await priceFeed.getChainInfo(0)).to.eql([0n, 0n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(1)).to.eql([0n, 1n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(10)).to.eql([0n, 1n, 1n, 0n]);
                expect(await priceFeed.getChainInfo(56)).to.eql([0n, 1n, 2n, 0n]);
                expect(await priceFeed.getChainInfo(100)).to.eql([0n, 1n, 3n, 0n]);
                expect(await priceFeed.getChainInfo(dstChainId)).to.eql([0n, 2n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(5000)).to.eql([0n, 2n, 1n, 0n]);
                expect(await priceFeed.getChainInfo(8453)).to.eql([0n, 2n, 2n, 0n]);
                expect(await priceFeed.getChainInfo(42161)).to.eql([0n, 2n, 3n, 0n]);
                expect(await priceFeed.getChainInfo(43114)).to.eql([0n, 3n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(59144)).to.eql([0n, 3n, 1n, 0n]);
                expect(await priceFeed.getChainInfo(81457)).to.eql([0n, 3n, 2n, 0n]);
                expect(await priceFeed.getChainInfo(534352)).to.eql([0n, 3n, 3n, 0n]);
                expect(await priceFeed.getChainInfo(33033)).to.eql([0n, 4n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(559999)).to.eql([0n, 4n, 1n, 0n]);
                expect(await priceFeed.getChainInfo(569999)).to.eql([0n, 4n, 2n, 0n]);
                expect(await priceFeed.getChainInfo(570000)).to.eql([0n, 0n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(570001)).to.eql([0n, 4n, 3n, 0n]);

                expect(await priceFeed.getGroupPrices(0)).to.eql([0n, 0n, 0n, 0n]);
                expect(await priceFeed.getGroupPrices(groupId[0])).to.eql([1000000000000n, 500000000000n, 34567800000n, 180000000000n]);
                expect(await priceFeed.getGroupPrices(groupId[1])).to.eql([5000000000n, 465461230000000n, 12343546n, 33123453656757n]);
                expect(await priceFeed.getGroupPrices(groupId[2])).to.eql([213445465n, 89790789n, 21345465789n, 313435446799n]);
                expect(await priceFeed.getGroupPrices(groupId[3])).to.eql([17343546n, 123453656757n, 213445465n, 9879879879789n]);
                expect(await priceFeed.getGroupPrices(5)).to.eql([0n, 0n, 0n, 0n]);
            });

            it("setDstPricePerByteInWei", async function () {
                const { priceFeed, admin } = await loadFixture(globalFixture);

                const chainIds = [1, 10, 56, 100, dstChainId, 5000, 8453, 42161, 59144, 569999];
                const pricesPerByte = [199n, 299n, 399n, 499n, 599n, 0n, 699n, 799n, 899n, 999n];

                await priceFeed.connect(admin).setDstPricePerByteInWei(chainIds, pricesPerByte);

                expect(await priceFeed.getDstPricePerByteInWei(0)).to.equal(0);
                expect(await priceFeed.getDstPricePerByteInWei(1)).to.equal(pricesPerByte[0]);
                expect(await priceFeed.getDstPricePerByteInWei(10)).to.equal(pricesPerByte[1]);
                expect(await priceFeed.getDstPricePerByteInWei(56)).to.equal(pricesPerByte[2]);
                expect(await priceFeed.getDstPricePerByteInWei(100)).to.equal(pricesPerByte[3]);
                expect(await priceFeed.getDstPricePerByteInWei(dstChainId)).to.equal(pricesPerByte[4]);
                expect(await priceFeed.getDstPricePerByteInWei(5000)).to.equal(pricesPerByte[5]);
                expect(await priceFeed.getDstPricePerByteInWei(8453)).to.equal(pricesPerByte[6]);
                expect(await priceFeed.getDstPricePerByteInWei(42161)).to.equal(pricesPerByte[7]);
                expect(await priceFeed.getDstPricePerByteInWei(43114)).to.equal(0);
                expect(await priceFeed.getDstPricePerByteInWei(59144)).to.equal(pricesPerByte[8]);
                expect(await priceFeed.getDstPricePerByteInWei(81457)).to.equal(0);
                expect(await priceFeed.getDstPricePerByteInWei(534352)).to.equal(0);
                expect(await priceFeed.getDstPricePerByteInWei(33033)).to.equal(0);
                expect(await priceFeed.getDstPricePerByteInWei(559999)).to.equal(0);
                expect(await priceFeed.getDstPricePerByteInWei(569999)).to.equal(pricesPerByte[9]);
                expect(await priceFeed.getDstPricePerByteInWei(570000)).to.equal(0);

                expect(await priceFeed.getChainInfo(0)).to.eql([0n, 0n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(1)).to.eql([0n, 1n, 0n, pricesPerByte[0]]);
                expect(await priceFeed.getChainInfo(10)).to.eql([0n, 1n, 1n, pricesPerByte[1]]);
                expect(await priceFeed.getChainInfo(56)).to.eql([0n, 1n, 2n, pricesPerByte[2]]);
                expect(await priceFeed.getChainInfo(100)).to.eql([0n, 1n, 3n, pricesPerByte[3]]);
                expect(await priceFeed.getChainInfo(dstChainId)).to.eql([0n, 2n, 0n, pricesPerByte[4]]);
                expect(await priceFeed.getChainInfo(5000)).to.eql([0n, 2n, 1n, pricesPerByte[5]]);
                expect(await priceFeed.getChainInfo(8453)).to.eql([0n, 2n, 2n, pricesPerByte[6]]);
                expect(await priceFeed.getChainInfo(42161)).to.eql([0n, 2n, 3n, pricesPerByte[7]]);
                expect(await priceFeed.getChainInfo(43114)).to.eql([0n, 3n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(59144)).to.eql([0n, 3n, 1n, pricesPerByte[8]]);
                expect(await priceFeed.getChainInfo(81457)).to.eql([0n, 3n, 2n, 0n]);
                expect(await priceFeed.getChainInfo(534352)).to.eql([0n, 3n, 3n, 0n]);
                expect(await priceFeed.getChainInfo(33033)).to.eql([0n, 4n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(559999)).to.eql([0n, 4n, 1n, 0n]);
                expect(await priceFeed.getChainInfo(569999)).to.eql([0n, 4n, 2n, pricesPerByte[9]]);
                expect(await priceFeed.getChainInfo(570000)).to.eql([0n, 0n, 0n, 0n]);
                expect(await priceFeed.getChainInfo(570001)).to.eql([0n, 4n, 3n, 0n]);

                expect(await priceFeed.getPrices(0)).to.eql([0n, 0n]);
                expect(await priceFeed.getPrices(1)).to.eql([1000000000000n, pricesPerByte[0]]);
                expect(await priceFeed.getPrices(10)).to.eql([500000000000n, pricesPerByte[1]]);
                expect(await priceFeed.getPrices(56)).to.eql([34567800000n, pricesPerByte[2]]);
                expect(await priceFeed.getPrices(100)).to.eql([180000000000n, pricesPerByte[3]]);
                expect(await priceFeed.getPrices(dstChainId)).to.eql([5000000000n, pricesPerByte[4]]);
                expect(await priceFeed.getPrices(5000)).to.eql([465461230000000n, pricesPerByte[5]]);
                expect(await priceFeed.getPrices(8453)).to.eql([12343546n, pricesPerByte[6]]);
                expect(await priceFeed.getPrices(42161)).to.eql([33123453656757n, pricesPerByte[7]]);
                expect(await priceFeed.getPrices(43114)).to.eql([213445465n, 0n]);
                expect(await priceFeed.getPrices(59144)).to.eql([89790789n, pricesPerByte[8]]);
                expect(await priceFeed.getPrices(81457)).to.eql([21345465789n, 0n]);
                expect(await priceFeed.getPrices(534352)).to.eql([313435446799n, 0n]);
                expect(await priceFeed.getPrices(33033)).to.eql([17343546n, 0n]);
                expect(await priceFeed.getPrices(559999)).to.eql([123453656757n, 0n]);
                expect(await priceFeed.getPrices(569999)).to.eql([213445465n, pricesPerByte[9]]);
                expect(await priceFeed.getPrices(570000)).to.eql([0n, 0n]);
                expect(await priceFeed.getPrices(570001)).to.eql([9879879879789n, 0n]);
            });

            it("setPrices", async function () {
                const { router, priceFeed, admin } = await loadFixture(globalFixture);

                const groupId = [1n, 3n]
                const prices = [
                    207919288430829661534269173292308851077110717309661052642059096598901248n,
                    62017011138835482832437730536824915658235399606085787397919460150518842n
                ];

                await priceFeed.connect(admin).setPrices(groupId, prices);

                expect(await priceFeed.getDstGasPriceAtSrcNative(0)).to.equal(0);
                expect(await priceFeed.getDstGasPriceAtSrcNative(1)).to.equal(5000000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(2)).to.equal(0);
                expect(await priceFeed.getDstGasPriceAtSrcNative(10)).to.equal(465461230000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(56)).to.equal(12343546);
                expect(await priceFeed.getDstGasPriceAtSrcNative(100)).to.equal(33123453656757);
                expect(await priceFeed.getDstGasPriceAtSrcNative(dstChainId)).to.equal(5000000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(5000)).to.equal(465461230000000);
                expect(await priceFeed.getDstGasPriceAtSrcNative(8453)).to.equal(12343546);
                expect(await priceFeed.getDstGasPriceAtSrcNative(42161)).to.equal(33123453656757);
                expect(await priceFeed.getDstGasPriceAtSrcNative(43114)).to.equal(17343546);
                expect(await priceFeed.getDstGasPriceAtSrcNative(59144)).to.equal(123453656757);
                expect(await priceFeed.getDstGasPriceAtSrcNative(81457)).to.equal(213445465);
                expect(await priceFeed.getDstGasPriceAtSrcNative(534352)).to.equal(9879879879789);
                expect(await priceFeed.getDstGasPriceAtSrcNative(33033)).to.equal(17343546);
                expect(await priceFeed.getDstGasPriceAtSrcNative(559999)).to.equal(123453656757);
                expect(await priceFeed.getDstGasPriceAtSrcNative(569999)).to.equal(213445465);
                expect(await priceFeed.getDstGasPriceAtSrcNative(570000)).to.equal(0);
                expect(await priceFeed.getDstGasPriceAtSrcNative(570001)).to.equal(9879879879789);

                expect(await priceFeed.getRawPrices(groupId[0])).to.equal(prices[0]);
                expect(await priceFeed.getRawPrices(groupId[1])).to.equal(prices[1]);

                await validateBridgeFee(router, priceFeed, 534352n, 123456n, 123n);
            });

            it("setChainInfo", async function () {
                const { router, priceFeed, admin } = await loadFixture(globalFixture);

                const newChainId = 570000n;
                const newGroupId = 5n;
                const newOffset = 1n;
                const newDstPricePerByte = 78999n;
                const rawChainInfo = 23630279158421935699095n;

                await priceFeed.connect(admin).setChainInfo([newChainId], [rawChainInfo]);

                expect(await priceFeed.getDstGasPriceAtSrcNative(newChainId)).to.equal(0n);
                expect(await priceFeed.getPriceByOffset(newGroupId, newOffset)).to.equal(0n);
                expect(await priceFeed.getRawPrices(newGroupId)).to.equal(0);
                expect(await priceFeed.getRawChainInfo(newChainId)).to.equal(rawChainInfo);
                expect(await priceFeed.getDstPricePerByteInWei(newChainId)).to.equal(newDstPricePerByte);
                expect(await priceFeed.getChainInfo(newChainId)).to.eql([0n, newGroupId, newOffset, newDstPricePerByte]);
                expect(await priceFeed.getPrices(newChainId)).to.eql([0n, newDstPricePerByte]);

                await validateBridgeFee(router, priceFeed, newChainId, 123456n, 123n);

                const newDstGasPrice = 949385469654n;
                const newRawPrices = 17513070786005883854941914660864n;

                const groupId = [newGroupId]
                const prices = [newRawPrices];

                await priceFeed.connect(admin).setPrices(groupId, prices);

                expect(await priceFeed.getDstGasPriceAtSrcNative(newChainId)).to.equal(newDstGasPrice);
                expect(await priceFeed.getPriceByOffset(newGroupId, newOffset)).to.equal(newDstGasPrice);
                expect(await priceFeed.getRawPrices(newGroupId)).to.equal(newRawPrices);
                expect(await priceFeed.getRawChainInfo(newChainId)).to.equal(rawChainInfo);
                expect(await priceFeed.getDstPricePerByteInWei(newChainId)).to.equal(newDstPricePerByte);
                expect(await priceFeed.getChainInfo(newChainId)).to.eql([0n, newGroupId, newOffset, newDstPricePerByte]);
                expect(await priceFeed.getPrices(newChainId)).to.eql([newDstGasPrice, newDstPricePerByte]);
            });
        });
    });

    describe("UTS Router", function () {
        describe("Deploy", function () {
            it("Init settings", async function () {
                const { router, masterRouter, minGasLimit } = await loadFixture(globalFixture);

                expect(await router.dstProtocolFee(0)).to.equal(0);
                expect(await router.dstProtocolFee(dstChainId)).to.equal(0);
                expect(await router.dstProtocolFee(curChainId)).to.equal(0);
                expect(await router.dstMinGasLimit(0)).to.equal(0);
                expect(await router.dstMinGasLimit(dstChainId)).to.equal(minGasLimit);
                expect(await router.dstMinGasLimit(curChainId)).to.equal(0);
                expect(await router.MASTER_ROUTER()).to.equal(masterRouter.target);
                expect(await router.protocolVersion()).to.equal(globalProtocolVersion);
            });
        });

        describe("AccessControl", function () {
            it("setDstMinGasLimit", async function () {
                const { admin, user, router, managerRole } = await loadFixture(globalFixture);

                await expect(router.connect(user).setDstMinGasLimit(
                    [1],
                    [1]
                )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

                await router.connect(admin).grantRole(managerRole, user);

                await router.connect(user).setDstMinGasLimit([1], [1]);

                expect(await router.dstMinGasLimit(1)).to.equal(1);
            });

            it("setDstProtocolFee", async function () {
                const { admin, user, router } = await loadFixture(globalFixture);

                await expect(router.connect(user).setDstProtocolFee(
                    [1], [1]
                )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

                await router.connect(admin).setDstProtocolFee([1], [1]);

                expect(await router.dstProtocolFee(1)).to.equal(1);
            });

            it("setDstUpdateGas", async function () {
                const { admin, user, router, managerRole } = await loadFixture(globalFixture);

                await expect(router.connect(user).setDstUpdateGas(
                    [1], [1]
                )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

                await router.connect(admin).grantRole(managerRole, user);

                await router.connect(admin).setDstUpdateGas([1], [1]);

                expect(await router.dstUpdateGas(1)).to.equal(1);
            });

            it("pause", async function () {
                const { admin, pauserRole, router } = await loadFixture(globalFixture);

                await expect(router.connect(admin).pause(
                )).to.be.revertedWithCustomError(router, "AccessControlUnauthorizedAccount");

                await router.connect(admin).grantRole(pauserRole, admin);
                await router.connect(admin).pause();

                expect(await router.paused()).to.equal(true);
            });

            it("unpause", async function () {
                const { admin, user, router, pauserRole } = await loadFixture(globalFixture);

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
                const { admin, router, pauserRole } = await loadFixture(globalFixture);

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
                const { admin, router, pauserRole } = await loadFixture(globalFixture);

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
                const { masterRouter, adminRole, zeroAddress, registry, executor, user, admin, factory, router, endpoint, protocolId, zeroHash, functionSelector, pauserRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);
            });
        });

        describe("getBridgeFee", function () {
            it("Math test", async function () {
                const { router, priceFeed, admin, providerRole } = await loadFixture(globalFixture);

                let chainId = dstChainId;
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

                await router.connect(admin).setDstProtocolFee([chainId, dstChainId], [3333, 105]);
                expect(await router.dstProtocolFee(chainId)).to.equal(3333);
                expect(await router.dstProtocolFee(dstChainId)).to.equal(105);

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
                const { router, priceFeed, admin, managerRole } = await loadFixture(globalFixture);

                const gasPrice = await priceFeed.getDstGasPriceAtSrcNative(dstChainId);
                const gasPriceTwo = await priceFeed.getDstGasPriceAtSrcNative(56);

                await router.connect(admin).grantRole(managerRole, admin);

                await router.connect(admin).setDstUpdateGas([dstChainId, 56], [13333, 77777]);

                let estimatedPayment = await router.getUpdateFee([dstChainId], [0]);

                expect(estimatedPayment).to.equal(gasPrice * 13333n * 4n);

                estimatedPayment = await router.getUpdateFee([dstChainId, 56], [13, 7]);

                expect(estimatedPayment).to.equal((gasPrice * 13333n * (4n + 13n)) + (gasPriceTwo * 77777n * (4n + 7n)));
            });
        });

        describe("Payment", function () {
            it("Invalid receiver", async function () {
                const { masterRouter, admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, justToken } = await loadFixture(globalFixture);

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
                const allowedChainIds = [dstChainId];
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
                const { masterRouter, admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, justToken, feeCollector } = await loadFixture(globalFixture);

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
                const allowedChainIds = [dstChainId];
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
                const { admin, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const UTSTokenMockTwo = await ethers.getContractFactory("UTSTokenMockTwo", admin);
                const mock = await UTSTokenMockTwo.deploy(router.target);
                await mock.waitForDeployment();

                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);

                filter = mock.filters.ExecutionFailed;
                events = await mock.queryFilter(filter, -1);
                args = events[0].args;

                expect(args[0]).to.equal(user.address);
                expect(args[1]).to.equal(amountToRedeem);
                expect(args[2]).to.equal(customPayload);
            });

            it("Infinite storeFailedExecution return data", async function () {
                const { admin, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const UTSTokenMock = await ethers.getContractFactory("UTSTokenMock", admin);
                const mock = await UTSTokenMock.deploy(router.target);
                await mock.waitForDeployment();

                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by invalid protocol version", async function () {
                const { adminRole, zeroAddress, registry, factory, executor, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    dstChainId,
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });
        });

        describe("Errors", function () {
            it("Execute srcToken eq zero address", async function () {
                const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("UTS Router E0 bridge", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("10000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const { admin, masterRouter, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("10000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    [dstChainId, 138],
                    [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
                );

                await router.connect(admin).setDstUpdateGas(
                    [dstChainId, 138],
                    [123456, 78900]
                );

                const paymentAmount = await router.getUpdateFee([dstChainId, 138], [10, 1]);
                const paymentAmountBase = await deployedToken.estimateUpdateFee([dstChainId, 138], [10, 1]);

                expect(paymentAmount).to.equal(paymentAmountBase);

                const config = ["0xf4c3efb93eec00", 123n, 243n, true];
                const updateConfigTen = [
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                    [config, config, config, config, config, config, config, config, config, config]
                ];

                await deployedToken.connect(user).setChainConfig(
                    [dstChainId, 138],
                    [config, config]
                );

                await expect(deployedToken.connect(user).setChainConfigToDestination(
                    [dstChainId, 138],
                    [updateConfigTen, [[1n], [config]]],
                    { value: paymentAmount - 1n }
                )).to.be.revertedWithCustomError(router, "UTSRouter__E0");
            });

            it("UTS Router E1 bridge", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("10000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
                    configMinGasLimit,
                    "0x",
                    "0x"
                )).to.be.revertedWithCustomError(router, "UTSRouter__E1");
            });

            it("UTS Router E1 redeem", async function () {
                const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);
            });

            it("UTS Router E2", async function () {
                const { mockRouter, admin, router } = await loadFixture(globalFixture);

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
                const { admin, router } = await loadFixture(globalFixture);

                await expect(router.connect(admin).execute(
                    admin,
                    "0xff",
                    "0x"
                )).to.be.revertedWithCustomError(router, "UTSRouter__E3");
            });

            it("UTS Router E4", async function () {
                const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);
            });

            it("UTS Router E5 bridge", async function () {
                const { adminRole, zeroAddress, registry, factory, user, executor, router, zeroHash } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("10000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);
            });

            it("UTS Router E5 redeem zero address", async function () {
                const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);
            });

            it("UTS Router E6", async function () {
                const { mockRouter, admin, router, managerRole } = await loadFixture(globalFixture);

                const gasLimit = 1000n;
                const lDstChainId = 31336n;
                await mockRouter.setProtocolVersion(globalProtocolVersion);
                await router.connect(admin).grantRole(managerRole, admin);
                await router.connect(admin).setDstMinGasLimit([lDstChainId], [gasLimit]);

                expect(await router.dstMinGasLimit(lDstChainId)).to.equal(gasLimit);

                await expect(mockRouter.connect(admin).bridge(
                    router.target,
                    ethers.zeroPadValue(mockRouter.target, 32),
                    ethers.zeroPadValue(mockRouter.target, 32),
                    1,
                    12,
                    lDstChainId,
                    gasLimit - 1n,
                    "0x",
                    "0x"
                )).to.be.revertedWithCustomError(router, "UTSRouter__E6");
            });

            it("UTS Router E7", async function () {
                const { mockRouter, admin, router } = await loadFixture(globalFixture);

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

    describe("UTS Factory", function () {
        it("Init settings", async function () {
            const { factory, codeStorage, codeStoragePure, codeStorageMintable, codeStorageTokenWithFee, codeStorageMintableWithFee, dRouter, registry, masterRouter, codeStorageConnectorWithFee } = await loadFixture(globalFixture);

            expect(await factory.codeStorage(0)).to.equal(codeStorage.target);
            expect(await factory.codeStorage(1)).to.equal(codeStorageMintable.target);
            expect(await factory.codeStorage(2)).to.equal(codeStorageTokenWithFee.target);
            expect(await factory.codeStorage(3)).to.equal(codeStorageMintableWithFee.target);
            expect(await factory.codeStorage(4)).to.equal(codeStoragePure.target);
            expect(await factory.codeStorage(5)).to.equal(codeStorageConnectorWithFee.target);
            expect(await factory.router()).to.equal(dRouter.target);
            expect(await factory.REGISTRY()).to.equal(registry.target);
            expect(await factory.MASTER_ROUTER()).to.equal(masterRouter.target);
            expect(await factory.protocolVersion()).to.equal(globalProtocolVersion);
        });

        describe("AccessControl", function () {
            it("setRouter", async function () {
                const { user, admin, factory } = await loadFixture(globalFixture);

                await expect(factory.connect(user).setRouter(
                    admin
                )).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");

                await factory.connect(admin).setRouter(admin);

                expect(await factory.router()).to.equal(admin);
            });

            it("setCodeStorage", async function () {
                const { user, admin, factory } = await loadFixture(globalFixture);

                await expect(factory.connect(user).setCodeStorage(
                    [1],
                    [admin]
                )).to.be.revertedWithCustomError(factory, "AccessControlUnauthorizedAccount");

                await factory.connect(admin).setCodeStorage([1], [admin]);

                expect(await factory.codeStorage(1)).to.equal(admin);
            });
        });

        describe("Deploy", function () {
            it("Token init settings", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, routerRole, mockRouter, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
                const userBalanceBefore = await deployedToken.balanceOf(user);
                const totalSupplyBefore = await deployedToken.totalSupply();

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

                await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());

                await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
                await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
                await deployedToken.connect(user).setRouter(mockRouter.target);

                const filter = registry.filters.RouterUpdated;
                const events = await registry.queryFilter(filter, -1);
                const args = events[0].args;

                expect(await args[0]).to.equal(deployedToken.target);
                expect(await args[1]).to.equal(mockRouter.target);

                expect(await deployedToken.router()).to.equal(mockRouter.target);
            });

            it("Token init settings zero initialSupply", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, routerRole, mockRouter, masterRouter, endpoint, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = 0;
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = true;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                expect(await deployedToken.balanceOf(user)).to.equal(0);
                expect(await deployedToken.totalSupply()).to.equal(0);

                const amountToRedeem = withDecimals("1500");
                const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
                const userBalanceBefore = await deployedToken.balanceOf(user);
                const totalSupplyBefore = await deployedToken.totalSupply();

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

                await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());

                await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
                await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
                await deployedToken.connect(user).setRouter(mockRouter.target);

                expect(await deployedToken.router()).to.equal(mockRouter.target);
            });

            it("Connector init settings", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, mockRouter, routerRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const feeModule = true;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const { deployedConnector } = await deployConnectorByFactory(
                    executor,
                    user,
                    justToken,
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

                const decimals = await justToken.decimals();
                const amountToRedeem = withDecimals("150");
                const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
                await justToken.connect(admin).transfer(deployedConnector.target, withDecimals("200"));

                const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
                const userBalanceBefore = await justToken.balanceOf(user);
                const totalSupplyBefore = await justToken.totalSupply();

                const params = await encodeParamsToRedeem(
                    user,
                    deployedConnector,
                    user,
                    amountToRedeem,
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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(connectorBalanceBefore - amountToReceive).to.equal(await justToken.balanceOf(deployedConnector.target));
                expect(userBalanceBefore + amountToReceive).to.equal(await justToken.balanceOf(user));
                expect(totalSupplyBefore).to.equal(await justToken.totalSupply());

                await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
                await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
                await deployedConnector.connect(user).setRouter(mockRouter.target);

                expect(await deployedConnector.router()).to.equal(mockRouter.target);
            });

            it("UTS Factory E0", async function () {
                const { user, factory } = await loadFixture(globalFixture);

                await expect(factory.connect(user).deployByRouter(
                    true,
                    user.address,
                    "0x"
                )).to.be.revertedWithCustomError(factory, "UTSFactory__E0");
            });
        });

        describe("Pausable", function () {
            it("deployToken", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, pauserRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                await factory.connect(admin).grantRole(pauserRole, admin);

                await factory.connect(admin).pause();

                await expect(deployTokenByFactory(
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
                )).to.be.revertedWithCustomError(factory, "EnforcedPause");

                await factory.connect(admin).unpause();

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
            });

            it("deployConnector", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, pauserRole } = await loadFixture(globalFixture);

                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                await factory.connect(admin).grantRole(pauserRole, admin);

                await factory.connect(admin).pause();

                await expect(deployConnectorByFactory(
                    executor,
                    user,
                    justToken,
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
                )).to.be.revertedWithCustomError(factory, "EnforcedPause");

                await factory.connect(admin).unpause();

                await deployConnectorByFactory(
                    executor,
                    user,
                    justToken,
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
            });
        });

        describe("UTS Factory E1", function () {
            it("Token", async function () {
                const { executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                await deployTokenByFactory(
                    executor,
                    executor,
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

                const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    initialSupply,
                    false,
                    mintable,
                    globalBurnable,
                    onlyRoleBurnable,
                    feeModule,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E1");
            });

            it("Connector", async function () {
                const { executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken } = await loadFixture(globalFixture);

                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                await deployConnectorByFactory(
                    executor,
                    executor,
                    justToken,
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

                const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

                await expect(factory.connect(executor).deployConnector([
                    executor.address,
                    justToken.target,
                    feeModule,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E1");
            });
        });

        describe("UTS Factory E2", function () {
            it("Token", async function () {
                const { executor, factory, router } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    initialSupply,
                    true,
                    true,
                    false,
                    false,
                    false,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E2");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    initialSupply,
                    true,
                    false,
                    true,
                    false,
                    false,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E2");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    initialSupply,
                    true,
                    false,
                    false,
                    true,
                    false,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E2");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    initialSupply,
                    true,
                    false,
                    false,
                    false,
                    true,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E2");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    initialSupply,
                    true,
                    true,
                    true,
                    true,
                    true,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E2");
            });
        });

        describe("UTS Factory E3", function () {
            it("setCodeStorage", async function () {
                const { user, admin, factory } = await loadFixture(globalFixture);

                await expect(factory.connect(admin).setCodeStorage(
                    [1],
                    [admin, user]
                )).to.be.revertedWithCustomError(factory, "UTSFactory__E3");

                await expect(factory.connect(admin).setCodeStorage(
                    [1, 2],
                    [admin]
                )).to.be.revertedWithCustomError(factory, "UTSFactory__E3");

                await expect(factory.connect(admin).setCodeStorage(
                    [1],
                    []
                )).to.be.revertedWithCustomError(factory, "UTSFactory__E3");

                await factory.connect(admin).setCodeStorage([1, 2, 3], [admin, user, factory.target]);

                expect(await factory.codeStorage(1)).to.equal(admin);
                expect(await factory.codeStorage(2)).to.equal(user);
                expect(await factory.codeStorage(3)).to.equal(factory.target);
            });
        });

        describe("UTS Factory E4", function () {
            it("Token", async function () {
                const { executor, factory, router } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    initialSupply + 1n,
                    true,
                    false,
                    false,
                    false,
                    false,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E4");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    0,
                    1n,
                    true,
                    false,
                    false,
                    false,
                    false,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E4");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply + 1n,
                    initialSupply,
                    false,
                    true,
                    true,
                    true,
                    true,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E4");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    initialSupply - 1n,
                    initialSupply,
                    false,
                    true,
                    true,
                    true,
                    true,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E4");

                expect(factory.connect(executor).deployToken([
                    executor.address,
                    name,
                    symbol,
                    decimals,
                    1n,
                    0,
                    false,
                    true,
                    false,
                    true,
                    false,
                    router.target,
                    allowedChainIds,
                    chainConfigs,
                    salt
                ])).to.be.revertedWithCustomError(factory, "UTSFactory__E4");
            });
        });
    });

    describe("UTS Base", function () {
        describe("UTS Base E2", function () {
            it("Token", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, routerRole, mockRouter, masterRouter } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
                await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
                await deployedToken.connect(user).setRouter(mockRouter.target);

                await expect(mockRouter.connect(user).redeem(
                    deployedToken.target,
                    zeroAddress,
                    1,
                    [user.address, allowedChainIds[0], configPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E2");
            });

            it("Connector", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, routerRole, mockRouter, masterRouter } = await loadFixture(globalFixture);

                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const { deployedConnector } = await deployConnectorByFactory(
                    executor,
                    user,
                    justToken,
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

                await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
                await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
                await deployedConnector.connect(user).setRouter(mockRouter.target);

                await expect(mockRouter.connect(user).redeem(
                    deployedConnector.target,
                    zeroAddress,
                    1,
                    [user.address, allowedChainIds[0], configPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E2");
            });
        });

        describe("UTS Base E3", function () {
            it("Token", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("10000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 6n;
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

                const amountToBridgeZeroInput = 0;

                await expect(deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridgeZeroInput,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E3");

                await expect(deployedToken.connect(user).bridge(
                    user,
                    ethers.zeroPadValue(user.address, 32),
                    amountToBridgeZeroInput,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E3");

                const amountToBridgeZeroAfterConversion = withDecimals("0.0000001");

                await expect(deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridgeZeroAfterConversion,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E3");

                await expect(deployedToken.connect(user).bridge(
                    user,
                    ethers.zeroPadValue(user.address, 32),
                    amountToBridgeZeroAfterConversion,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E3");
            });

            it("Connector", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken } = await loadFixture(globalFixture);

                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 6n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const { deployedConnector } = await deployConnectorByFactory(
                    executor,
                    user,
                    justToken,
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

                await justToken.connect(user).approve(deployedConnector.target, withDecimals("1"))
                const amountToBridgeZeroInput = 0;

                await expect(deployedConnector.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridgeZeroInput,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E3");

                await expect(deployedConnector.connect(user).bridge(
                    user.address,
                    ethers.zeroPadValue(user.address, 32),
                    amountToBridgeZeroInput,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E3");

                const amountToBridgeZeroAfterConversion = withDecimals("0.0000001");

                await expect(deployedConnector.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridgeZeroAfterConversion,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E3");

                await expect(deployedConnector.connect(user).bridge(
                    user.address,
                    ethers.zeroPadValue(user.address, 32),
                    amountToBridgeZeroAfterConversion,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E3");
            });
        });

        describe("UTS Base E5", function () {
            it("Token bridge", async function () {
                const { baseFeePerGasInWei, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                await deployedToken.connect(user).setChainConfig(
                    allowedChainIds,
                    [[configPeer, configMinGasLimit, configDecimals, true]]
                );

                await expect(deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    1n,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E5");

                await expect(deployedToken.connect(user).bridge(
                    user,
                    ethers.zeroPadValue(user.address, 32),
                    1n,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E5");
            });

            it("Token redeem", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                await deployedToken.connect(user).setChainConfig(
                    allowedChainIds,
                    [[configPeer, configMinGasLimit, configDecimals, true]]
                );

                await deployedToken.connect(user).setRouter(user);

                await expect(deployedToken.connect(user).redeem(
                    user,
                    1,
                    "0x",
                    [user.address, allowedChainIds[0], configPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E5");
            });

            it("Endpoint redeem", async function () {
                const { endpoint, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, protocolId, functionSelector, masterRouter } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                await deployedToken.connect(user).setChainConfig(
                    allowedChainIds,
                    [[configPeer, configMinGasLimit, configDecimals, true]]
                );

                const params = await encodeParamsToRedeem(
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

                const tx = await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);

                await deployedToken.connect(user).setChainConfig(
                    allowedChainIds,
                    [[configPeer, configMinGasLimit, configDecimals, false]]
                );

                await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);
            });
        });

        describe("UTS Base E7", function () {
            it("Token", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, mockRouter, routerRole, masterRouter } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
                await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
                await deployedToken.connect(user).setRouter(mockRouter.target);

                let falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                await expect(mockRouter.connect(user).redeem(
                    deployedToken.target,
                    user,
                    1,
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                await expect(mockRouter.connect(user).setChainConfigByRouter(
                    deployedToken.target,
                    [],
                    [],
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                falseConfigPeer = "0x00";

                await expect(mockRouter.connect(user).redeem(
                    deployedToken.target,
                    user,
                    1,
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                await expect(mockRouter.connect(user).setChainConfigByRouter(
                    deployedToken.target,
                    [],
                    [],
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                falseConfigPeer = "0xff";

                await expect(mockRouter.connect(user).redeem(
                    deployedToken.target,
                    user,
                    1,
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                await expect(mockRouter.connect(user).setChainConfigByRouter(
                    deployedToken.target,
                    [],
                    [],
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d71666150b2c873c7c8d2859c07d9f9d7166619873f73769873f7376bb93b4fc3c3efb93eec00";

                await expect(mockRouter.connect(user).redeem(
                    deployedToken.target,
                    user,
                    1,
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                await expect(mockRouter.connect(user).setChainConfigByRouter(
                    deployedToken.target,
                    [],
                    [],
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");
            });

            it("Connector", async function () {
                const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, routerRole, mockRouter, masterRouter } = await loadFixture(globalFixture);

                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const { deployedConnector } = await deployConnectorByFactory(
                    executor,
                    user,
                    justToken,
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

                await masterRouter.connect(admin).grantRole(routerRole, mockRouter.target);
                await mockRouter.connect(user).setProtocolVersion(globalProtocolVersion);
                await deployedConnector.connect(user).setRouter(mockRouter.target);

                const falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                await expect(mockRouter.connect(user).redeem(
                    deployedConnector.target,
                    user,
                    1,
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E7");

                await expect(mockRouter.connect(user).setChainConfigByRouter(
                    deployedConnector.target,
                    [],
                    [],
                    [user.address, allowedChainIds[0], falseConfigPeer, configDecimals]
                )).to.be.revertedWithCustomError(deployedConnector, "UTSBase__E7");
            });

            it("Endpoint", async function () {
                const { masterRouter, adminRole, zeroAddress, registry, executor, user, factory, router, endpoint, protocolId, zeroHash, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const falseConfigPeer = "0xff050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                let params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    999n,
                    allowedChainIds[0],
                    falseConfigPeer,
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
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);
            });
        });

        describe("Bridge", function () {
            it("Token bridge", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, feeCollector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const etherBalanceBefore = await ethers.provider.getBalance(feeCollector);
                const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

                expect(estimateValues[1]).to.equal(await router.dstMinGasLimit(allowedChainIds[0]));

                const bridgePayment = await router.getBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

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

                expect(etherBalanceBefore + baseFeePerGasInWei * configMinGasLimit).to.equal(await ethers.provider.getBalance(feeCollector));
                expect(await deployedToken.balanceOf(user) + tokenAmountToBridge).to.equal(tokenBalanceBefore);
                expect(estimateValues[0]).to.equal(bridgePayment);
                expect(etherBalanceBefore + estimateValues[0]).to.equal(await ethers.provider.getBalance(feeCollector));
            });

            it("Token bridge from zero address", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, feeCollector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 300000n;
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
                const etherBalanceBefore = await ethers.provider.getBalance(feeCollector);
                const estimateValues = await deployedToken.estimateBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

                expect(estimateValues[1]).to.equal(configMinGasLimit);

                await deployedToken.connect(user).bridge(
                    zeroAddress,
                    user.address,
                    tokenAmountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(etherBalanceBefore + baseFeePerGasInWei * configMinGasLimit).to.equal(await ethers.provider.getBalance(feeCollector));
                expect(await deployedToken.balanceOf(user) + tokenAmountToBridge).to.equal(tokenBalanceBefore);
            });

            it("Connector bridge", async function () {
                const { admin, executor, justToken, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei, feeCollector } = await loadFixture(globalFixture);

                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const { deployedConnector } = await deployConnectorByFactory(
                    executor,
                    admin,
                    justToken,
                    false,
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

                const tokenBalanceBefore = await justToken.balanceOf(admin);
                const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
                const tokenAmountToBridge = 1000n;

                await justToken.connect(admin).approve(deployedConnector.target, tokenAmountToBridge);
                const etherBalanceBefore = await ethers.provider.getBalance(feeCollector);

                await deployedConnector.connect(admin).bridge(
                    admin.address,
                    admin.address,
                    tokenAmountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(etherBalanceBefore + baseFeePerGasInWei * configMinGasLimit).to.equal(await ethers.provider.getBalance(feeCollector));
                expect(await justToken.balanceOf(admin) + tokenAmountToBridge).to.equal(tokenBalanceBefore);
                expect(await justToken.balanceOf(deployedConnector.target) - tokenAmountToBridge).to.equal(connectorBalanceBefore);
            });
        });

        describe("Redeem", function () {
            it("Success case", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
                const gasLimit = 175000n;

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    amountToRedeem,
                    allowedChainIds[0],
                    configPeer,
                    configDecimals,
                    gasLimit,
                    "0x"
                );

                const userBalanceBefore = await deployedToken.balanceOf(user);
                const totalSupplyBefore = await deployedToken.totalSupply();

                const tx = await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                expect(await deployedToken.isExecutionFailed(
                    user,
                    amountToRedeem,
                    "0x",
                    [user.address, allowedChainIds[0], configPeer, configDecimals],
                    1
                )).to.equal(false);

                expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Record case", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const gasLimit = 45001n;

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    amountToRedeem,
                    allowedChainIds[0],
                    configPeer,
                    configDecimals,
                    gasLimit,
                    "0x"
                );

                const userBalanceBefore = await deployedToken.balanceOf(user);
                const totalSupplyBefore = await deployedToken.totalSupply();

                const tx = await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                await tx.wait();
                const filter = masterRouter.filters.ProposalExecuted;
                const events = await masterRouter.queryFilter(filter, -1);
                const args = events[0].args;

                expect(await deployedToken.isExecutionFailed(
                    user,
                    amountToRedeem,
                    "0x",
                    [user.address, allowedChainIds[0], configPeer, configDecimals],
                    1
                )).to.equal(true);

                expect(userBalanceBefore).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Failure case", async function () {
                const { admin, user, router, zeroHash, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const UTSTokenMock = await ethers.getContractFactory("UTSTokenMock", admin);
                const mock = await UTSTokenMock.deploy(router.target);
                await mock.waitForDeployment();

                const allowedChainIds = [dstChainId];
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;

                const amountToRedeem = withDecimals("1500");
                const gasLimit = 84000n;

                const params = await encodeParamsToRedeem(
                    user,
                    mock,
                    user,
                    amountToRedeem,
                    allowedChainIds[0],
                    configPeer,
                    configDecimals,
                    gasLimit,
                    "0x"
                );

                const tx = await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                expect(await mock.isExecutionFailed(
                    user,
                    amountToRedeem,
                    "0x",
                    [user.address, allowedChainIds[0], configPeer, configDecimals],
                    1
                )).to.equal(false);

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });
        });

        describe("Retry", function () {
            it("Record case", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const payload = "0x";

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    amountToRedeem,
                    allowedChainIds[0],
                    invalidConfigPeer,
                    configDecimals,
                    500000n,
                    payload
                );

                const tx = await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const filterBase = deployedToken.filters.ExecutionFailed;
                const eventsBase = await deployedToken.queryFilter(filterBase, -1);
                const argsBase = eventsBase[0].args;

                const origin = [user.address, allowedChainIds[0], invalidConfigPeer, configDecimals];

                expect(await argsBase[0]).to.equal(user);
                expect(await argsBase[1]).to.equal(amountToRedeem);
                expect(await argsBase[2]).to.equal(payload);
                expect(await argsBase[3].hash).to.equal("0xd5819e874241e3091c5eea263acf195d55c5c58857f6585c70136d713679e50b");
                expect(await argsBase[5].hash).to.equal("0x8b98ec5e4b1db00a781f1478eec5049e29cd1dadae6323771ead8a36abb8f791");
                expect(await argsBase[6]).to.equal(1);

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);

                expect(await deployedToken.isExecutionFailed(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    0
                )).to.equal(false);

                expect(await deployedToken.isExecutionFailed(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                )).to.equal(true);

                await deployedToken.connect(user).retryRedeem(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    0
                );

                expect(await deployedToken.isExecutionFailed(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                )).to.equal(true);

                expect(await deployedToken.isExecutionFailed(
                    zeroAddress,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                )).to.equal(false);

                await deployedToken.connect(user).retryRedeem(
                    zeroAddress,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                );

                await expect(deployedToken.connect(user).retryRedeem(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                )).to.be.revertedWithCustomError(deployedToken, "UTSBase__E7");

                await deployedToken.connect(user).setChainConfig(
                    allowedChainIds,
                    [[invalidConfigPeer, configMinGasLimit, configDecimals, false]]
                );

                const chainConfigData = await deployedToken.getChainConfigs([allowedChainIds[0]]);

                expect(chainConfigData[0].peerAddress).to.equal(invalidConfigPeer);
                expect(chainConfigData[0].minGasLimit).to.equal(configMinGasLimit);
                expect(chainConfigData[0].decimals).to.equal(configDecimals);
                expect(chainConfigData[0].paused).to.equal(false);

                const amountToReceive = await convert(amountToRedeem, configDecimals, decimals);
                const userBalanceBefore = await deployedToken.balanceOf(user);
                const totalSupplyBefore = await deployedToken.totalSupply();

                await deployedToken.connect(executor).retryRedeem(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                );

                expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());

                expect(await deployedToken.isExecutionFailed(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                )).to.equal(false);

                await deployedToken.connect(executor).retryRedeem(
                    user,
                    amountToRedeem,
                    payload,
                    origin,
                    1
                );

                expect(userBalanceBefore + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore + amountToReceive).to.equal(await deployedToken.totalSupply());
            });
        });
    });

    describe("UTS BaseExtended", function () {
        describe("setChainConfigToDestination", function () {
            it("Base test token", async function () {
                const { admin, endpoint, functionSelector, masterRouter, protocolId, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];
                const updateConfig = [[123, 456], [config, config]];

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
                    [123, 456],
                    [ethers.zeroPadValue(masterRouter.target, 32), ethers.zeroPadValue(masterRouter.target, 32)]
                );

                await deployedToken.connect(user).setChainConfig(
                    [123, 456],
                    [[factory.target, configMinGasLimit, configDecimals, false], [factory.target, configMinGasLimit, configDecimals, false]]
                );

                const tx = await deployedToken.connect(user).setChainConfigToDestination(
                    [123, 456],
                    [updateConfig, updateConfig],
                    { value: withDecimals("1") }
                );

                const params = await encodeParamsToUpdateConfig(
                    user,
                    factory,
                    curChainId,
                    deployedToken.target,
                    updateConfig
                );

                const paramsTwo = await encodeParamsToUpdateConfig(
                    user,
                    factory,
                    curChainId,
                    deployedToken.target,
                    updateConfig
                );

                await tx.wait();
                const filter = endpoint.filters.Propose;
                const events = await endpoint.queryFilter(filter, -1);
                const argsT = events[0].args;
                const argsC = events[1].args;

                expect(argsT[0]).to.equal(protocolId);
                expect(argsT[1]).to.equal(0);
                expect(argsT[2]).to.equal(0);
                expect(argsT[3]).to.equal(123);
                expect(argsT[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(argsT[5]).to.equal(functionSelector);
                expect(argsT[6]).to.equal(params);
                expect(argsT[7]).to.equal("0x");

                expect(argsC[0]).to.equal(protocolId);
                expect(argsC[1]).to.equal(0);
                expect(argsC[2]).to.equal(0);
                expect(argsC[3]).to.equal(456);
                expect(argsC[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(argsC[5]).to.equal(functionSelector);
                expect(argsC[6]).to.equal(paramsTwo);
                expect(argsC[7]).to.equal("0x");

                const hash = await endpoint.getHash(protocolId, 456, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, paramsTwo);

                expect(await endpoint.lastProposal()).to.equal(hash);
            });

            it("Base test connector", async function () {
                const { justToken, admin, endpoint, functionSelector, masterRouter, protocolId, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(globalFixture);

                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec0011";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];
                const updateConfig = [[123, 456], [config, config]];

                const { deployedConnector } = await deployConnectorByFactory(
                    executor,
                    user,
                    justToken,
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
                    adminRole,
                    masterRouter
                );

                await masterRouter.connect(admin).setDstMasterRouter(
                    [123],
                    [ethers.zeroPadValue(masterRouter.target, 32)]
                );

                await deployedConnector.connect(user).setChainConfig(
                    [123],
                    [[configPeer, configMinGasLimit, configDecimals, false]]
                );

                const tx = await deployedConnector.connect(user).setChainConfigToDestination(
                    [123],
                    [updateConfig],
                    { value: withDecimals("1") }
                );

                const localParams = AbiCoder.encode([
                    "bytes",
                    "uint256",
                    "bytes",
                    "tuple(uint256[], tuple(bytes, uint64, uint8, bool)[])"
                ], [
                    user.address,
                    curChainId,
                    deployedConnector.target,
                    updateConfig
                ]);

                const params = AbiCoder.encode([
                    "bytes",
                    "bytes1",
                    "bytes"
                ], [
                    configPeer,
                    routerUpdateMessageType,
                    localParams
                ]);

                await tx.wait();
                const filter = endpoint.filters.Propose;
                const events = await endpoint.queryFilter(filter, -1);
                const args = events[0].args;

                expect(args[0]).to.equal(protocolId);
                expect(args[1]).to.equal(0);
                expect(args[2]).to.equal(0);
                expect(args[3]).to.equal(123);
                expect(args[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(args[5]).to.equal(functionSelector);
                expect(args[6]).to.equal(params);
                expect(args[7]).to.equal("0x");

                const hash = await endpoint.getHash(protocolId, 123, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastProposal()).to.equal(hash);
            });
        });

        describe("setChainConfigByRouter", function () {
            it("Base test token", async function () {
                const { endpoint, functionSelector, masterRouter, protocolId, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

                const updateConfig = [[123, 345], [config, config]];

                const params = await encodeParamsToUpdateConfig(
                    user,
                    deployedToken,
                    dstChainId,
                    configPeer,
                    updateConfig
                );

                await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                let filter = masterRouter.filters.ProposalExecuted;
                let events = await masterRouter.queryFilter(filter, -1);
                let args = events[0].args;

                expect(args[0]).to.equal(0);

                filter = deployedToken.filters.ChainConfigUpdated;
                events = await deployedToken.queryFilter(filter, -1);
                args = events[events.length - 1].args;

                expect(args[0]).to.equal(router.target);
                expect(args[1]).to.eql([123n, 345n]);
                expect(args[2]).to.eql([config, config]);

                filter = registry.filters.ChainConfigUpdated;
                events = await registry.queryFilter(filter, -1);
                args = events[events.length - 1].args;

                expect(args[0]).to.equal(deployedToken.target);
                expect(args[1]).to.eql([123n, 345n]);
                expect(args[2]).to.eql([config, config]);

                const configData = await deployedToken.getChainConfigs([dstChainId, 123, 345]);

                expect(configData[0].peerAddress).to.equal(configPeer);
                expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
                expect(configData[0].decimals).to.equal(configDecimals);
                expect(configData[0].paused).to.equal(false);
                expect(configData[1].peerAddress).to.equal("0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00");
                expect(configData[1].minGasLimit).to.equal(123);
                expect(configData[1].decimals).to.equal(243);
                expect(configData[1].paused).to.equal(true);
                expect(configData[2].peerAddress).to.equal("0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00");
                expect(configData[2].minGasLimit).to.equal(123);
                expect(configData[2].decimals).to.equal(243);
                expect(configData[2].paused).to.equal(true);
            });

            it("Should return error code by invalid peer", async function () {
                const { endpoint, functionSelector, masterRouter, protocolId, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];
                const invalidPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec01";

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

                const updateConfig = [[123, 345], [config, config]];

                const params = await encodeParamsToUpdateConfig(
                    user,
                    deployedToken,
                    dstChainId,
                    invalidPeer,
                    updateConfig
                );

                await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                let filter = masterRouter.filters.ProposalExecuted;
                let events = await masterRouter.queryFilter(filter, -1);
                let args = events[0].args;

                expect(args[0]).to.equal(2);

                const configData = await deployedToken.getChainConfigs([dstChainId, 123, 345]);

                expect(configData[0].peerAddress).to.equal(configPeer);
                expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
                expect(configData[0].decimals).to.equal(configDecimals);
                expect(configData[0].paused).to.equal(false);
                expect(configData[1].peerAddress).to.equal("0x");
                expect(configData[1].minGasLimit).to.equal(0);
                expect(configData[1].decimals).to.equal(0);
                expect(configData[1].paused).to.equal(false);
                expect(configData[2].peerAddress).to.equal("0x");
                expect(configData[2].minGasLimit).to.equal(0);
                expect(configData[2].decimals).to.equal(0);
                expect(configData[2].paused).to.equal(false);
            });

            it("Should return error code by invalid chainId", async function () {
                const { endpoint, functionSelector, masterRouter, protocolId, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

                const updateConfig = [[123, 345], [config, config]];

                const params = await encodeParamsToUpdateConfig(
                    user,
                    deployedToken,
                    curChainId,
                    configPeer,
                    updateConfig
                );

                await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                let filter = masterRouter.filters.ProposalExecuted;
                let events = await masterRouter.queryFilter(filter, -1);
                let args = events[0].args;

                expect(args[0]).to.equal(6);

                const configData = await deployedToken.getChainConfigs([dstChainId, 123, 345]);

                expect(configData[0].peerAddress).to.equal(configPeer);
                expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
                expect(configData[0].decimals).to.equal(configDecimals);
                expect(configData[0].paused).to.equal(false);
                expect(configData[1].peerAddress).to.equal("0x");
                expect(configData[1].minGasLimit).to.equal(0);
                expect(configData[1].decimals).to.equal(0);
                expect(configData[1].paused).to.equal(false);
                expect(configData[2].peerAddress).to.equal("0x");
                expect(configData[2].minGasLimit).to.equal(0);
                expect(configData[2].decimals).to.equal(0);
                expect(configData[2].paused).to.equal(false);
            });

            it("Should return error code by empty peer", async function () {
                const { endpoint, functionSelector, masterRouter, protocolId, adminRole, zeroHash, zeroAddress, router, executor, user, registry, factory } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const config = ["0xf4050b2c873c7c8d28ff619873f7376bb93b4fc3c3efb93eec00", 123n, 243n, true];

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

                const updateConfig = [[123, 345], [config, config]];

                const params = await encodeParamsToUpdateConfig(
                    user,
                    deployedToken,
                    dstChainId,
                    "0x",
                    updateConfig
                );

                await endpoint.executeOperation([
                    protocolId,
                    0,
                    allowedChainIds[0],
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                let filter = masterRouter.filters.ProposalExecuted;
                let events = await masterRouter.queryFilter(filter, -1);
                let args = events[0].args;

                expect(args[0]).to.equal(8);

                const configData = await deployedToken.getChainConfigs([dstChainId, 123, 345]);

                expect(configData[0].peerAddress).to.equal(configPeer);
                expect(configData[0].minGasLimit).to.equal(configMinGasLimit);
                expect(configData[0].decimals).to.equal(configDecimals);
                expect(configData[0].paused).to.equal(false);
                expect(configData[1].peerAddress).to.equal("0x");
                expect(configData[1].minGasLimit).to.equal(0);
                expect(configData[1].decimals).to.equal(0);
                expect(configData[1].paused).to.equal(false);
                expect(configData[2].peerAddress).to.equal("0x");
                expect(configData[2].minGasLimit).to.equal(0);
                expect(configData[2].decimals).to.equal(0);
                expect(configData[2].paused).to.equal(false);
            });
        });
    });

    describe("UTS Registry", function () {
        describe("Deployments", function () {
            it("AccessControl", async function () {
                const { user, admin, registry, factory } = await loadFixture(globalFixture);

                expect(await registry.validateFactory(factory.target)).to.equal(true);
                expect(await registry.validateFactory(admin)).to.equal(false);

                await expect(registry.connect(user).approveRequestBatch([[
                    admin,
                    admin.address,
                    admin,
                    "0x0103"
                ]])).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

                await expect(registry.connect(user).registerDeployment(
                    admin,
                    admin.address,
                    admin,
                    "0x0103"
                )).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
            });

            it("Add deployment", async function () {
                const { executor, user, admin, registry, router, factory, zeroAddress, zeroHash, approverRole, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

                const totalDeploymentsBefore = await registry.totalDeployments();

                await registry.connect(admin).grantRole(approverRole, admin);

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

                let underlyingTokens = await registry.underlyingTokens();
                let deployments = await registry.deployments();
                let deploymentData = await registry.deploymentData(deployedToken.target);
                let deploymentByIndex = await registry.deploymentsByIndex([totalDeploymentsBefore]);
                let deploymentsByUnderlying = await registry.deploymentsByUnderlying(deployedToken.target);
                let deploymentsByDeployer = await registry.deploymentsByDeployer(user.address);
                let deploymentsByDeployerTwo = await registry.deploymentsByDeployer(executor.address);

                expect(underlyingTokens.includes(deployedToken.target)).to.equal(true);
                expect(deployments.includes(deployedToken.target)).to.equal(true);
                expect(deploymentData.deployer).to.equal(executor.address.toLowerCase());
                expect(deploymentData.underlyingToken).to.equal(deployedToken.target);
                expect(deploymentData.initProtocolVersion).to.equal(globalProtocolVersion);
                expect(deploymentByIndex[0]).to.equal(deployedToken.target);
                expect(deploymentsByUnderlying.includes(deployedToken.target)).to.equal(true);
                expect(deploymentsByDeployer.includes(deployedToken.target)).to.equal(false);
                expect(deploymentsByDeployerTwo.includes(deployedToken.target)).to.equal(true);

                expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
                expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);
                expect(await registry.totalDeployments()).to.equal(totalDeploymentsBefore + 1n);

                await registry.connect(admin).approveRequestBatch([[
                    deployedToken.target,
                    admin.address,
                    registry.target,
                    "0x0102"
                ]]);

                underlyingTokens = await registry.underlyingTokens();
                deployments = await registry.deployments();
                deploymentData = await registry.deploymentData(deployedToken.target);
                deploymentByIndex = await registry.deploymentsByIndex([totalDeploymentsBefore]);
                let deploymentByIndexNew = await registry.deploymentsByIndex([totalDeploymentsBefore + 1n]);
                let deploymentsByUnderlyingOld = await registry.deploymentsByUnderlying(deployedToken.target);
                let deploymentsByDeployerOld = await registry.deploymentsByDeployer(user.address);
                deploymentsByDeployer = await registry.deploymentsByDeployer(admin.address);
                const deploymentsByIndexNew = await registry.deploymentsByIndex([totalDeploymentsBefore, totalDeploymentsBefore + 1n]);

                expect(underlyingTokens.includes(deployedToken.target)).to.equal(true);
                expect(deployments.includes(deployedToken.target)).to.equal(true);
                expect(deploymentData.deployer).to.equal(admin.address.toLowerCase());
                expect(deploymentData.underlyingToken).to.equal(deployedToken.target);
                expect(deploymentData.initProtocolVersion).to.equal("0x0102");
                expect(deploymentByIndex[0]).to.equal(deployedToken.target);
                expect(deploymentByIndexNew[0]).to.equal(zeroAddress);
                expect(deploymentsByIndexNew[0]).to.equal(deployedToken.target);
                expect(deploymentsByIndexNew[1]).to.equal(zeroAddress);
                expect(deploymentsByDeployer.includes(deployedToken.target)).to.equal(true);
                expect(deploymentsByUnderlyingOld.includes(deployedToken.target)).to.equal(true);
                expect(deploymentsByDeployerOld.includes(deployedToken.target)).to.equal(false);

                expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
                expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);
                expect(await registry.totalDeployments()).to.equal(totalDeploymentsBefore + 1n);

                await registry.connect(admin).approveRequestBatch([[
                    deployedToken.target,
                    admin.address,
                    admin,
                    "0x0103"
                ]]);

                underlyingTokens = await registry.underlyingTokens();
                deployments = await registry.deployments();
                deploymentData = await registry.deploymentData(deployedToken.target);
                deploymentByIndex = await registry.deploymentsByIndex([totalDeploymentsBefore]);
                deploymentByIndexNew = await registry.deploymentsByIndex([totalDeploymentsBefore + 1n]);
                deploymentsByUnderlyingOld = await registry.deploymentsByUnderlying(deployedToken.target);
                deploymentsByDeployerOld = await registry.deploymentsByDeployer(user.address);
                deploymentsByDeployer = await registry.deploymentsByDeployer(admin.address);

                expect(underlyingTokens.includes(deployedToken.target)).to.equal(true);
                expect(deployments.includes(deployedToken.target)).to.equal(true);
                expect(deploymentData.deployer).to.equal(admin.address.toLowerCase());
                expect(deploymentData.underlyingToken).to.equal(deployedToken.target);
                expect(deploymentData.initProtocolVersion).to.equal("0x0103");
                expect(deploymentByIndex[0]).to.equal(deployedToken.target);
                expect(deploymentByIndexNew[0]).to.equal(zeroAddress);
                expect(deploymentsByDeployer.includes(deployedToken.target)).to.equal(true);
                expect(deploymentsByUnderlyingOld.includes(deployedToken.target)).to.equal(true);
                expect(deploymentsByDeployerOld.includes(deployedToken.target)).to.equal(false);

                expect(await registry.validateUnderlyingRegistered(deployedToken.target)).to.equal(true);
                expect(await registry.validateDeploymentRegistered(deployedToken.target)).to.equal(true);
                expect(await registry.totalDeployments()).to.equal(totalDeploymentsBefore + 1n);
            });

            it("UTS Registry E0", async function () {
                const { admin, registry, approverRole, factoryRole } = await loadFixture(globalFixture);

                await registry.connect(admin).grantRole(approverRole, admin);
                await registry.connect(admin).grantRole(factoryRole, admin);

                await expect(registry.connect(admin).approveRequestBatch([[
                    admin,
                    "0x",
                    admin,
                    "0x0103"
                ]])).to.be.revertedWithCustomError(registry, "UTSRegistry__E0");

                await expect(registry.connect(admin).registerDeployment(
                    admin,
                    "0x",
                    admin,
                    "0x0103"
                )).to.be.revertedWithCustomError(registry, "UTSRegistry__E0");
            });

            it("UTS Registry E1", async function () {
                const { registry, admin } = await loadFixture(globalFixture);

                const allowedChainIds = [dstChainId];
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 18n;
                const gasLimit = 1000000n;

                const chainConfigs = [[configPeer, gasLimit, configDecimals, false]];

                await expect(registry.connect(admin).updateChainConfigs(
                    allowedChainIds,
                    chainConfigs
                )).to.be.revertedWithCustomError(registry, "UTSRegistry__E1");

                await expect(registry.connect(admin).updateRouter(
                    admin
                )).to.be.revertedWithCustomError(registry, "UTSRegistry__E1");
            });
        });
    });

    describe("UTS Connector", function () {
        it("Redeem to connector", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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
                adminRole,
                masterRouter
            );

            const amountToRedeem = withDecimals("150");
            await justToken.connect(admin).transfer(deployedConnector.target, withDecimals("200"));

            const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
            const userBalanceBefore = await justToken.balanceOf(user);
            const totalSupplyBefore = await justToken.totalSupply();

            const params = await encodeParamsToRedeem(
                user,
                deployedConnector,
                deployedConnector,
                amountToRedeem,
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
                curChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            expect(connectorBalanceBefore).to.equal(await justToken.balanceOf(deployedConnector.target));
            expect(userBalanceBefore).to.equal(await justToken.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await justToken.totalSupply());
        });

        it("Redeem to user", async function () {
            const { admin, user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, justToken, endpoint, masterRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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
                adminRole,
                masterRouter
            );

            const amountToRedeem = withDecimals("150");
            await justToken.connect(admin).transfer(deployedConnector.target, withDecimals("200"));

            const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
            const userBalanceBefore = await justToken.balanceOf(user);
            const totalSupplyBefore = await justToken.totalSupply();

            const params = await encodeParamsToRedeem(
                user,
                deployedConnector,
                user,
                amountToRedeem,
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
                curChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], []);

            expect(connectorBalanceBefore - amountToRedeem).to.equal(await justToken.balanceOf(deployedConnector.target));
            expect(userBalanceBefore + amountToRedeem).to.equal(await justToken.balanceOf(user));
            expect(totalSupplyBefore).to.equal(await justToken.totalSupply());
        });
    });

    describe("UTS Token", function () {
        describe("Mintable", function () {
            it("Mint by role if mintable", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1000");
                const mintable = true;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const minterRole = await deployedToken.MINTER_ROLE();

                await deployedToken.connect(user).grantRole(minterRole, executor);

                const tokenBalanceBefore = await deployedToken.balanceOf(executor);
                const totalSupplyBefore = await deployedToken.totalSupply();
                const tokenAmountToMint = withDecimals("10000");

                await deployedToken.connect(executor).mint(executor, tokenAmountToMint);

                expect(tokenBalanceBefore + tokenAmountToMint).to.equal(await deployedToken.balanceOf(executor));
                expect(totalSupplyBefore + tokenAmountToMint).to.equal(await deployedToken.totalSupply());
            });

            it("UTS Token E0 Should revert mint by third party if mintable", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1000");
                const mintable = true;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const tokenBalanceBefore = await deployedToken.balanceOf(executor);
                const totalSupplyBefore = await deployedToken.totalSupply();
                const tokenAmountToMint = withDecimals("10000");

                await expect(deployedToken.connect(executor).mint(
                    executor,
                    tokenAmountToMint
                )).to.be.revertedWithCustomError(deployedToken, "UTSToken__E0");

                expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });

            it("UTS Token E1 Should revert mint if non-mintable", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = true;
                const allowedChainIds = [dstChainId];
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
                const totalSupplyBefore = await deployedToken.totalSupply();
                const tokenAmountToMint = withDecimals("10000");

                const nonMintableToken = await ethers.getContractAt("UTSTokenMintable", deployedToken.target);

                await expect(nonMintableToken.connect(user).mint(
                    user,
                    tokenAmountToMint
                )).to.be.reverted;

                expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });
        });

        describe("Burnable", function () {
            it("UTS Token E0 Should revert burn by third party if burnable only role", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("1000");
                const mintable = true;
                const globalBurnable = false;
                const onlyRoleBurnable = true;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const tokenBalanceBefore = await deployedToken.balanceOf(executor);
                const totalSupplyBefore = await deployedToken.totalSupply();
                const tokenAmountToBurn = withDecimals("10000");

                await expect(deployedToken.connect(user).burn(
                    tokenAmountToBurn
                )).to.be.revertedWithCustomError(deployedToken, "UTSToken__E0");

                await expect(deployedToken.connect(executor).burn(
                    tokenAmountToBurn
                )).to.be.revertedWithCustomError(deployedToken, "UTSToken__E0");

                expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });

            it("UTS Token E1 Should revert burn if global non-burnable", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const tokenAmountToBurn = withDecimals("10000");

                await expect(deployedToken.connect(user).burn(
                    tokenAmountToBurn
                )).to.be.revertedWithCustomError(deployedToken, "UTSToken__E1");

                const burnerRole = await deployedToken.BURNER_ROLE();

                await deployedToken.connect(user).grantRole(burnerRole, user);

                const tokenBalanceBefore = await deployedToken.balanceOf(user);
                const totalSupplyBefore = await deployedToken.totalSupply();

                await expect(deployedToken.connect(user).burn(
                    tokenAmountToBurn
                )).to.be.revertedWithCustomError(deployedToken, "UTSToken__E1");

                await deployedToken.connect(user).approve(executor, tokenAmountToBurn);

                await expect(deployedToken.connect(executor).burnFrom(
                    user,
                    tokenAmountToBurn
                )).to.be.revertedWithCustomError(deployedToken, "UTSToken__E1");

                expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });

            it("Should revert burn by insufficient allowance if burnable", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check1";
                const symbol = "check2";
                const decimals = 16n;
                const initialSupply = withDecimals("1000");
                const mintable = true;
                const globalBurnable = true;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d716f619873f7376bb93b4fc3cfefb93eec00";
                const configDecimals = 16n;
                const salt = "0x04050b2c873c7c8d2859cf7d9f9d7166619873f7376bb93b4fc3c33fb93eec90";

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
                const totalSupplyBefore = await deployedToken.totalSupply();
                const tokenAmountToBurn = withDecimals("10000");

                await expect(deployedToken.connect(executor).burnFrom(
                    user,
                    tokenAmountToBurn
                )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");

                expect(tokenBalanceBefore).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });

            it("Should burn global burnable", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = true;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                const totalSupplyBefore = await deployedToken.totalSupply();
                const tokenAmountToBurn = withDecimals("10000");

                await deployedToken.connect(user).burn(tokenAmountToBurn);

                expect(tokenBalanceBefore - tokenAmountToBurn).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore - tokenAmountToBurn).to.equal(await deployedToken.totalSupply());

                const tokenBalanceBeforeTwo = await deployedToken.balanceOf(user);
                const totalSupplyBeforeTwo = await deployedToken.totalSupply();

                await deployedToken.connect(user).approve(executor, tokenAmountToBurn);

                await deployedToken.connect(executor).burnFrom(user, tokenAmountToBurn);

                expect(tokenBalanceBeforeTwo - tokenAmountToBurn).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeTwo - tokenAmountToBurn).to.equal(await deployedToken.totalSupply());
            });

            it("Should burn only role burnable", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = true;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const burnerRole = await deployedToken.BURNER_ROLE();

                const tokenBalanceBefore = await deployedToken.balanceOf(user);
                const totalSupplyBefore = await deployedToken.totalSupply();
                const tokenAmountToBurn = withDecimals("10000");

                await deployedToken.connect(user).grantRole(burnerRole, executor);
                await deployedToken.connect(user).approve(executor, tokenAmountToBurn);

                await expect(deployedToken.connect(user).burn(
                    tokenAmountToBurn
                )).to.be.revertedWithCustomError(deployedToken, "UTSToken__E0()");

                await deployedToken.connect(executor).burnFrom(user, tokenAmountToBurn);

                expect(tokenBalanceBefore - tokenAmountToBurn).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBefore - tokenAmountToBurn).to.equal(await deployedToken.totalSupply())
            });
        });

        describe("Bridge from", function () {
            it("Burn from", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const amountToBridge = withDecimals("100");

                await deployedToken.connect(user).approve(executor, amountToBridge);

                const userBalanceBefore = await deployedToken.balanceOf(user);
                const executorBalanceBefore = await deployedToken.balanceOf(executor);
                const totalSupplyBefore = await deployedToken.totalSupply();

                await deployedToken.connect(executor).bridge(
                    user.address,
                    executor.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(userBalanceBefore - amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(executorBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
                expect(totalSupplyBefore - amountToBridge).to.equal(await deployedToken.totalSupply());
            });

            it("Should revert burn from by insufficient allowance", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const amountToBridge = withDecimals("100");

                const userBalanceBefore = await deployedToken.balanceOf(user);
                const executorBalanceBefore = await deployedToken.balanceOf(executor);
                const totalSupplyBefore = await deployedToken.totalSupply();

                await expect(deployedToken.connect(executor).bridge(
                    user.address,
                    executor.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: configMinGasLimit }
                )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");

                expect(userBalanceBefore).to.equal(await deployedToken.balanceOf(user));
                expect(executorBalanceBefore).to.equal(await deployedToken.balanceOf(executor));
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });
        });

        describe("Decimals conversion", function () {
            it("Should redeem if same decimals", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const amountToBridge = withDecimals("100");

                const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
                const totalSupplyBeforeBridge = await deployedToken.totalSupply();

                await deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

                const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
                const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    amountToBridge,
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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBeforeRedeem + amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeRedeem + amountToBridge).to.equal(await deployedToken.totalSupply());
            });

            it("Should redeem if higher decimals", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 22n;
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

                const totalSupplyBefore = await deployedToken.totalSupply();
                const amountToBridge = withDecimals("1000");

                const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
                const totalSupplyBeforeBridge = await deployedToken.totalSupply();

                await deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

                const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
                const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

                const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
                const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    convertedAmountToBridge,
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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });

            it("Should redeem if lower decimals", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 10n;
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

                const totalSupplyBefore = await deployedToken.totalSupply();
                const amountToBridge = withDecimals("1000");

                const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
                const totalSupplyBeforeBridge = await deployedToken.totalSupply();

                await deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

                const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
                const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

                const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
                const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    convertedAmountToBridge,
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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });

            it("Should redeem if same decimals with dust", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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

                const amountToBridge = withDecimals("100.000000000009");

                const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
                const totalSupplyBeforeBridge = await deployedToken.totalSupply();

                await deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

                const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
                const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    amountToBridge,
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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBeforeRedeem + amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeRedeem + amountToBridge).to.equal(await deployedToken.totalSupply());
            });

            it("Should redeem if higher decimals with dust", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 22n;
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

                const totalSupplyBefore = await deployedToken.totalSupply();
                const amountToBridge = withDecimals("1000.000000000009");

                const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
                const totalSupplyBeforeBridge = await deployedToken.totalSupply();

                await deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(userBalanceBeforeBridge - amountToBridge).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeBridge - amountToBridge).to.equal(await deployedToken.totalSupply());

                const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
                const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

                const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
                const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    convertedAmountToBridge,
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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });

            it("Should redeem if lower decimals with dust", async function () {
                const { user, executor, factory, router, registry, zeroAddress, zeroHash, adminRole, endpoint, masterRouter, protocolId, functionSelector, baseFeePerGasInWei } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 18n;
                const initialSupply = withDecimals("100000");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
                const configMinGasLimit = 100000n;
                const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                const configDecimals = 10n;
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

                const totalSupplyBefore = await deployedToken.totalSupply();

                const amountToBridge = withDecimals("1000.00000000000009");
                const convertedAmountToBridge = await convert(amountToBridge, decimals, configDecimals);
                const amountToReceive = await convert(convertedAmountToBridge, configDecimals, decimals);

                expect(amountToReceive).to.equal(withDecimals("1000"));

                const userBalanceBeforeBridge = await deployedToken.balanceOf(user);
                const totalSupplyBeforeBridge = await deployedToken.totalSupply();

                await deployedToken.connect(user).bridge(
                    user.address,
                    user.address,
                    amountToBridge,
                    allowedChainIds[0],
                    configMinGasLimit,
                    "0x",
                    "0x",
                    { value: baseFeePerGasInWei * configMinGasLimit }
                );

                expect(userBalanceBeforeBridge - amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeBridge - amountToReceive).to.equal(await deployedToken.totalSupply());

                const userBalanceBeforeRedeem = await deployedToken.balanceOf(user);
                const totalSupplyBeforeRedeem = await deployedToken.totalSupply();

                const params = await encodeParamsToRedeem(
                    user,
                    deployedToken,
                    user,
                    convertedAmountToBridge,
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
                    curChainId,
                    ethers.zeroPadValue(masterRouter.target, 32),
                    functionSelector,
                    params,
                    "0x"
                ], []);

                expect(userBalanceBeforeRedeem + amountToReceive).to.equal(await deployedToken.balanceOf(user));
                expect(totalSupplyBeforeRedeem + amountToReceive).to.equal(await deployedToken.totalSupply());
                expect(totalSupplyBefore).to.equal(await deployedToken.totalSupply());
            });
        });
    });

    describe("UTS Token Pure", function () {
        it("Init settings", async function () {
            const { factory, router, user } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
            const pureToken = true;
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                0,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ]);

            const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
            const deployedToken = await ethers.getContractAt("UTSTokenPure", precompute.deployment);
            expect(precompute.hasCode).to.equal(true);

            expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply);
            expect(await deployedToken.totalSupply()).to.equal(initialSupply);
            expect(await deployedToken.balanceOf(user)).to.equal(0);
            expect(await deployedToken.decimals()).to.equal(decimals);
            expect(await deployedToken.underlyingToken()).to.equal(deployedToken.target);

            const newSalt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec01";
            const newInitialSupply = 0;

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                newInitialSupply,
                newInitialSupply,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                newSalt
            ]);

            const precomputeTwo = await factory.getPrecomputedAddress(4, user.address, newSalt, false);
            const deployedTokenTwo = await ethers.getContractAt("UTSTokenPure", precomputeTwo.deployment);
            expect(precomputeTwo.hasCode).to.equal(true);

            expect(await deployedTokenTwo.balanceOf(deployedTokenTwo.target)).to.equal(newInitialSupply);
            expect(await deployedTokenTwo.totalSupply()).to.equal(newInitialSupply);
            expect(await deployedTokenTwo.balanceOf(user)).to.equal(newInitialSupply);
            expect(await deployedTokenTwo.decimals()).to.equal(decimals);
            expect(await deployedTokenTwo.underlyingToken()).to.equal(deployedTokenTwo.target);

            const newSaltTwo = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec11";
            const mintedAmountToOwner = withDecimals("3579");

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                mintedAmountToOwner,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                newSaltTwo
            ]);

            const precomputeThree = await factory.getPrecomputedAddress(4, user.address, newSaltTwo, false);
            const deployedTokenThree = await ethers.getContractAt("UTSTokenPure", precomputeThree.deployment);
            expect(precomputeThree.hasCode).to.equal(true);

            expect(await deployedTokenThree.balanceOf(deployedTokenThree.target)).to.equal(initialSupply - mintedAmountToOwner);
            expect(await deployedTokenThree.balanceOf(user)).to.equal(mintedAmountToOwner);
            expect(await deployedTokenThree.totalSupply()).to.equal(initialSupply);
            expect(await deployedTokenThree.decimals()).to.equal(decimals);
            expect(await deployedTokenThree.underlyingToken()).to.equal(deployedTokenThree.target);
        });

        it("AccessControl", async function () {
            const { factory, router, user, admin } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
            const pureToken = true;
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ]);

            const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
            const deployedToken = await ethers.getContractAt("UTSTokenPure", precompute.deployment);
            expect(precompute.hasCode).to.equal(true);

            expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply - initialSupply);
            expect(await deployedToken.balanceOf(user)).to.equal(initialSupply);
            expect(await deployedToken.totalSupply()).to.equal(initialSupply);

            await expect(deployedToken.connect(admin).setRouter(
                admin.address
            )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

            await expect(deployedToken.connect(admin).setChainConfig(
                [1],
                [[admin.address, 0, 0, true]]
            )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");
        });

        it("Should revert bridge by insufficient allowance", async function () {
            const { admin, factory, router, user } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 12n;
            const initialSupply = withDecimals("1");
            const pureToken = true;
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ]);

            const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
            const deployedToken = await ethers.getContractAt("UTSTokenPure", precompute.deployment);
            expect(precompute.hasCode).to.equal(true);

            const amountToTransfer = 1n

            await expect(deployedToken.connect(user).bridge(
                admin,
                user.address,
                amountToTransfer,
                dstChainId,
                configMinGasLimit,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");

            await expect(deployedToken.connect(user).bridge(
                deployedToken.target,
                user.address,
                amountToTransfer,
                dstChainId,
                configMinGasLimit,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(deployedToken, "ERC20InsufficientAllowance");
        });

        it("Bridge", async function () {
            const { factory, router, user } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("1000");
            const pureToken = true;
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                0,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ]);

            const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
            const deployedToken = await ethers.getContractAt("UTSTokenPure", precompute.deployment);
            expect(precompute.hasCode).to.equal(true);

            expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply);
            expect(await deployedToken.balanceOf(user)).to.equal(0);
            expect(await deployedToken.totalSupply()).to.equal(initialSupply);

            await deployedToken.connect(user).setRouter(user);

            await expect(() => deployedToken.connect(user).redeem(
                user.address,
                initialSupply,
                "0x",
                [user.address, dstChainId, configPeer, configDecimals]
            )).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [initialSupply, -initialSupply]);

            await deployedToken.connect(user).setRouter(router.target);

            const amountToBridge = withDecimals("100");

            const bridgePayment = await router.getBridgeFee(dstChainId, configMinGasLimit, 0n, "0x");

            await expect(() => deployedToken.connect(user).bridge(
                user.address,
                user.address,
                amountToBridge,
                dstChainId,
                configMinGasLimit,
                "0x",
                "0x",
                { value: bridgePayment }
            )).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [-amountToBridge, amountToBridge]);
        });

        it("Redeem", async function () {
            const { functionSelector, masterRouter, zeroHash, protocolId, endpoint, factory, router, user } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
            const pureToken = true;
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                0,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ]);

            const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
            const deployedToken = await ethers.getContractAt("UTSTokenPure", precompute.deployment);
            expect(precompute.hasCode).to.equal(true);

            expect(await deployedToken.balanceOf(deployedToken.target)).to.equal(initialSupply);
            expect(await deployedToken.balanceOf(user)).to.equal(0);
            expect(await deployedToken.totalSupply()).to.equal(initialSupply);

            const amountToBridge = withDecimals("100");

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                user,
                amountToBridge,
                dstChainId,
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            await expect(() => endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
                0,
                [zeroHash, zeroHash],
                0,
                curChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], [])).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [amountToBridge, -amountToBridge]);

            let filter = masterRouter.filters.ProposalExecuted;
            let events = await masterRouter.queryFilter(filter, -1);
            let args = events[0].args;

            expect(args[0]).to.equal(0);
        });

        it("Redeem to token test", async function () {
            const { functionSelector, masterRouter, zeroHash, protocolId, endpoint, factory, router, user } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("10000");
            const pureToken = true;
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = false;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 18n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const chainConfigs = [[configPeer, configMinGasLimit, configDecimals, false]];

            await factory.connect(user).deployToken([
                user.address,
                name,
                symbol,
                decimals,
                initialSupply,
                initialSupply,
                pureToken,
                mintable,
                globalBurnable,
                onlyRoleBurnable,
                feeModule,
                router.target,
                allowedChainIds,
                chainConfigs,
                salt
            ]);

            const precompute = await factory.getPrecomputedAddress(4, user.address, salt, false);
            const deployedToken = await ethers.getContractAt("UTSTokenPure", precompute.deployment);
            expect(precompute.hasCode).to.equal(true);

            const amountToBridge = withDecimals("100");

            const params = await encodeParamsToRedeem(
                user,
                deployedToken,
                deployedToken,
                amountToBridge,
                dstChainId,
                configPeer,
                configDecimals,
                500000n,
                "0x"
            );

            await expect(() => endpoint.executeOperation([
                protocolId,
                0,
                allowedChainIds[0],
                0,
                [zeroHash, zeroHash],
                0,
                curChainId,
                ethers.zeroPadValue(masterRouter.target, 32),
                functionSelector,
                params,
                "0x"
            ], [])).to.changeTokenBalances(deployedToken, [user, deployedToken.target], [0, 0]);

            let filter = masterRouter.filters.ProposalExecuted;
            let events = await masterRouter.queryFilter(filter, -1);
            let args = events[0].args;

            expect(args[0]).to.equal(0);
        });
    });

    describe("UTS FeeModule", function () {
        it("Init settings", async function () {
            const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            expect(await deployedToken.feeCollector()).to.equal(zeroAddress);

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            expect(await deployedConnector.feeCollector()).to.equal(zeroAddress);
        });

        it("AccessControl", async function () {
            const { admin, justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            await expect(deployedToken.connect(admin).setFeeCollector(
                admin
            )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

            await expect(deployedToken.connect(admin).setBridgeFeeRate(
                [1],
                [1]
            )).to.be.revertedWithCustomError(deployedToken, "AccessControlUnauthorizedAccount");

            await expect(deployedConnector.connect(admin).setFeeCollector(
                admin
            )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");

            await expect(deployedConnector.connect(admin).setBridgeFeeRate(
                [1],
                [1]
            )).to.be.revertedWithCustomError(deployedConnector, "AccessControlUnauthorizedAccount");
        });

        it("Setters", async function () {
            const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            await deployedToken.connect(user).setFeeCollector(user);
            await deployedToken.connect(user).setBridgeFeeRate([1, 999], [777, 1]);
            await deployedConnector.connect(user).setFeeCollector(executor);
            await deployedConnector.connect(user).setBridgeFeeRate([3], [9999]);
            await deployedConnector.connect(user).setBridgeFeeRate([111], [123]);

            expect(await deployedToken.feeCollector()).to.equal(user);
            expect(await deployedToken.bridgeFeeRate(1)).to.equal(777);
            expect(await deployedToken.bridgeFeeRate(999)).to.equal(1);
            expect(await deployedConnector.feeCollector()).to.equal(executor);
            expect(await deployedConnector.bridgeFeeRate(3)).to.equal(9999);
            expect(await deployedConnector.bridgeFeeRate(111)).to.equal(123);

            await expect(deployedConnector.connect(user).setBridgeFeeRate(
                [1, 2],
                [1]
            )).to.be.revertedWithCustomError(deployedConnector, "UTSFeeModule__E2");

            await expect(deployedConnector.connect(user).setBridgeFeeRate(
                [1],
                [1, 2]
            )).to.be.revertedWithCustomError(deployedConnector, "UTSFeeModule__E2");

            await expect(deployedToken.connect(user).setBridgeFeeRate(
                [1, 2],
                [1]
            )).to.be.revertedWithCustomError(deployedConnector, "UTSFeeModule__E2");

            await expect(deployedToken.connect(user).setBridgeFeeRate(
                [1],
                [1, 2]
            )).to.be.revertedWithCustomError(deployedConnector, "UTSFeeModule__E2");
        });

        it("UTS FeeModule E0", async function () {
            const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            await expect(deployedToken.connect(user).setBridgeFeeRate(
                [1],
                [10000]
            )).to.be.revertedWithCustomError(deployedToken, "UTSFeeModule__E0");

            await expect(deployedConnector.connect(user).setBridgeFeeRate(
                [2, 3],
                [9999, 10000]
            )).to.be.revertedWithCustomError(deployedToken, "UTSFeeModule__E0");

            await expect(deployedToken.connect(user).setBridgeFeeRate(
                [3, 4, 5],
                [0, 111, 11111]
            )).to.be.revertedWithCustomError(deployedToken, "UTSFeeModule__E0");

            await expect(deployedConnector.connect(user).setBridgeFeeRate(
                [4, 5, 6, 7],
                [11000, 0, 0, 0]
            )).to.be.revertedWithCustomError(deployedToken, "UTSFeeModule__E0");
        });

        it("UTS FeeModule E1", async function () {
            const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 100000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            const bridgeFeeRate = 1999n;

            await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [bridgeFeeRate]);
            await deployedConnector.connect(user).setBridgeFeeRate(allowedChainIds, [bridgeFeeRate]);

            expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(bridgeFeeRate);
            expect(await deployedConnector.bridgeFeeRate(allowedChainIds[0])).to.equal(bridgeFeeRate);

            await expect(deployedToken.connect(user).bridgeWithSlippageCheck(
                user,
                user.address,
                bridgeFeeRate,
                allowedChainIds[0],
                configMinGasLimit,
                bridgeFeeRate + 1n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(deployedConnector, "UTSFeeModule__E1");

            await expect(deployedConnector.connect(user).bridgeWithSlippageCheck(
                user,
                user.address,
                bridgeFeeRate,
                allowedChainIds[0],
                configMinGasLimit,
                bridgeFeeRate - 1n,
                "0x",
                "0x"
            )).to.be.revertedWithCustomError(deployedConnector, "UTSFeeModule__E1");
        });

        it("Token bridge with fee", async function () {
            const { adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = true;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 150000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const feeRate = 1111n;

            await deployedToken.connect(user).setFeeCollector(executor);
            await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

            expect(await deployedToken.feeCollector()).to.equal(executor);
            expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

            const amountToBridge = withDecimals("1");
            const feeAmount = amountToBridge * feeRate / 10000n;

            const totalSupplyBefore = await deployedToken.totalSupply();
            const bridgePayment = await router.getBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            await expect(() => deployedToken.connect(user).bridge(
                user,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: bridgePayment }
            )).to.changeTokenBalances(deployedToken, [user, executor], [-amountToBridge, feeAmount]);

            const totalSupplyAfter = await deployedToken.totalSupply();

            expect(totalSupplyBefore - amountToBridge + feeAmount).to.equal(totalSupplyAfter);
            expect(await deployedToken.balanceOf(executor)).to.equal(feeAmount);

            const filter = deployedToken.filters.Bridged;
            const events = await deployedToken.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[5]).to.equal(amountToBridge - feeAmount);
        });

        it("Token bridge with fee onBehalfOf", async function () {
            const { admin, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = true;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 150000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const feeRate = 1111n;

            await deployedToken.connect(user).setFeeCollector(executor);
            await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

            expect(await deployedToken.feeCollector()).to.equal(executor);
            expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

            const amountToBridge = withDecimals("1");
            const feeAmount = amountToBridge * feeRate / 10000n;

            const totalSupplyBefore = await deployedToken.totalSupply();
            const bridgePayment = await router.getBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            await deployedToken.connect(user).transfer(admin, amountToBridge);
            await deployedToken.connect(admin).approve(user, amountToBridge);

            await expect(() => deployedToken.connect(user).bridge(
                admin,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: bridgePayment }
            )).to.changeTokenBalances(deployedToken, [admin, executor], [-amountToBridge, feeAmount]);

            const totalSupplyAfter = await deployedToken.totalSupply();

            expect(totalSupplyBefore - amountToBridge + feeAmount).to.equal(totalSupplyAfter);
            expect(await deployedToken.balanceOf(executor)).to.equal(feeAmount);

            const filter = deployedToken.filters.Bridged;
            const events = await deployedToken.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[5]).to.equal(amountToBridge - feeAmount);
        });

        it("Token bridgeWithSlippageCheck with fee", async function () {
            const { adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const name = "check0";
            const symbol = "check1";
            const decimals = 18n;
            const initialSupply = withDecimals("100000");
            const mintable = false;
            const globalBurnable = false;
            const onlyRoleBurnable = false;
            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 150000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
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

            const feeRate = 7987n;

            await deployedToken.connect(user).setFeeCollector(executor);
            await deployedToken.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

            expect(await deployedToken.feeCollector()).to.equal(executor);
            expect(await deployedToken.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

            const amountToBridge = withDecimals("1");
            const feeAmount = amountToBridge * feeRate / 10000n;

            const totalSupplyBefore = await deployedToken.totalSupply();
            const bridgePayment = await router.getBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            await expect(() => deployedToken.connect(user).bridgeWithSlippageCheck(
                user,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                feeRate,
                "0x",
                "0x",
                { value: bridgePayment }
            )).to.changeTokenBalances(deployedToken, [user, executor], [-amountToBridge, feeAmount]);

            const totalSupplyAfter = await deployedToken.totalSupply();

            expect(totalSupplyBefore - amountToBridge + feeAmount).to.equal(totalSupplyAfter);
            expect(await deployedToken.balanceOf(executor)).to.equal(feeAmount);
        });

        it("Connector bridge with fee", async function () {
            const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 150000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            const feeRate = 7777n;

            await deployedConnector.connect(user).setFeeCollector(executor);
            await deployedConnector.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

            expect(await deployedConnector.feeCollector()).to.equal(executor);
            expect(await deployedConnector.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

            const amountToBridge = withDecimals("99");
            const feeAmount = amountToBridge * feeRate / 10000n;

            const totalSupplyBefore = await justToken.totalSupply();
            const userBalanceBefore = await justToken.balanceOf(user);
            const executorBalanceBefore = await justToken.balanceOf(executor);
            const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
            const bridgePayment = await router.getBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            await justToken.connect(user).approve(deployedConnector.target, amountToBridge);

            await expect(() => deployedConnector.connect(user).bridge(
                user,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                "0x",
                "0x",
                { value: bridgePayment }
            )).to.changeTokenBalances(justToken, [user, executor, deployedConnector], [-amountToBridge, feeAmount, amountToBridge - feeAmount]);

            const totalSupplyAfter = await justToken.totalSupply();
            const userBalanceAfter = await justToken.balanceOf(user);
            const executorBalanceAfter = await justToken.balanceOf(executor);
            const connectorBalanceAfter = await justToken.balanceOf(deployedConnector.target);

            expect(totalSupplyBefore).to.equal(totalSupplyAfter);
            expect(userBalanceBefore - amountToBridge).to.equal(userBalanceAfter);
            expect(executorBalanceBefore + feeAmount).to.equal(executorBalanceAfter);
            expect(connectorBalanceBefore + amountToBridge - feeAmount).to.equal(connectorBalanceAfter);

            const filter = deployedConnector.filters.Bridged;
            const events = await deployedConnector.queryFilter(filter, -1);
            const args = events[0].args;

            expect(await args[5]).to.equal(amountToBridge - feeAmount);
        });

        it("Connector bridgeWithSlippageCheck with fee", async function () {
            const { justToken, adminRole, zeroHash, zeroAddress, registry, factory, router, user, executor } = await loadFixture(globalFixture);

            const feeModule = true;
            const allowedChainIds = [dstChainId];
            const configMinGasLimit = 150000n;
            const configPeer = "0xf4050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
            const configDecimals = 10n;
            const salt = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";

            const { deployedConnector } = await deployConnectorByFactory(
                executor,
                user,
                justToken,
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

            const feeRate = 111n;

            await deployedConnector.connect(user).setFeeCollector(executor);
            await deployedConnector.connect(user).setBridgeFeeRate(allowedChainIds, [feeRate]);

            expect(await deployedConnector.feeCollector()).to.equal(executor);
            expect(await deployedConnector.bridgeFeeRate(allowedChainIds[0])).to.equal(feeRate);

            const amountToBridge = withDecimals("99");
            const feeAmount = amountToBridge * feeRate / 10000n;

            const totalSupplyBefore = await justToken.totalSupply();
            const userBalanceBefore = await justToken.balanceOf(user);
            const executorBalanceBefore = await justToken.balanceOf(executor);
            const connectorBalanceBefore = await justToken.balanceOf(deployedConnector.target);
            const bridgePayment = await router.getBridgeFee(allowedChainIds[0], configMinGasLimit, 0n, "0x");

            await justToken.connect(user).approve(deployedConnector.target, amountToBridge);

            await expect(() => deployedConnector.connect(user).bridgeWithSlippageCheck(
                user,
                user.address,
                amountToBridge,
                allowedChainIds[0],
                configMinGasLimit,
                feeRate,
                "0x",
                "0x",
                { value: bridgePayment }
            )).to.changeTokenBalances(justToken, [user, executor, deployedConnector], [-amountToBridge, feeAmount, amountToBridge - feeAmount]);

            const totalSupplyAfter = await justToken.totalSupply();
            const userBalanceAfter = await justToken.balanceOf(user);
            const executorBalanceAfter = await justToken.balanceOf(executor);
            const connectorBalanceAfter = await justToken.balanceOf(deployedConnector.target);

            expect(totalSupplyBefore).to.equal(totalSupplyAfter);
            expect(userBalanceBefore - amountToBridge).to.equal(userBalanceAfter);
            expect(executorBalanceBefore + feeAmount).to.equal(executorBalanceAfter);
            expect(connectorBalanceBefore + amountToBridge - feeAmount).to.equal(connectorBalanceAfter);
        });
    });

    describe("UTS DeploymentRouter", function () {
        describe("Deploy", function () {
            it("Init settings", async function () {
                const { dRouter, factory, masterRouter, priceFeed, registry, paymentToken, deployTokenGas, deployConnectorGas, paymentTokenToNativeRateChainId } = await loadFixture(globalFixture);

                expect(await dRouter.dstFactory(dstChainId)).to.equal(factory.target.toLowerCase());
                expect(await dRouter.MASTER_ROUTER()).to.equal(masterRouter.target);
                expect(await dRouter.PRICE_FEED()).to.equal(priceFeed.target);
                expect(await dRouter.FACTORY()).to.equal(factory.target);
                expect(await dRouter.REGISTRY()).to.equal(registry.target);
                expect(await dRouter.PAYMENT_TOKEN()).to.equal(paymentToken.target);
                expect(await dRouter.EOB_CHAIN_ID()).to.equal(paymentTokenToNativeRateChainId);
                expect(await dRouter.dstTokenDeployGas(dstChainId)).to.equal(deployTokenGas);
                expect(await dRouter.dstConnectorDeployGas(dstChainId)).to.equal(deployConnectorGas);
                expect(await dRouter.protocolVersion()).to.equal(globalProtocolVersion);
            });
        });

        describe("Pausable", function () {
            it("sendDeployRequest", async function () {
                const { masterRouter, priceFeed, paymentToken, admin, router, dRouter, pauserRole } = await loadFixture(globalFixture);

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
                    dstChainId,
                    false,
                    tokenDeployParams
                ]], paymentToken.target
                )).to.be.revertedWithCustomError(dRouter, "EnforcedPause");

                await dRouter.connect(admin).unpause();

                expect(await dRouter.paused()).to.equal(false);

                const paymentTokenBalanceBefore = await paymentToken.balanceOf(admin);
                expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(0n);

                await dRouter.connect(admin).sendDeployRequest([[
                    dstChainId,
                    false,
                    tokenDeployParams
                ]], paymentToken.target);

                const tokenChainIds = [dstChainId];
                const connectorChainIds = [];
                const deployFee = await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
                expect(paymentTokenBalanceBefore - deployFee).to.equal(await paymentToken.balanceOf(admin));
                expect(await paymentToken.balanceOf(await masterRouter.feeCollector())).to.equal(deployFee);
            });

            it("execute", async function () {
                const { endpoint, user, factory, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter, pauserRole } = await loadFixture(globalFixture);

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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);

                await dRouter.connect(admin).unpause();

                expect(await dRouter.paused()).to.equal(false);

                tx = await endpoint.executeOperation([
                    protocolId,
                    0,
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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
                const { user, dRouter } = await loadFixture(globalFixture);

                await expect(dRouter.connect(user).pause(
                )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
            });

            it("unpause", async function () {
                const { user, dRouter } = await loadFixture(globalFixture);

                await expect(dRouter.connect(user).unpause(
                )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
            });

            it("setDstDeployConfig", async function () {
                const { user, dRouter } = await loadFixture(globalFixture);

                await expect(dRouter.connect(user).setDstDeployConfig(
                    [dstChainId],
                    [[ethers.zeroPadValue(user.address, 32), 99999n, 99999n, 0n]]
                )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
            });

            it("setDstDeployGas", async function () {
                const { user, dRouter } = await loadFixture(globalFixture);

                await expect(dRouter.connect(user).setDstDeployGas(
                    [1], [1], [1]
                )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
            });

            it("setDstProtocolFee", async function () {
                const { user, dRouter } = await loadFixture(globalFixture);

                await expect(dRouter.connect(user).setDstProtocolFee(
                    [1], [1]
                )).to.be.revertedWithCustomError(dRouter, "AccessControlUnauthorizedAccount");
            });

            it("setDstFactory", async function () {
                const { user, dRouter } = await loadFixture(globalFixture);

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
                const { user, dRouter } = await loadFixture(globalFixture);

                await expect(dRouter.connect(user).sendDeployRequest(
                    [], dRouter.target
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E0");
            });

            it("UTS DeploymentRouter E1", async function () {
                const { router, user, dRouter } = await loadFixture(globalFixture);

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
                const { user, router, dRouter } = await loadFixture(globalFixture);

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
                const { router, user, dRouter } = await loadFixture(globalFixture);

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
                const { admin, masterRouter, router, user, dRouter, zeroAddress, factory } = await loadFixture(globalFixture);

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
                const { router, user, dRouter } = await loadFixture(globalFixture);

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

            it("Should revert by wrong encoded params", async function () {
                const { router, user, dRouter } = await loadFixture(globalFixture);

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
                    [[dstChainId, true, tokenDeployParams]], dRouter.target
                )).to.be.reverted;

                await expect(dRouter.connect(user).sendDeployRequest(
                    [[dstChainId, false, connectorDeployParams]], dRouter.target
                )).to.be.reverted;

                await expect(dRouter.connect(user).sendDeployRequest(
                    [[dstChainId, true, salt]], dRouter.target
                )).to.be.reverted;

                await expect(dRouter.connect(user).sendDeployRequest(
                    [[dstChainId, false, salt]], dRouter.target
                )).to.be.reverted;

                await expect(dRouter.connect(user).sendDeployRequest(
                    [[dstChainId, true, tokenDeployParams], [dstChainId, false, tokenDeployParams]], dRouter.target
                )).to.be.reverted;

                await expect(dRouter.connect(user).sendDeployRequest(
                    [[dstChainId, false, connectorDeployParams], [dstChainId, true, connectorDeployParams]], dRouter.target
                )).to.be.reverted;

                await expect(dRouter.connect(user).sendDeployRequest(
                    [[dstChainId, true, salt], [dstChainId, false, tokenDeployParams]], dRouter.target
                )).to.be.reverted;

                await expect(dRouter.connect(user).sendDeployRequest(
                    [[dstChainId, false, salt], [dstChainId, false, tokenDeployParams]], dRouter.target
                )).to.be.reverted;
            });

            it("Single token deploy current chain case", async function () {
                const { masterRouter, priceFeed, zeroHash, endpoint, paymentToken, factory, registry, router, user, dRouter } = await loadFixture(globalFixture);

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
                    [curChainId, false, tokenDeployParams]
                ], paymentToken.target);

                const tokenChainIds = [curChainId];
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
                const { priceFeed, masterRouter, zeroHash, endpoint, paymentToken, factory, registry, justToken, router, user, dRouter } = await loadFixture(globalFixture);

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
                    [curChainId, true, connectorDeployParams]
                ], paymentToken.target);

                const tokenChainIds = [];
                const connectorChainIds = [curChainId];
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
                const { priceFeed, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                await paymentToken.connect(admin).transfer(user, await paymentToken.balanceOf(admin));
                await paymentToken.connect(user).approve(dRouter.target, await paymentToken.balanceOf(user));

                const balanceBefore = await paymentToken.balanceOf(user);

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
                    [dstChainId, false, tokenDeployParams]
                ], paymentToken.target);

                const tokenChainIds = [dstChainId];
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
                expect(args[3]).to.equal(dstChainId);
                expect(args[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(args[5]).to.equal(functionSelector);
                expect(args[6]).to.equal(params);
                expect(args[7]).to.equal("0x");

                const hash = await endpoint.getHash(protocolId, dstChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastProposal()).to.equal(hash);
                expect(await registry.totalDeployments()).to.equal(0n);
                expect(balanceBefore).to.above(await paymentToken.balanceOf(user));
            });

            it("Single connector deploy remote chain case", async function () {
                const { priceFeed, justToken, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

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
                    [dstChainId, true, connectorDeployParams]
                ], paymentToken.target);

                const tokenChainIds = [];
                const connectorChainIds = [dstChainId];
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
                expect(args[3]).to.equal(dstChainId);
                expect(args[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(args[5]).to.equal(functionSelector);
                expect(args[6]).to.equal(params);
                expect(args[7]).to.equal("0x");

                const hash = await endpoint.getHash(protocolId, dstChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastProposal()).to.equal(hash);
                expect(await registry.totalDeployments()).to.equal(0n);
                expect(balanceBefore).to.above(await paymentToken.balanceOf(user));
            });

            it("Multi deploy remote chain case", async function () {
                const { priceFeed, justToken, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

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
                    [dstChainId, false, tokenDeployParams],
                    [dstChainId, true, connectorDeployParams]
                ], paymentToken.target);

                const tokenChainIds = [dstChainId];
                const connectorChainIds = [dstChainId];
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
                expect(argsT[3]).to.equal(dstChainId);
                expect(argsT[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(argsT[5]).to.equal(functionSelector);
                expect(argsT[6]).to.equal(paramsT);
                expect(argsT[7]).to.equal("0x");

                expect(argsC[0]).to.equal(protocolId);
                expect(argsC[1]).to.equal(0);
                expect(argsC[2]).to.equal(0);
                expect(argsC[3]).to.equal(dstChainId);
                expect(argsC[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(argsC[5]).to.equal(functionSelector);
                expect(argsC[6]).to.equal(paramsC);
                expect(argsC[7]).to.equal("0x");

                const hash = await endpoint.getHash(protocolId, dstChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, paramsC);

                expect(await endpoint.lastProposal()).to.equal(hash);
                expect(await registry.totalDeployments()).to.equal(0n);
                expect(balanceBefore).to.above(await paymentToken.balanceOf(user));
            });

            it("Multi deploy arbitrary chain case", async function () {
                const { deployTokenGas, deployConnectorGas, priceFeed, justToken, masterRouter, admin, endpoint, paymentToken, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const dstChainIdTwo = 100n;

                await paymentToken.connect(admin).transfer(user, await paymentToken.balanceOf(admin));
                await paymentToken.connect(user).approve(dRouter.target, await paymentToken.balanceOf(user));
                await masterRouter.connect(admin).setDstMasterRouter([dstChainIdTwo], [ethers.zeroPadValue(masterRouter.target, 32)]);

                await dRouter.connect(admin).setDstDeployConfig(
                    [dstChainIdTwo],
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
                    [curChainId, false, tokenDeployParams],
                    [dstChainId, true, connectorDeployParams],
                    [dstChainIdTwo, false, tokenDeployParams],
                    [curChainId, true, connectorDeployParams]
                ], paymentToken.target);

                const tokenChainIds = [curChainId, dstChainIdTwo];
                const connectorChainIds = [curChainId, dstChainId];
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
                expect(argsTD[3]).to.equal(dstChainIdTwo);
                expect(argsTD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(argsTD[5]).to.equal(functionSelector);
                expect(argsTD[6]).to.equal(paramsT);
                expect(argsTD[7]).to.equal("0x");

                expect(argsCD[0]).to.equal(protocolId);
                expect(argsCD[1]).to.equal(0);
                expect(argsCD[2]).to.equal(0);
                expect(argsCD[3]).to.equal(dstChainId);
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

                const hash = await endpoint.getHash(protocolId, dstChainIdTwo, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, paramsT);

                expect(await endpoint.lastProposal()).to.equal(hash);
                expect(await registry.totalDeployments()).to.equal(2n);
                expect(balanceBefore).to.above(await paymentToken.balanceOf(user));
            });

            it("Multi deploy arbitrary chain case native payment", async function () {
                const { paymentToken, deployTokenGas, deployConnectorGas, priceFeed, justToken, masterRouter, admin, endpoint, zeroAddress, factory, registry, router, user, dRouter, protocolId, functionSelector } = await loadFixture(globalFixture);

                const tokenBalanceBefore = await paymentToken.balanceOf(user.address);

                const dstChainIdTwo = 100n;

                await masterRouter.connect(admin).setDstMasterRouter([dstChainIdTwo], [ethers.zeroPadValue(masterRouter.target, 32)]);

                await masterRouter.connect(admin).setFeeCollector(zeroAddress);

                await dRouter.connect(admin).setDstDeployConfig(
                    [dstChainIdTwo],
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

                const tokenChainIds = [curChainId, dstChainIdTwo];
                const connectorChainIds = [curChainId, dstChainId];
                validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

                const deployFee = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);
                const deployFeeNative = await dRouter.estimateDeployNative(tokenChainIds, connectorChainIds);

                expect(deployFee[1]).to.equal(deployFeeNative[2]);

                await expect(dRouter.connect(user).sendDeployRequest([
                    [curChainId, false, tokenDeployParams],
                    [dstChainId, true, connectorDeployParams],
                    [dstChainIdTwo, false, tokenDeployParams],
                    [curChainId, true, connectorDeployParams]
                ], zeroAddress, { value: deployFee[1] - 1n }
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E5");

                const tx = await dRouter.connect(user).sendDeployRequest([
                    [curChainId, false, tokenDeployParams],
                    [dstChainId, true, connectorDeployParams],
                    [dstChainIdTwo, false, tokenDeployParams],
                    [curChainId, true, connectorDeployParams]
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
                expect(argsTD[3]).to.equal(dstChainIdTwo);
                expect(argsTD[4]).to.equal(ethers.zeroPadValue(masterRouter.target, 32));
                expect(argsTD[5]).to.equal(functionSelector);
                expect(argsTD[6]).to.equal(paramsT);
                expect(argsTD[7]).to.equal("0x");

                expect(argsCD[0]).to.equal(protocolId);
                expect(argsCD[1]).to.equal(0);
                expect(argsCD[2]).to.equal(0);
                expect(argsCD[3]).to.equal(dstChainId);
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

                const hash = await endpoint.getHash(protocolId, dstChainIdTwo, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, paramsT);

                expect(await endpoint.lastProposal()).to.equal(hash);
                expect(await registry.totalDeployments()).to.equal(2n);
                expect(etherBalanceBefore).to.above(await ethers.provider.getBalance(user.address));
                expect(tokenBalanceBefore).to.equal(await paymentToken.balanceOf(user.address));
            });
        });

        describe("execute", function () {
            it("UTS DeploymentRouter E2", async function () {
                const { admin, dRouter } = await loadFixture(globalFixture);

                await expect(dRouter.connect(admin).execute(
                    admin,
                    "0xff",
                    "0x"
                )).to.be.revertedWithCustomError(dRouter, "UTSDeploymentRouter__E2");
            });

            it("Should return error code by zero factory address", async function () {
                const { zeroAddress, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(globalFixture);

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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by EOA factory address", async function () {
                const { endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(globalFixture);

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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by incompatible router type", async function () {
                const { adminRole, zeroAddress, registry, factory, executor, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by router zero address", async function () {
                const { routerRole, adminRole, zeroAddress, registry, factory, executor, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by unauthorized factory", async function () {
                const { mockRouter, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(globalFixture);

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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by invalid token deploy params", async function () {
                const { justToken, factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, router, dRouter } = await loadFixture(globalFixture);

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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by invalid connector deploy params", async function () {
                const { factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, admin, router, dRouter } = await loadFixture(globalFixture);

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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by deploy to same address", async function () {
                const { adminRole, registry, executor, factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, zeroAddress, router, dRouter } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by paused factory", async function () {
                const { admin, pauserRole, executor, factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, router, dRouter } = await loadFixture(globalFixture);

                const name = "check0";
                const symbol = "check1";
                const decimals = 12n;
                const initialSupply = withDecimals("1");
                const mintable = false;
                const globalBurnable = false;
                const onlyRoleBurnable = false;
                const feeModule = false;
                const allowedChainIds = [dstChainId];
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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });

            it("Should return error code by invalid protocol version", async function () {
                const { factory, endpoint, user, functionSelector, masterRouter, zeroHash, protocolId, router, dRouter } = await loadFixture(globalFixture);

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
                    dstChainId,
                    0,
                    [zeroHash, zeroHash],
                    0,
                    curChainId,
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

                const hash = await endpoint.getHash(protocolId, curChainId, ethers.zeroPadValue(masterRouter.target, 32), functionSelector, params);

                expect(await endpoint.lastExecution()).to.equal(hash);
            });
        });

        describe("estimateDeployTotal", function () {
            it("Math test", async function () {
                const { admin, priceFeed, dRouter, deployTokenGas, deployConnectorGas, managerRole } = await loadFixture(globalFixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                let tokenChainIds = [1, 10, 56];
                let connectorChainIds = [curChainId, 10, dstChainId];

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

                tokenChainIds = [1, 56, dstChainId];
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

                await dRouter.connect(admin).setDstProtocolFee([81457, 56, dstChainId], [100, 0, 7690]);

                await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);

                const groupId = [4n]
                const prices = [207919288430829661534269173292308851077110717309661052642059096598901248n];

                await priceFeed.connect(admin).setPrices(groupId, prices);

                tokenChainIds = [1, curChainId, 56, dstChainId, 81457, 5000, 8453];
                connectorChainIds = [curChainId, 559999, 17, 1];

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

                await dRouter.connect(admin).setDstProtocolFee([curChainId, 5000, 17], [1000, 3, 7690]);

                await validateDeployFee(tokenChainIds, connectorChainIds, dRouter, priceFeed);
            });

            it("Master test", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstProtocolFee([curChainId, 10, dstChainId], [1000, 1500, 8000]);

                const tokenChainIds = [1, 10, 56];
                const connectorChainIds = [curChainId, 10, dstChainId];

                await dRouter.connect(admin).setDstDeployGas(
                    [1, 10, 56, curChainId, dstChainId],
                    [34000000n, 1000000n, 1000000999n, 1238769n, 500000n],
                    [25000000n, 500000n, 500000999n, 238769n, 400000n]
                );

                const paymentAmount = await dRouter.estimateDeployTotal(tokenChainIds, connectorChainIds);

                expect(paymentAmount[0]).to.equal(1204230637538101189381n);
            });
        });

        describe("estimateDeploy", function () {
            it("Master test", async function () {
                const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstProtocolFee([curChainId, 10, dstChainId], [1000, 1500, 8000]);

                const tokenChainIds = [1, 10, 56];
                const connectorChainIds = [curChainId, 10, dstChainId];

                await dRouter.connect(admin).setDstDeployGas(
                    [1, 10, 56, curChainId, dstChainId],
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
                const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstProtocolFee([curChainId, 10, dstChainId], [1000, 1500, 8000]);

                const tokenChainIds = [1, 10, 56];
                const connectorChainIds = [curChainId, 10, dstChainId];

                await dRouter.connect(admin).setDstDeployGas(
                    [1, 10, 56, curChainId, dstChainId],
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
                const { admin, dRouter, managerRole, priceFeed } = await loadFixture(globalFixture);

                await dRouter.connect(admin).grantRole(managerRole, admin);

                await dRouter.connect(admin).setDstProtocolFee([curChainId, 10, dstChainId], [1000, 1500, 8000]);

                const tokenChainIds = [1, 10, 56];
                const connectorChainIds = [curChainId, 10, dstChainId];

                await dRouter.connect(admin).setDstDeployGas(
                    [1, 10, 56, curChainId, dstChainId],
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
                    const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

                    await dRouter.connect(admin).grantRole(managerRole, admin);

                    await dRouter.connect(admin).setDstProtocolFee([1], [1]);

                    expect(await dRouter.dstProtocolFee(1)).to.equal(1);

                    await dRouter.connect(admin).setDstProtocolFee([1, dstChainId], [9, 999]);

                    expect(await dRouter.dstProtocolFee(1)).to.equal(9);
                    expect(await dRouter.dstProtocolFee(dstChainId)).to.equal(999);
                });

                it("UTS DeploymentRouter E3", async function () {
                    const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

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
                    const { admin, dRouter } = await loadFixture(globalFixture);

                    const newConfig = [
                        ethers.zeroPadValue(dRouter.target, 32),
                        8889789n,
                        1234567n,
                        3333n
                    ];

                    await dRouter.connect(admin).setDstDeployConfig(
                        [dstChainId],
                        [newConfig]
                    );

                    expect(await dRouter.dstDeployConfig(dstChainId)).to.eql(newConfig);
                });

                it("UTS DeploymentRouter E3", async function () {
                    const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

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
                    const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

                    await dRouter.connect(admin).grantRole(managerRole, admin);

                    await dRouter.connect(admin).setDstDeployGas(
                        [dstChainId, curChainId],
                        [1000n, 888n],
                        [500n, 777n]
                    );

                    expect(await dRouter.dstTokenDeployGas(dstChainId)).to.equal(1000n);
                    expect(await dRouter.dstConnectorDeployGas(dstChainId)).to.equal(500n);
                    expect(await dRouter.dstTokenDeployGas(curChainId)).to.equal(888n);
                    expect(await dRouter.dstConnectorDeployGas(curChainId)).to.equal(777n);
                });

                it("UTS DeploymentRouter E3", async function () {
                    const { admin, dRouter, managerRole } = await loadFixture(globalFixture);

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
                    const { admin, dRouter } = await loadFixture(globalFixture);

                    const newAddress = "0x04050b2c873c7c8d2859c07d9f9d7166619873f7376bb93b4fc3c3efb93eec00";
                    const newChainId = 999;

                    await dRouter.connect(admin).setDstFactory(
                        [newChainId],
                        [newAddress]
                    );

                    expect(await dRouter.dstFactory(newChainId)).to.equal(newAddress);
                });

                it("UTS DeploymentRouter E3", async function () {
                    const { admin, dRouter } = await loadFixture(globalFixture);

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

                    await dRouter.connect(admin).setDstFactory([newChainId, curChainId], [newAddress, newAddress]);

                    expect(await dRouter.dstFactory(newChainId)).to.equal(newAddress);
                    expect(await dRouter.dstFactory(curChainId)).to.equal(newAddress);
                });
            });
        });
    });
});