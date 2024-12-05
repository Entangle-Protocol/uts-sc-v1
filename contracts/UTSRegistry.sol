// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "./libraries/BytesLib.sol";
import "./libraries/UTSCoreDataTypes.sol";

import "./interfaces/IUTSRegistry.sol";

/**
 * @notice A contract stores the metadata of registered UTS compatible contracts.
 *
 * @dev It is an implementation of {UTSRegistry} for UUPS.
 */
contract UTSRegistry is IUTSRegistry, AccessControlUpgradeable, UUPSUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using BytesLib for bytes;

    /// @notice {AccessControl} role identifier for approver addresses.
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    /// @notice {AccessControl} role identifier for UTS factory addresses.
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSRegistry.Main
    struct Main {
        EnumerableSet.AddressSet _deployments;
        EnumerableSet.AddressSet _underlyingTokens;
        mapping(uint256 index => address deploymentAddress) _deploymentByIndex;
        mapping(address deployment => DeploymentData) _deploymentData;
        mapping(address underlyingToken => EnumerableSet.AddressSet deploymentsAddresses) _deploymentsByUnderlying;
        mapping(bytes deployer => EnumerableSet.AddressSet deploymentsAddresses) _deploymentsByDeployer;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSRegistry.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x34c54c412898cb0c4b3c503b0c88b6ac073a7a2636fe835a402241e611fd4500;

    /// @notice Indicates an error that the provided {deployer} address is empty.
    error UTSRegistry__E0();

    /// @notice Indicates an error that the function caller is not a registered deployment.
    error UTSRegistry__E1();

    /**
     * @notice Emitted when a new UTS compatible contract is registered.
     * @param deployment newly registered UTS compatible contract address.
     * @param deployerIndexed indexed deployer address.
     * @param deployer deployer address.
     * @param underlyingToken underlying token address.
     * @param protocolVersion UTS protocol version.
     */
    event Registered(
        address deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer,
        address indexed underlyingToken, 
        bytes2 indexed protocolVersion
    );

    /**
     * @notice Emitted when a metadata of registered UTS compatible contract is updated.
     * @param deployment registered UTS compatible contract address.
     * @param deployerIndexed indexed deployer address.
     * @param deployer deployer address.
     * @param underlyingToken underlying token address.
     * @param protocolVersion new UTS protocol version.
     */
    event DeploymentUpdated(
        address indexed deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer, 
        address underlyingToken, 
        bytes2 indexed protocolVersion
    );

    /**
     * @notice Emitted when {ChainConfig} settings of registered {UTSToken} or {UTSConnector} are updated.
     * @param deployment the registered {UTSToken} or {UTSConnector} contract address.
     * @param allowedChainIds new chains Ids available for bridging in both directions.
     * @param chainConfigs array of new {ChainConfig} settings for corresponding {allowedChainIds}.
     * @dev See the {UTSERC20DataTypes.ChainConfig} for details.
     */
    event ChainConfigUpdated(
        address indexed deployment, 
        uint256[] allowedChainIds, 
        ChainConfig[] chainConfigs
    );

    /**
     * @notice Emitted when the {_router} address of registered UTS compatible contract is updated.
     * @param deployment the registered UTS compatible contract address.
     * @param newRouter new {_router} address.
     */
    event RouterUpdated(address indexed deployment, address indexed newRouter);

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

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @notice Registers a new UTS compatible contract with provided metadata.
     * @param deployment UTS compatible contract address.
     * @param deployer deployer address.
     * @param underlyingToken underlying token address.
     * @param protocolVersion UTS protocol version.
     * @dev Only addresses with the {FACTORY_ROLE} can execute this function.
     */
    function registerDeployment(
        address deployment, 
        bytes calldata deployer, 
        address underlyingToken,
        bytes2 protocolVersion
    ) external onlyRole(FACTORY_ROLE) {
        _addDeployment(deployment, deployer, underlyingToken, protocolVersion);
    }

    /**
     * @notice Manually registers a new UTS compatible contracts with provided metadata.
     * @param requests array of {ApproveRequestData} UTS compatible contracts metadata, containing:
     *        deployment: UTS compatible contract address
     *        deployer: deployer address
     *        underlyingToken: underlying token contract address
     *        protocolVersion: UTS protocol version
     * @dev See the {UTSCoreDataTypes.ApproveRequestData} for details.
     * @dev Only addresses with the {APPROVER_ROLE} can execute this function.
     */
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

    /**
     * @notice Emits the event when {ChainConfig} settings of registered {UTSToken} or {UTSConnector} are updated.
     * @param allowedChainIds new chains Ids available for bridging in both directions.
     * @param chainConfigs array of new {ChainConfig} settings for corresponding {allowedChainIds}.
     * @dev See the {UTSERC20DataTypes.ChainConfig} for details.
     * @dev Only registered UTS compatible contracts can execute this function.
     */
    function updateChainConfigs(uint256[] calldata allowedChainIds, ChainConfig[] calldata chainConfigs) external {
        if (deploymentData(msg.sender).deployer.length == 0) revert UTSRegistry__E1();

        emit ChainConfigUpdated(msg.sender, allowedChainIds, chainConfigs);
    }

    /**
     * @notice Emits the event when the {_router} address of registered UTS compatible contract is updated.
     * @param newRouter new {_router} address.
     * @dev Only registered UTS compatible contracts can execute this function.
     */
    function updateRouter(address newRouter) external {
        if (deploymentData(msg.sender).deployer.length == 0) revert UTSRegistry__E1();

        emit RouterUpdated(msg.sender, newRouter);
    }

    /**
     * @notice Returns whether any registered UTS compatible contract uses the provided {underlyingToken} contract.
     * @param underlyingToken {underlyingToken} contract address.
     * @return isRegistered result.
     */
    function validateUnderlyingRegistered(address underlyingToken) external view returns(bool isRegistered) {
        Main storage $ = _getMainStorage();
        return $._underlyingTokens.contains(underlyingToken);
    }

    /**
     * @notice Returns whether the provided {deployment} contract is registered UTS compatible contract.
     * @param deployment target contract address.
     * @return isRegistered result.
     */
    function validateDeploymentRegistered(address deployment) external view returns(bool isRegistered) {
        return deploymentData(deployment).deployer.length != 0;
    }

    /**
     * @notice Returns whether provided {target} address has the {AccessControl.FACTORY_ROLE}.
     * @param target target contract address.
     * @return isAuthorized result.
     */
    function validateFactory(address target) external view returns(bool isAuthorized) {
        return hasRole(FACTORY_ROLE, target);
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSRegistry).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns a metadata of provided registered UTS compatible contract address.
     * @param deployment registered UTS compatible contract address.
     * @return Metadata {DeploymentData} of provided registered UTS compatible contract address.
     * @dev See the {UTSCoreDataTypes.DeploymentData} for details.
     */
    function deploymentData(address deployment) public view returns(DeploymentData memory) {
        Main storage $ = _getMainStorage();
        return $._deploymentData[deployment];
    }

    /**
     * @notice Returns the total number of registered UTS compatible contracts.
     * @return Total number of registered UTS compatible contracts.
     */
    function totalDeployments() external view returns(uint256) {
        Main storage $ = _getMainStorage();
        return $._deployments.length();
    }

    /**
     * @notice Returns all underlying tokens that used by UTS compatible contracts.
     * @return Array of addresses of all {underlyingToken} that used by UTS compatible contracts.
     */
    function underlyingTokens() external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._underlyingTokens.values();
    }

    /**
     * @notice Returns all registered UTS compatible contracts.
     * @return Array of addresses of all registered UTS compatible contracts.
     */
    function deployments() external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._deployments.values();
    }

    /**
     * @notice Returns registered UTS compatible contracts addresses for provided indexes.
     * @return deploymentsAdresses array of addresses of registered UTS compatible contracts for provided {indexes}.
     */
    function deploymentsByIndex(uint256[] calldata indexes) external view returns(address[] memory deploymentsAdresses) {
        Main storage $ = _getMainStorage();
        deploymentsAdresses = new address[](indexes.length);
        for (uint256 i; indexes.length > i; ++i) deploymentsAdresses[i] = $._deploymentByIndex[indexes[i]];
    }

    /**
     * @notice Returns registered UTS compatible contracts that uses provided underlying token contract.
     * @return Array of addresses of registered UTS compatible contracts that uses provided {underlyingToken} contract.
     */
    function deploymentsByUnderlying(address underlyingToken) external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._deploymentsByUnderlying[underlyingToken].values();
    }

    /**
     * @notice Returns registered UTS compatible contracts that deployed by provided deployer.
     * @return Array of addresses of registered UTS compatible contracts that deployed by provided {deployer} address.
     */
    function deploymentsByDeployer(bytes calldata deployer) external view returns(address[] memory) {
        Main storage $ = _getMainStorage();
        return $._deploymentsByDeployer[deployer].values();
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

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