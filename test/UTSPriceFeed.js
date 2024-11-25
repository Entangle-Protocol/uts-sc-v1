const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

const { ERC20Fixture, testDstChainId } = require("./utils/ERC20Fixture");
const { validateBridgeFee } = require("./utils/ERC20UtilFunctions");

describe("UTS PriceFeed", function () {
    describe("AccessControl", function () {
        it("setPrices", async function () {
            const { user, priceFeed } = await loadFixture(ERC20Fixture);

            await expect(priceFeed.connect(user).setPrices(
                [],
                []
            )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
        });

        it("setDstPricePerByteInWei", async function () {
            const { user, priceFeed } = await loadFixture(ERC20Fixture);

            await expect(priceFeed.connect(user).setDstPricePerByteInWei(
                [],
                []
            )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
        });

        it("setChainInfo", async function () {
            const { user, priceFeed } = await loadFixture(ERC20Fixture);

            await expect(priceFeed.connect(user).setChainInfo(
                [1],
                [1]
            )).to.be.revertedWithCustomError(priceFeed, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Pausable", function () {
        it("pause", async function () {
            const { priceFeed, admin, pauserRole, providerRole } = await loadFixture(ERC20Fixture);

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
            const { user, priceFeed, admin, pauserRole, providerRole } = await loadFixture(ERC20Fixture);

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
            const { admin, priceFeed } = await loadFixture(ERC20Fixture);

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
            const { admin, priceFeed } = await loadFixture(ERC20Fixture);

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
            const { admin, priceFeed } = await loadFixture(ERC20Fixture);

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
            const { priceFeed, prices, groupId } = await loadFixture(ERC20Fixture);

            expect(await priceFeed.getDstGasPriceAtSrcNative(0)).to.equal(0);
            expect(await priceFeed.getDstGasPriceAtSrcNative(1)).to.equal(1000000000000);
            expect(await priceFeed.getDstGasPriceAtSrcNative(2)).to.equal(0);
            expect(await priceFeed.getDstGasPriceAtSrcNative(10)).to.equal(500000000000);
            expect(await priceFeed.getDstGasPriceAtSrcNative(56)).to.equal(34567800000);
            expect(await priceFeed.getDstGasPriceAtSrcNative(100)).to.equal(180000000000);
            expect(await priceFeed.getDstGasPriceAtSrcNative(testDstChainId)).to.equal(5000000000);
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
            expect(await priceFeed.getRawChainInfo(testDstChainId)).to.equal(9444732965739290427392n);
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
            expect(await priceFeed.getChainInfo(testDstChainId)).to.eql([0n, 2n, 0n, 0n]);
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
            const { priceFeed, admin } = await loadFixture(ERC20Fixture);

            const chainIds = [1, 10, 56, 100, testDstChainId, 5000, 8453, 42161, 59144, 569999];
            const pricesPerByte = [199n, 299n, 399n, 499n, 599n, 0n, 699n, 799n, 899n, 999n];

            await priceFeed.connect(admin).setDstPricePerByteInWei(chainIds, pricesPerByte);

            expect(await priceFeed.getDstPricePerByteInWei(0)).to.equal(0);
            expect(await priceFeed.getDstPricePerByteInWei(1)).to.equal(pricesPerByte[0]);
            expect(await priceFeed.getDstPricePerByteInWei(10)).to.equal(pricesPerByte[1]);
            expect(await priceFeed.getDstPricePerByteInWei(56)).to.equal(pricesPerByte[2]);
            expect(await priceFeed.getDstPricePerByteInWei(100)).to.equal(pricesPerByte[3]);
            expect(await priceFeed.getDstPricePerByteInWei(testDstChainId)).to.equal(pricesPerByte[4]);
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
            expect(await priceFeed.getChainInfo(testDstChainId)).to.eql([0n, 2n, 0n, pricesPerByte[4]]);
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
            expect(await priceFeed.getPrices(testDstChainId)).to.eql([5000000000n, pricesPerByte[4]]);
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
            const { router, priceFeed, admin } = await loadFixture(ERC20Fixture);

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
            expect(await priceFeed.getDstGasPriceAtSrcNative(testDstChainId)).to.equal(5000000000);
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
            const { router, priceFeed, admin } = await loadFixture(ERC20Fixture);

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