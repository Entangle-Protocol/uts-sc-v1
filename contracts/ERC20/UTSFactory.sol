// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

import "contracts/libraries/UTSERC20DataTypes.sol";
import "contracts/libraries/AddressConverter.sol";

import "./interfaces/IUTSToken.sol";
import "./interfaces/IUTSFactory.sol";
import "./interfaces/IUTSConnector.sol";
import "./interfaces/IUTSCodeStorage.sol";
import "contracts/interfaces/IUTSRegistry.sol";
import "contracts/interfaces/IUTSMasterRouter.sol";

contract UTSFactory is IUTSFactory, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using Create2 for *;
    using AddressConverter for *;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    address public immutable MASTER_ROUTER;
    address public immutable REGISTRY;

    /// @dev blueprintId
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
 
    error UTSFactory__E0();     // access denied: only router allowed 
    error UTSFactory__E1();     // {deployment} address engaged
    error UTSFactory__E2();     // unsupported configuration
    error UTSFactory__E3();     // arguments length mismatch
    error UTSFactory__E4();     // invalid {mintedAmountToOwner}

    event DeploymentRouterSet(address newRouter, address indexed caller);
    event CodeStorageSet(uint8 indexed blueprintId, address newCodeStorage, address indexed caller);
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address masterRouter, address registry) {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        REGISTRY = registry;
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function deployToken(DeployTokenData calldata deployData) external returns(bool success, address newToken) {

        return _deployToken(deployData, msg.sender.toBytes());
    }

    function deployConnector(DeployConnectorData calldata deployData) external returns(bool success, address newConnector) {

        return _deployConnector(deployData, msg.sender.toBytes());
    }

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

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setRouter(address newRouter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setRouter(newRouter);
    } 

    function setCodeStorage(
        uint8[] calldata blueprintIds, 
        address[] calldata newCodeStorage
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (blueprintIds.length != newCodeStorage.length) revert UTSFactory__E3();
        for (uint256 i; blueprintIds.length > i; ++i) _setCodeStorage(blueprintIds[i], newCodeStorage[i]);
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0x0101;
    }

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

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSFactory).interfaceId || super.supportsInterface(interfaceId);
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

    function router() external view returns(address) {
        Main storage $ = _getMainStorage();
        return $._router;
    }

    function codeStorage(uint8 blueprintId) public view returns(address) {
        Main storage $ = _getMainStorage();
        return $._codeStorage[blueprintId];
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