// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../libraries/UTSCoreDataTypes.sol";
import "../libraries/UTSERC20DataTypes.sol";

contract RouterImplMock is UUPSUpgradeable {

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSRouter.Main
    struct Main {
        mapping(uint256 chainId => uint64) _dstMinGasLimit;
        mapping(uint256 chainId => uint16) _dstProtocolFee;
        mapping(uint256 chainId => uint64) _dstUpdateGas;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3fb4de75078a1dcbe9ae3da4a8b51c7f6a145aae2899508efdf94f16ebd0e000;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract FactoryImplMock is UUPSUpgradeable {

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSFactory.Main
    struct Main {
        address _router;
        mapping(uint256 blueprintId => address) _codeStorage;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSFactory.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xcc4154715de11014e2fc2b9a91f0be7b1928d6f735a27ddfce6492aefc2bc500;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function router() public view returns(address) {
        Main storage $ = _getMainStorage();
        return $._router;
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract RegistryImplMock is UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSRegistry.Main
    struct Main {
        /// @dev registered deployments
        EnumerableSet.AddressSet _deployments;
        EnumerableSet.AddressSet _underlyingTokens;
        mapping(uint256 index => address) _deploymentByIndex;
        mapping(address deployment => DeploymentData) _deploymentData;
        mapping(address underlyingToken => EnumerableSet.AddressSet) _deploymentsByUnderlying;
        mapping(address deployer => EnumerableSet.AddressSet) _deploymentsByDeployer;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSRegistry.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x34c54c412898cb0c4b3c503b0c88b6ac073a7a2636fe835a402241e611fd4500;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function totalDeployments() public view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._deployments.length();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract MasterRouterImplMock is UUPSUpgradeable {

    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSMasterRouter.Main
    struct Main {
        address _feeCollector;
        mapping(uint256 chainId => bytes) _dstMasterRouter;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSMasterRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x9d0b2f5de8f19fc5177eb3417d724c91bd022aca0743e67245c972a15b745f00;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function feeCollector() external view returns(address) {
        Main storage $ = _getMainStorage();
        return $._feeCollector;
    }

    function _setFeeCollector(address newFeeCollector) internal {
        Main storage $ = _getMainStorage();
        $._feeCollector = newFeeCollector;
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}

contract PriceFeedImplMock is UUPSUpgradeable {

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSPriceFeed.Main
    struct Main {
        /// @dev 256-81 bits reserved, 80-73 groupId, 72-65 price offset, 64-1 pricePerByte
        mapping(uint256 chainId => uint256) _chainInfo;
        mapping(uint256 groupId => uint256) _prices;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSPriceFeed.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x1f7fea0d376375019da79a3a63f3ea5e085e26bbbebed20b09d0c79c503c8b00;

    error UTSPriceFeed__E0();     // arguments length mismatch

    event PricesUpdated(uint256 indexed groupId, uint256 newPrices, address indexed provider);
    event PricePerByteUpdated(uint256 indexed chainId, uint256 newPricePerByte, address indexed provider);
    event ChainInfoUpdated(uint256 indexed chainId, uint256 newChainInfo, address indexed provider);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function setPrices(
        uint256[] calldata groupIds, 
        uint256[] calldata packedPrices
    ) external {
        if (groupIds.length != packedPrices.length) revert UTSPriceFeed__E0();
        for (uint256 i; groupIds.length > i; ++i) _setPrices(groupIds[i], packedPrices[i]);
    }

    function setDstPricePerByteInWei(
        uint256[] calldata chainIds,
        uint64[] calldata dstPricePerByteInWei
    ) external {
        if (chainIds.length != dstPricePerByteInWei.length) revert UTSPriceFeed__E0();
        for (uint256 i; chainIds.length > i; ++i) _setDstPricePerByteInWei(chainIds[i], dstPricePerByteInWei[i]);
    }

    function setChainInfo(uint256 chainId, uint256 packedChainInfo) external {
        _setChainInfo(chainId, packedChainInfo);
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

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

        if (chainId == 31337) return(17, 27, 37, 47);

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

contract DeploymentRouterImplMock is UUPSUpgradeable {

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSDeploymentRouter.Main
    struct Main {
        mapping(uint256 chainId => DstDeployConfig) _dstDeployConfig;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSDeploymentRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x5ef83cde492754da3fd6bddb04f9c0eea61921570db6556ef7bb11412c3f9000;
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0xffff;
    }

    function dstTokenDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].tokenDeployGas;
    }

    function dstConnectorDeployGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].connectorDeployGas;
    }

    function dstProtocolFee(uint256 dstchainId) public view returns(uint16) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstchainId].protocolFee;
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override {

    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}