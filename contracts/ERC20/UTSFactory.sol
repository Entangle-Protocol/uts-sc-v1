// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

import "../libraries/UTSERC20DataTypes.sol";
import "../libraries/AddressConverter.sol";

import "./interfaces/IUTSToken.sol";
import "./interfaces/IUTSFactory.sol";
import "./interfaces/IUTSConnector.sol";
import "./interfaces/IUTSCodeStorage.sol";
import "../interfaces/IUTSRegistry.sol";
import "../interfaces/IUTSMasterRouter.sol";

/**
 * @notice A contract allows to deploy UTSToken and UTSConnector contracts with various settings.
 *
 * @dev It is an implementation of {UTSFactory} for UUPS.
 * The {UTSFactory} only deploys the specified bytecode, which stores in external code storage contracts.
 */
contract UTSFactory is IUTSFactory, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using Create2 for *;
    using AddressConverter for *;

    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Address of the {UTSMasterRouter} contract.
    address public immutable MASTER_ROUTER;

    /// @notice Address of the {UTSRegistry} contract.
    address public immutable REGISTRY;

    /**
     * @notice Enum defines the types (blueprints) of deployments supported by the {UTSFactory}.
     * @dev Various {UTSToken} or {UTSConnector} blueprints containing:
     *      Standard: basic {UTSToken} using mint/burn mechanism or {UTSConnector} using lock/unlock mechanism for bridging
     *      MintableToken: free-mintable by owner {UTSToken} using mint/burn mechanism for bridging
     *      TokenWithFee: {UTSToken} using mint/burn mechanism for bridging and supporting fee deducting
     *      MintableTokenWithFee: free-mintable by owner {UTSToken} using mint/burn mechanism for bridging and supporting fee deducting
     *      PureToken: non-mintable {UTSToken} using lock/unlock mechanism for bridging
     *      ConnectorWithFee: {UTSConnector} using lock/unlock mechanism for bridging and supporting fee deducting
     */
    enum DeploymentType {
        Standard,
        MintableToken,
        TokenWithFee,
        MintableTokenWithFee,
        PureToken,
        ConnectorWithFee
    }

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSFactory.Main
    struct Main {
        address _router;
        mapping(uint8 blueprintId => address codeStorageAddress) _codeStorage;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSFactory.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0xcc4154715de11014e2fc2b9a91f0be7b1928d6f735a27ddfce6492aefc2bc500;
    
    /// @notice Indicates an error that the function caller is not the {_router}.
    error UTSFactory__E0();
    
    /// @notice Indicates an error that the precalculated {deployment} address has a deployed bytecode.
    error UTSFactory__E1();
    
    /// @notice Indicates an error that the provided {DeployTokenData} contains unsupported {UTSToken} configuration to deploy.
    error UTSFactory__E2();
    
    /// @notice Indicates an error that lengths of provided arrays do not match.
    error UTSFactory__E3();
    
    /// @notice Indicates an error that the provided {DeployTokenData.mintedAmountToOwner} exceeds the {DeployTokenData.initialSupply}.
    error UTSFactory__E4();

    /**
     * @notice Emitted when the {_router} address is updated.
     * @param newRouter new {_router} address.
     * @param caller the caller address who set the new {_router} address.
     */
    event DeploymentRouterSet(address newRouter, address indexed caller);

    /**
     * @notice Emitted when the {_codeStorage} address for corresponding {blueprintId} is updated.
     * @param blueprintId {DeploymentType} blueprint Id.
     * @param newCodeStorage new {_codeStorage} address.
     * @param caller the caller address who set the new {_codeStorage} address.
     * @dev See the {DeploymentType} for details.
     */
    event CodeStorageSet(uint8 indexed blueprintId, address newCodeStorage, address indexed caller);

    /**
     * @notice Emitted when a new {UTSToken} or {UTSConnector} is deployed.
     * @param deployment newly {UTSToken} or {UTSConnector} deployed contract address.
     * @param deployerIndexed indexed source chain {msg.sender} address.
     * @param deployer source chain {msg.sender} address.
     * @param owner initial owner of deployed contract.
     * @param underlyingToken underlying ERC20 token address.
     * @param salt value used for precalculation of new deployment contract address.
     * @param name the name of the {UTSToken} token (in the case of token deployment).
     * @param symbol the symbol of the {UTSToken} token (in the case of token deployment).
     * @param decimals the decimals of the {UTSToken} token (in the case of token deployment).
     */
    event Deployed(
        address deployment, 
        bytes indexed deployerIndexed, 
        bytes deployer,
        address indexed owner, 
        address indexed underlyingToken,
        bytes32 salt,
        string name, 
        string symbol,
        uint8 decimals
    );

    /**
     * @notice Initializes immutable variables.
     * @param masterRouter address of the {UTSMasterRouter} contract.
     * @param registry address of the {UTSRegistry} contract.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(address masterRouter, address registry) {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        REGISTRY = registry;
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
     * @notice Deploys a new {UTSToken} using the provided deployment parameters.
     * @param deployData the {DeployTokenData} struct containing deployment parameters.
     * @dev See the {UTSERC20DataTypes.DeployTokenData} for details.
     *
     * @return success call result.
     * @return newToken a newly deployed {UTSToken} contract address.
     */
    function deployToken(DeployTokenData calldata deployData) external returns(bool success, address newToken) {

        return _deployToken(deployData, msg.sender.toBytes());
    }

    /**
     * @notice Deploys a new {UTSConnector} using the provided deployment parameters.
     * @param deployData the {DeployConnectorData} struct containing deployment parameters.
     * @dev See the {UTSERC20DataTypes.DeployConnectorData} for details.
     *
     * @return success call result.
     * @return newConnector a newly deployed {UTSConnector} contract address.
     */
    function deployConnector(DeployConnectorData calldata deployData) external returns(bool success, address newConnector) {

        return _deployConnector(deployData, msg.sender.toBytes());
    }

    /**
     * @notice Deploys a new {UTSToken} or {UTSConnector} by crosschain deploy message.
     * @param isConnector flag indicating whether is connector(true) or token(false) deployment.
     * @param deployer source chain {msg.sender} address.
     * @param deployParams abi.encoded {DeployTokenData} struct or abi.encoded {DeployConnectorData} struct.
     * @dev See the {UTSERC20DataTypes.DeployTokenData} and {UTSERC20DataTypes.DeployConnectorData} for details.
     *
     * @return success call result.
     * @return newDeployment a newly deployed {UTSToken} or {UTSConnector} contract address.
     * 
     * @dev Only authorized {UTSDeploymentRouter} can execute this function.
     */
    function deployByRouter(
        bool isConnector, 
        bytes calldata deployer,
        bytes calldata deployParams
    ) external returns(bool success, address newDeployment) {
        if (!IUTSMasterRouter(MASTER_ROUTER).validateRouter(msg.sender)) revert UTSFactory__E0();

        if (isConnector) {
            return _deployConnector(abi.decode(deployParams, (DeployConnectorData)), deployer);
        } else {
            return _deployToken(abi.decode(deployParams, (DeployTokenData)), deployer);
        }
    }

    /**
     * @notice Pauses the {deployToken}, {deployConnector}, and {deployByRouter} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {deployToken}, {deployConnector}, and {deployByRouter} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Sets the {_router} address.
     * @param newRouter new {_router} address of the {UTSDeploymentRouter} contract.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setRouter(address newRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRouter(newRouter);
    } 

    /**
     * @notice Sets the code storage addresses for corresponding blueprint Ids.
     * @param blueprintIds array of {DeploymentType} blueprints.
     * @param newCodeStorage array of {_codeStorage} addresses for corresponding {blueprintIds}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setCodeStorage(
        uint8[] calldata blueprintIds, 
        address[] calldata newCodeStorage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (blueprintIds.length != newCodeStorage.length) revert UTSFactory__E3();
        for (uint256 i; blueprintIds.length > i; ++i) _setCodeStorage(blueprintIds[i], newCodeStorage[i]);
    }

    /**
     * @notice Returns the UTSFactory protocol version.
     * @return UTS protocol version.
     */
    function protocolVersion() public pure returns(bytes2) {
        return 0x0101;
    }

    /**
     * @notice Precalculates the address of a {UTSToken} or {UTSConnector} contract.
     * @param blueprintId {DeploymentType} blueprint to be deployed.
     * @param deployer source chain {msg.sender} address.
     * @param salt value used for precalculation of deployment address.
     * @param isConnector flag indicating whether is connector(true) or token(false) deployment.
     * @return deployment precalculated {UTSToken} or {UTSConnector} contract address.
     * @return hasCode flag indicating whether the {deployment} address has a deployed bytecode.
     */
    function getPrecomputedAddress(
        uint8 blueprintId,
        bytes calldata deployer, 
        bytes32 salt, 
        bool isConnector
    ) external view returns(address deployment, bool hasCode) {
        bytes32 _salt = keccak256(abi.encode(deployer, salt));
        bytes32 _bytecodeHash = keccak256(IUTSCodeStorage(codeStorage(blueprintId)).getCode(isConnector));

        deployment = _salt.computeAddress(_bytecodeHash);
        if (deployment.code.length > 0) hasCode = true;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSFactory).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the {UTSDeploymentRouter} address.
     * @return {UTSDeploymentRouter} {_router} address.
     */
    function router() external view returns(address) {
        Main storage $ = _getMainStorage();
        return $._router;
    }

    /**
     * @notice Returns the {_codeStorage} address for corresponding {DeploymentType} blueprint.
     * @param blueprintId {DeploymentType} blueprint.
     * @return {_codeStorage} address.
     */
    function codeStorage(uint8 blueprintId) public view returns(address) {
        Main storage $ = _getMainStorage();
        return $._codeStorage[blueprintId];
    }

    function _deployToken(
        DeployTokenData memory deployData, 
        bytes memory deployer
    ) internal returns(bool success, address newToken) {
        if (deployData.pureToken) {
            if (deployData.mintable || deployData.globalBurnable || deployData.onlyRoleBurnable || deployData.feeModule) {
                revert UTSFactory__E2();
            }

            if (deployData.mintedAmountToOwner > deployData.initialSupply) revert UTSFactory__E4();
        } else {
            if (deployData.mintedAmountToOwner != deployData.initialSupply) revert UTSFactory__E4();
        }

        DeploymentType _blueprintId = DeploymentType.Standard;

        if (deployData.mintable) _blueprintId = DeploymentType.MintableToken;
        if (deployData.feeModule) _blueprintId = DeploymentType.TokenWithFee;
        if (deployData.mintable && deployData.feeModule) _blueprintId = DeploymentType.MintableTokenWithFee;
        if (deployData.pureToken) _blueprintId = DeploymentType.PureToken;

        newToken = _deployAndRegister(
            uint8(_blueprintId),
            deployer,
            keccak256(abi.encode(deployer, deployData.salt)), 
            address(0)
        );

        IUTSToken(newToken).initializeToken(deployData);

        emit Deployed(
            newToken, 
            deployer,
            deployer, 
            deployData.owner.toAddress(), 
            newToken,
            deployData.salt,
            deployData.name, 
            deployData.symbol,
            deployData.decimals
        );

        return (true, newToken);
    }

    function _deployConnector(
        DeployConnectorData memory deployData,
        bytes memory deployer
    ) internal returns(bool success, address newConnector) {
        newConnector = _deployAndRegister(
            uint8(deployData.feeModule ? DeploymentType.ConnectorWithFee : DeploymentType.Standard), 
            deployer,
            keccak256(abi.encode(deployer, deployData.salt)),
            deployData.underlyingToken.toAddress()
        );

        IUTSConnector(newConnector).initializeConnector(
            deployData.owner.toAddress(),
            deployData.underlyingToken.toAddress(),
            deployData.router.toAddress(),  
            deployData.allowedChainIds,
            deployData.chainConfigs
        );

        emit Deployed(
            newConnector, 
            deployer, 
            deployer,
            deployData.owner.toAddress(), 
            deployData.underlyingToken.toAddress(),
            deployData.salt,
            "", 
            "",
            0
        );

        return (true, newConnector);
    }

    function _deployAndRegister(
        uint8 blueprintId,
        bytes memory deployer, 
        bytes32 salt,  
        address underlyingToken
    ) internal whenNotPaused() returns(address deployment) {
        bytes memory _bytecode = IUTSCodeStorage(codeStorage(blueprintId)).getCode(underlyingToken != address(0));

        deployment = salt.computeAddress(keccak256(_bytecode));
        
        if (deployment.code.length > 0) revert UTSFactory__E1();

        deployment = Create2.deploy(0, salt, _bytecode);

        IUTSRegistry(REGISTRY).registerDeployment(
            deployment,
            deployer,
            underlyingToken == address(0) ? deployment : underlyingToken,
            protocolVersion()
        );
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function _setRouter(address newRouter) internal {
        Main storage $ = _getMainStorage();
        $._router = newRouter;

        emit DeploymentRouterSet(newRouter, msg.sender);
    }

    function _setCodeStorage(uint8 blueprintId, address newCodeStorage) internal {
        Main storage $ = _getMainStorage();
        $._codeStorage[blueprintId] = newCodeStorage;

        emit CodeStorageSet(blueprintId, newCodeStorage, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}