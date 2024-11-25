const UTSMasterRouterProxyModule = require("../../ignition/modules/UTSMasterRouterProxyModule");
const UTSPriceFeedProxyModule = require("../../ignition/modules/UTSPriceFeedProxyModule");
const UTSRegistryProxyModule = require("../../ignition/modules/UTSRegistryProxyModule");

const withDecimals = ethers.parseEther;
const testCurChainId = 31337;
const testDstChainId = 137;

async function coreFixture() {
    const [admin, user, executor, feeCollector] = await ethers.getSigners();

    const EndpointMock = await ethers.getContractFactory("EndpointMock", admin);
    const endpoint = await EndpointMock.deploy();
    await endpoint.waitForDeployment();

    const initCalldata = ethers.id('initialize(address)').substring(0, 10) + ethers.zeroPadValue(admin.address, 32).slice(2);

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

    const { priceFeedProxy } = await ignition.deploy(UTSPriceFeedProxyModule, {
        parameters: {
            UTSPriceFeedProxyModule: {
                initializeCalldata: initCalldata,
            },
        },
    });

    const registry = await ethers.getContractAt("UTSRegistry", registryProxy);
    const masterRouter = await ethers.getContractAt("UTSMasterRouter", masterRouterProxy);
    const priceFeed = await ethers.getContractAt("UTSPriceFeed", priceFeedProxy);

    const adminRole = await registry.DEFAULT_ADMIN_ROLE();
    const approverRole = await registry.APPROVER_ROLE();
    const factoryRole = await registry.FACTORY_ROLE();
    const routerRole = await masterRouter.ROUTER_ROLE();
    const providerRole = await priceFeed.PROVIDER_ROLE();

    const groupId = [1n, 2n, 3n, 4n]
    const prices = [
        1129878312369602537502204908980629571524956592795160865310248716800000n,
        207919288430829661534269173292308851077110717309661052642059096598901248n,
        1967466187033702554253712744551684260132822172337025861599922503609177n,
        62017011138835482832437730536824915658235399606085787397919460150518842n
    ];

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

    await masterRouter.connect(admin).setFeeCollector(feeCollector);
    await masterRouter.connect(admin).setDstMasterRouter([testDstChainId], [ethers.zeroPadValue(masterRouter.target, 32)]);
    await priceFeed.connect(admin).grantRole(providerRole, admin);
    await priceFeed.connect(admin).setPrices(groupId, prices);

    const zeroHash = ethers.ZeroHash;
    const zeroAddress = ethers.ZeroAddress;
    const protocolId = "0x4554530000000000000000000000000000000000000000000000000000000000";
    const functionSelector = "0x002030faa25900000000000000000000000000000000000000000000000000000000";

    const baseFeePerGasInWei = await priceFeed.getDstGasPriceAtSrcNative(testDstChainId);

    return {
        admin, user, executor, registry, zeroHash, zeroAddress, adminRole, approverRole, factoryRole, routerRole, endpoint, masterRouter,
        protocolId, functionSelector, providerRole, baseFeePerGasInWei, feeCollector, priceFeed, prices, groupId, initCalldata

    };
};

module.exports = { coreFixture, testCurChainId, testDstChainId, withDecimals };