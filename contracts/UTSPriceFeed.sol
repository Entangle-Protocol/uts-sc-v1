// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "./interfaces/IUTSPriceFeed.sol";

/**
 * @notice A contract stores the particular offchain prices for internal UTS protocol V1 calculations.
 *
 * @dev It is an implementation of {UTSPriceFeed} for UUPS.
 */
contract UTSPriceFeed is IUTSPriceFeed, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice {AccessControl} role identifier for price provider addresses.
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

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error UTSPriceFeed__E0();

    /**
     * @notice Emitted when the {_prices} value is updated.
     * @param groupId group Id of packed prices.
     * @param newPrices new {_prices} value for corresponding {groupId}.
     * @param provider the provider address who set the new {_prices} value for corresponding {groupId}.
     */
    event PricesUpdated(uint256 indexed groupId, uint256 newPrices, address indexed provider);

    /**
     * @notice Emitted when the pricePerByte value in the {_chainInfo} is updated.
     * @param chainId chain Id of {_chainInfo}.
     * @param newPricePerByte new pricePerByte value for corresponding {chainId}.
     * @param provider the provider address who set the new pricePerByte value for corresponding {chainId}.
     */
    event PricePerByteUpdated(uint256 indexed chainId, uint256 newPricePerByte, address indexed provider);

    /**
     * @notice Emitted when the {_chainInfo} value is updated.
     * @param chainId chain Id of {_chainInfo}.
     * @param newChainInfo new {_chainInfo} value for corresponding {chainId}.
     * @param caller the caller address who set the new {_chainInfo} value for corresponding {chainId}.
     */
    event ChainInfoUpdated(uint256 indexed chainId, uint256 newChainInfo, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes basic settings with provided parameters.
     * @param defaultAdmin initial {DEFAULT_ADMIN_ROLE} address.
     */
    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Sets packed destination gas prices in wei at source native currency for provided group Ids.
     * @param groupIds group Ids of packed destination gas prices.
     * @param packedPrices packed destination gas prices at source native currency for provided {groupId}.
     * @dev Only addresses with the {PROVIDER_ROLE} can execute this function.
     */
    function setPrices(
        uint256[] calldata groupIds, 
        uint256[] calldata packedPrices
    ) external onlyRole(PROVIDER_ROLE) whenNotPaused() {
        if (groupIds.length != packedPrices.length) revert UTSPriceFeed__E0();
        for (uint256 i; groupIds.length > i; ++i) _setPrices(groupIds[i], packedPrices[i]);
    }

    /**
     * @notice Sets destination price per byte in wei at source native currency for provided chain Ids.
     * @param chainIds chain Ids of {_chainInfo}.
     * @param dstPricePerByteInWei destination price per byte in wei at source native currency for provided {chainId}.
     * @dev Only addresses with the {PROVIDER_ROLE} can execute this function.
     */
    function setDstPricePerByteInWei(
        uint256[] calldata chainIds,
        uint64[] calldata dstPricePerByteInWei
    ) external onlyRole(PROVIDER_ROLE) whenNotPaused() {
        if (chainIds.length != dstPricePerByteInWei.length) revert UTSPriceFeed__E0();
        for (uint256 i; chainIds.length > i; ++i) _setDstPricePerByteInWei(chainIds[i], dstPricePerByteInWei[i]);
    }

    /**
     * @notice Sets the packed {_chainInfo} for provided destination chain Id.
     * @param chainIds destination chain Ids.
     * @param packedChainInfo packed {_chainInfo} for provided destination {chainId}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setChainInfo(
        uint256[] calldata chainIds, 
        uint256[] calldata packedChainInfo
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (chainIds.length != packedChainInfo.length) revert UTSPriceFeed__E0();
        for (uint256 i; chainIds.length > i; ++i) _setChainInfo(chainIds[i], packedChainInfo[i]);
    }

    /**
     * @notice Pauses the {setPrices} and {setDstPricePerByteInWei} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {setPrices} and {setDstPricePerByteInWei} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSPriceFeed).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the destination gas price and price per byte in wei at source native currency for provided 
     * destination chain Id.
     * @param chainId destination chain Id.
     * @return dstGasPrice unpacked destination gas price in wei at source native currency for provided {chainId}.
     * @return dstPricePerByte unpacked destination price per byte in wei at source native currency for provided {chainId}.
     */
    function getPrices(uint256 chainId) external view returns(uint256 dstGasPrice, uint256 dstPricePerByte) {
        Main storage $ = _getMainStorage();
        uint256 _chainInfo = $._chainInfo[chainId];

        return (
            uint64($._prices[uint8(_chainInfo >> 72)] >> (64 * uint8(_chainInfo >> 64))), 
            uint64(_chainInfo)
        );
    }

    /**
     * @notice Returns the destination gas price in wei at source native currency for provided destination chain Id.
     * @param chainId destination chain Id.
     * @return dstGasPrice unpacked destination gas price in wei at source native currency for provided {chainId}.
     */
    function getDstGasPriceAtSrcNative(uint256 chainId) external view returns(uint256 dstGasPrice) {
        Main storage $ = _getMainStorage();

        uint256 _chainInfo = $._chainInfo[chainId];
        return uint64($._prices[uint8(_chainInfo >> 72)] >> (64 * uint8(_chainInfo >> 64)));
    }

    /**
     * @notice Returns the destination price per byte in wei at source native currency for provided destination chain Id.
     * @param chainId destination chain Id.
     * @return Unpacked destination price per byte in wei at source native currency for provided {chainId}.
     */
    function getDstPricePerByteInWei(uint256 chainId) external view returns(uint64) {
        Main storage $ = _getMainStorage();
        return uint64($._chainInfo[chainId]);
    }

    /**
     * @notice Returns the unpacked chain config for provided destination chain Id.
     * @param chainId destination chain Id.
     * @return reserved unused reserved space.
     * @return groupId group Id of packed {_prices} for provided destination {chainId}.
     * @return slotOffset offset value of packed price in the {_prices} at {groupId} for provided destination {chainId}.
     * @return pricePerByte unpacked destination price per byte in wei at source native currency for provided {chainId}.
     */
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

    /**
     * @notice Returns the destination gas price in wei at source native currency from definite storage slot by
     * group Id and offset value.
     * @param groupId group Id of packed destination gas prices.
     * @param offset offset value of packed destination gas price.
     * @return Unpacked destination gas price in wei at source native currency.
     */
    function getPriceByOffset(uint8 groupId, uint8 offset) external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return uint64($._prices[groupId] >> (64 * offset));
    }

    /**
     * @notice Returns unpacked destination gas prices in wei at source native currency for provided group Id.
     * @param groupId group Id of packed destination gas prices.
     * @return Unpacked destination gas price in wei at source native currency (1:64 bits of {_prices}).
     * @return Unpacked destination gas price in wei at source native currency (65:128 bits of {_prices}).
     * @return Unpacked destination gas price in wei at source native currency (129:192 bits of {_prices}).
     * @return Unpacked destination gas price in wei at source native currency (193:256 bits of {_prices}).
     */
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

    /**
     * @notice Returns the packed chain config for provided destination chain Id.
     * @param chainId destination chain Id.
     * @return The packed chain config for provided destination {chainId}.
     */
    function getRawChainInfo(uint256 chainId) external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._chainInfo[chainId];
    }

    /**
     * @notice Returns the packed destination gas prices in wei at source native currency for provided group Id.
     * @param groupId group Id of packed destination gas prices.
     * @return The packed destination gas prices in wei at source native currency for provided {groupId}.
     */
    function getRawPrices(uint256 groupId) external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._prices[groupId];
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

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