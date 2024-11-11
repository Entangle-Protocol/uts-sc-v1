// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./libraries/BytesLib.sol";
import "./libraries/UTSCoreDataTypes.sol";

import "./interfaces/IUTSRegistry.sol";

contract UTSRegistry is IUTSRegistry, AccessControlUpgradeable, UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using BytesLib for bytes;

    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSRegistry.Main
    struct Main {
        /// @dev registered deployments
        EnumerableSet.AddressSet _deployments;
        EnumerableSet.AddressSet _underlyingTokens;
        mapping(uint256 index => address deploymentAddress) _deploymentByIndex;
        mapping(address deployment => DeploymentData) _deploymentData;
        mapping(address underlyingToken => EnumerableSet.AddressSet deploymentsAddresses) _deploymentsByUnderlying;
        mapping(bytes deployer => EnumerableSet.AddressSet deploymentsAddresses) _deploymentsByDeployer;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSRegistry.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x34c54c412898cb0c4b3c503b0c88b6ac073a7a2636fe835a402241e611fd4500;

    error UTSRegistry__E0();     // {deployer} zero address
    error UTSRegistry__E1();     // only registered deployments allowed

    event Registered(
        address deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer,
        address indexed underlyingToken, 
        bytes2 indexed protocolVersion
    );
    event DeploymentUpdated(
        address indexed deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer, 
        address underlyingToken, 
        bytes2 indexed protocolVersion
    );
    event ChainConfigUpdated(
        address indexed deployment, 
        uint256[] allowedChainIds, 
        ChainConfig[] chainConfigs
    );
    event RouterUpdated(address indexed deployment, address indexed newRouter);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function registerDeployment(
        address deployment, 
        bytes calldata deployer, 
        address underlyingToken,
        bytes2 protocolVersion
    ) external onlyRole(FACTORY_ROLE) {
        _addDeployment(deployment, deployer, underlyingToken, protocolVersion);
    }

    function approveRequestBatch(ApproveRequestData[] calldata requests) external onlyRole(APPROVER_ROLE) returns(bool) {
        for (uint256 i; requests.length > i; ++i) {
            _addDeployment(
                requests[i].deployment,
                requests[i].deployer,
                requests[i].underlyingToken,
                requests[i].protocolVersion
            );
        }

        return true;
    }

    function updateChainConfigs(uint256[] calldata allowedChainIds, ChainConfig[] calldata chainConfigs) external {
        if (deploymentData(msg.sender).deployer.length == 0) revert UTSRegistry__E1();

        emit ChainConfigUpdated(msg.sender, allowedChainIds, chainConfigs);
    }

    function updateRouter(address newRouter) external {
        if (deploymentData(msg.sender).deployer.length == 0) revert UTSRegistry__E1();

        emit RouterUpdated(msg.sender, newRouter);
    }

    function validateUnderlyingRegistered(address underlyingToken) external view returns(bool) {
        Main storage $ = _getMainStorage();
        return $._underlyingTokens.contains(underlyingToken);
    }

    function validateDeploymentRegistered(address deployment) external view returns(bool) {
        return deploymentData(deployment).deployer.length != 0;
    }

    function validateFactory(address target) external view returns(bool) {
        return hasRole(FACTORY_ROLE, target);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSRegistry).interfaceId || super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function deploymentData(address deployment) public view returns(DeploymentData memory) {
        Main storage $ = _getMainStorage();
        return $._deploymentData[deployment];
    }

    function totalDeployments() external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._deployments.length();
    }

    function underlyingTokens() external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._underlyingTokens.values();
    }

    function deployments() external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._deployments.values();
    }

    function deploymentsByIndex(uint256[] calldata indexes) external view returns(address[] memory deploymentsAdresses) {
        Main storage $ = _getMainStorage();
        deploymentsAdresses = new address[](indexes.length);
        for (uint256 i; indexes.length > i; ++i) deploymentsAdresses[i] = $._deploymentByIndex[indexes[i]];
    }

    function deploymentsByUnderlying(address underlyingToken) external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._deploymentsByUnderlying[underlyingToken].values();
    }

    function deploymentsByDeployer(bytes calldata deployer) external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._deploymentsByDeployer[deployer].values();
    }

    function _addDeployment(
        address deployment, 
        bytes calldata deployer, 
        address underlyingToken, 
        bytes2 protocolVersion
    ) internal {
        if (deployer.length == 0) revert UTSRegistry__E0();
        Main storage $ = _getMainStorage();

        if ($._deploymentData[deployment].deployer.length == 0) {
            $._deploymentData[deployment].underlyingToken = underlyingToken;
            
            $._underlyingTokens.add(underlyingToken);
            $._deploymentsByUnderlying[underlyingToken].add(deployment);

            $._deploymentByIndex[$._deployments.length()] = deployment;
            $._deployments.add(deployment);

            emit Registered(deployment, deployer, deployer, underlyingToken, protocolVersion);
        } else {

            if (!$._deploymentData[deployment].deployer.equalStorage(deployer)) {
                $._deploymentsByDeployer[$._deploymentData[deployment].deployer].remove(deployment);
            }

            emit DeploymentUpdated(
                deployment, 
                deployer, 
                deployer,
                $._deploymentData[deployment].underlyingToken, 
                protocolVersion
            );
        }

        $._deploymentsByDeployer[deployer].add(deployment);
        $._deploymentData[deployment].deployer = deployer;
        $._deploymentData[deployment].initProtocolVersion = protocolVersion;
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}