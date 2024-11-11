// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "./interfaces/IUTSPriceFeed.sol";

contract UTSPriceFeed is IUTSPriceFeed, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSPriceFeed.Main
    struct Main {
        /// @dev 256-81 bits reserved, 80-73 groupId, 72-65 price offset, 64-1 pricePerByte
        mapping(uint256 chainId => uint256 packedChainInfo) _chainInfo;
        /// @dev 4 prices packed 64 bits each
        mapping(uint256 groupId => uint256 packedPrices) _prices;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSPriceFeed.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x1f7fea0d376375019da79a3a63f3ea5e085e26bbbebed20b09d0c79c503c8b00;

    error UTSPriceFeed__E0();     // arguments length mismatch

    event PricesUpdated(uint256 indexed groupId, uint256 newPrices, address indexed provider);
    event PricePerByteUpdated(uint256 indexed chainId, uint256 newPricePerByte, address indexed provider);
    event ChainInfoUpdated(uint256 indexed chainId, uint256 newChainInfo, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);

        // TODO: chainIds
        _setChainInfo(1,      4722366482869645213696);
        _setChainInfo(10,     4740813226943354765312);
        _setChainInfo(56,     4759259971017064316928);
        _setChainInfo(100,    4777706715090773868544);
        _setChainInfo(137,    9444732965739290427392);
        _setChainInfo(5000,   9463179709812999979008);
        _setChainInfo(8453,   9481626453886709530624);
        _setChainInfo(42161,  9500073197960419082240);
        _setChainInfo(43114,  14167099448608935641088);
        _setChainInfo(59144,  14185546192682645192704);
        _setChainInfo(81457,  14203992936756354744320);
        _setChainInfo(534352, 14222439680830064295936);
        _setChainInfo(33033,  18889465931478580854784);
        _setChainInfo(559999, 18907912675552290406400);
        _setChainInfo(569999, 18926359419625999958016);
        _setChainInfo(570001, 18944806163699709509632);
    }

    function setPrices(
        uint256[] calldata groupIds, 
        uint256[] calldata packedPrices
    ) external onlyRole(PROVIDER_ROLE) whenNotPaused() {
        if (groupIds.length != packedPrices.length) revert UTSPriceFeed__E0();
        for (uint256 i; groupIds.length > i; ++i) _setPrices(groupIds[i], packedPrices[i]);
    }

    function setDstPricePerByteInWei(
        uint256[] calldata chainIds,
        uint64[] calldata dstPricePerByteInWei
    ) external onlyRole(PROVIDER_ROLE) whenNotPaused() {
        if (chainIds.length != dstPricePerByteInWei.length) revert UTSPriceFeed__E0();
        for (uint256 i; chainIds.length > i; ++i) _setDstPricePerByteInWei(chainIds[i], dstPricePerByteInWei[i]);
    }

    function setChainInfo(uint256 chainId, uint256 packedChainInfo) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setChainInfo(chainId, packedChainInfo);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSPriceFeed).interfaceId || super.supportsInterface(interfaceId);
    }

    function getPrices(uint256 chainId) external view returns(uint256 dstGasPrice, uint256 dstPricePerByte) {
        Main storage $ = _getMainStorage();
        uint256 _chainInfo = $._chainInfo[chainId];

        return (
            uint64($._prices[uint8(_chainInfo >> 72)] >> (64 * uint8(_chainInfo >> 64))), 
            uint64(_chainInfo)
        );
    }

    function getDstGasPriceAtSrcNative(uint256 chainId) external view returns(uint256 dstGasPrice) {
        Main storage $ = _getMainStorage();

        uint256 _chainInfo = $._chainInfo[chainId];
        return uint64($._prices[uint8(_chainInfo >> 72)] >> (64 * uint8(_chainInfo >> 64)));
    }

    function getDstPricePerByteInWei(uint256 chainId) external view returns(uint64) {
        Main storage $ = _getMainStorage();
        return uint64($._chainInfo[chainId]);
    }

    function getChainInfo(uint256 chainId) external view returns(
        uint176 reserved, 
        uint8 groupId, 
        uint8 slotOffset, 
        uint64 pricePerByte
    ) {
        Main storage $ = _getMainStorage();
        uint256 _chainInfo = $._chainInfo[chainId];

        return (
            uint176(_chainInfo >> 80), 
            uint8(_chainInfo >> 72), 
            uint8(_chainInfo >> 64), 
            uint64(_chainInfo)
        );
    }

    function getPriceByOffset(uint8 groupId, uint8 offset) external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return uint64($._prices[groupId] >> (64 * offset));
    }

    function getGroupPrices(uint8 groupId) external view returns(uint256, uint256, uint256, uint256) {
        Main storage $ = _getMainStorage();
        uint256 _packedPrices = $._prices[groupId];

        return (
            uint64(_packedPrices >> (64 * 0)),
            uint64(_packedPrices >> (64 * 1)),
            uint64(_packedPrices >> (64 * 2)),
            uint64(_packedPrices >> (64 * 3))
        );
    }

    function getRawChainInfo(uint256 chainId) external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._chainInfo[chainId];
    }

    function getRawPrices(uint256 groupId) external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._prices[groupId];
    }

    function _setPrices(uint256 groupId, uint256 packedPrices) internal {
        Main storage $ = _getMainStorage();
        $._prices[groupId] = packedPrices;

        emit PricesUpdated(groupId, packedPrices, msg.sender);
    }

    function _setChainInfo(uint256 chainId, uint256 newChainInfo) internal {
        Main storage $ = _getMainStorage();
        $._chainInfo[chainId] = newChainInfo;

        emit ChainInfoUpdated(chainId, newChainInfo, msg.sender);
    }

    function _setDstPricePerByteInWei(uint256 chainId, uint64 newDstPricePerByteInWei) internal {
        Main storage $ = _getMainStorage();
        $._chainInfo[chainId] = ($._chainInfo[chainId] >> 64 << 64) + newDstPricePerByteInWei;

        emit PricePerByteUpdated(chainId, newDstPricePerByteInWei, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}