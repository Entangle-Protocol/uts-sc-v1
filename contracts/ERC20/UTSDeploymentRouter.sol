// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "contracts/libraries/AddressConverter.sol";
import "contracts/libraries/UTSCoreDataTypes.sol";
import "contracts/libraries/UTSERC20DataTypes.sol";
import "contracts/libraries/DecimalsConverter.sol";

import "./interfaces/IUTSFactory.sol";
import "./interfaces/IUTSDeploymentRouter.sol";
import "contracts/interfaces/IPausable.sol";
import "contracts/interfaces/IUTSRegistry.sol";
import "contracts/interfaces/IUTSPriceFeed.sol";
import "contracts/interfaces/IUTSMasterRouter.sol";

/**
 * @notice A contract manages the sending and receiving of crosschain deployment requests for UTSTokens and 
 * UTSConnectors via UTS protocol V1.
 *
 * @dev It is an implementation of {UTSDeploymentRouter} for UUPS.
 */
contract UTSDeploymentRouter is IUTSDeploymentRouter, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using AddressConverter for address;
    using DecimalsConverter for uint256;

    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice {AccessControl} role identifier for manager addresses.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Reserved chain Id for the native currency to payment token rate fetching.
    uint256 public constant EOB_CHAIN_ID = 33033;

    /// @notice Internal UTS protocol identifier for crosschain deploy messages.
    bytes1 private constant DEPLOY_MESSAGE_TYPE = 0x02;

    /// @notice Basis points divisor for percentage calculations (100.00%).
    uint16 private constant BPS = 10000;

    /// @dev Precision used for the native currency to payment token rate calculations.
    uint24 private constant PRECISION = 1000000;

    /// @notice Address of the {UTSMasterRouter} contract.
    address public immutable MASTER_ROUTER;

    /// @notice Address of the {UTSPriceFeed} contract.
    address public immutable PRICE_FEED;

    /// @notice Address of the {UTSFactory} contract.
    address public immutable FACTORY;

    /// @notice Address of the {UTSRegistry} contract.
    address public immutable REGISTRY;

    /// @notice Address of the token used for crosschain deploy payment.
    /// @dev Payment in native currency is also available.
    address public immutable PAYMENT_TOKEN;

    /// @notice {PAYMENT_TOKEN} decimals.
    uint8 private immutable PAYMENT_TOKEN_DECIMALS;

    /// @notice Native currency decimals.
    uint8 private immutable NATIVE_TOKEN_DECIMALS;

    /// @notice The gas limit for payment native currency transfer by low level {call} function.
    uint16 private immutable PAYMENT_TRANSFER_GAS_LIMIT;

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSDeploymentRouter.Main
    struct Main {
        mapping(uint256 chainId => DstDeployConfig) _dstDeployConfig;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSDeploymentRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x5ef83cde492754da3fd6bddb04f9c0eea61921570db6556ef7bb11412c3f9000;

    /// @notice Indicates an error that the provided {deployMetadata} array has zero length.
    error UTSDeploymentRouter__E0();

    /// @notice Indicates an error that the provided {deployMetadata.dstChainId} is not supported.
    error UTSDeploymentRouter__E1();

    /// @notice Indicates an error that the function caller is not the {MASTER_ROUTER}.
    error UTSDeploymentRouter__E2();

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error UTSDeploymentRouter__E3();

    /// @notice Indicates an error that the provided {deployMetadata.params} contains unsupported {UTSToken} configuration to deploy.
    error UTSDeploymentRouter__E4();

    /// @notice Indicates an error that the provided {msg.value} is insufficient to pay for the request.
    error UTSDeploymentRouter__E5();

    /// @notice Indicates an error that the provided {DeployTokenData.mintedAmountToOwner} exceeds the {DeployTokenData.initialSupply}.
    error UTSDeploymentRouter__E6();

    /**
     * @notice Emitted when the {DstDeployConfig.factory} is updated.
     * @param dstChainId destination chain Id.
     * @param newFactory new {DstDeployConfig.factory} address for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.factory}.
     */
    event ConfigFactorySet(uint256 indexed dstChainId, bytes newFactory, address indexed caller);

    /**
     * @notice Emitted when the {DstDeployConfig.protocolFee} is updated.
     * @param dstChainId destination chain Id.
     * @param newProtocolFee new {DstDeployConfig.protocolFee} value for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.protocolFee}.
     */
    event ConfigProtocolFeeSet(uint256 indexed dstChainId, uint16 newProtocolFee, address indexed caller);

    /**
     * @notice Emitted when the {DstDeployConfig.tokenDeployGas} is updated.
     * @param dstChainId destination chain Id.
     * @param newTokenDeployGas new {DstDeployConfig.tokenDeployGas} amount for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.tokenDeployGas}.
     */
    event ConfigTokenDeployGasSet(uint256 indexed dstChainId, uint64 newTokenDeployGas, address indexed caller);

    /**
     * @notice Emitted when the {DstDeployConfig.connectorDeployGas} is updated.
     * @param dstChainId destination chain Id.
     * @param newConnectorDeployGas new {DstDeployConfig.connectorDeployGas} amount for corresponding {dstChainId}.
     * @param caller the caller address who set the new {DstDeployConfig.connectorDeployGas}.
     */
    event ConfigConnectorDeployGasSet(uint256 indexed dstChainId, uint64 newConnectorDeployGas, address indexed caller);

    /**
     * @notice Initializes immutable variables.
     * @param masterRouter address of the {UTSMasterRouter} contract.
     * @param priceFeed address of the {UTSPriceFeed} contract.
     * @param factory address of the {UTSFactory} contract.
     * @param registry address of the {UTSRegistry} contract.
     * @param paymentToken address of the {PAYMENT_TOKEN} used for payment.
     * @param paymentTokenDecimals {PAYMENT_TOKEN} decimals.
     * @param nativeTokenDecimals native currency decimals.
     * @param paymentTransferGasLimit gas limit for payment native currency transfer by low level {call} function.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */ 
    constructor(
        address masterRouter, 
        address priceFeed, 
        address factory, 
        address registry, 
        address paymentToken,
        uint8 paymentTokenDecimals,
        uint8 nativeTokenDecimals,
        uint16 paymentTransferGasLimit
    ) {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        PRICE_FEED = priceFeed;
        FACTORY = factory;
        REGISTRY = registry;
        PAYMENT_TOKEN = paymentToken;
        PAYMENT_TOKEN_DECIMALS = paymentTokenDecimals;
        NATIVE_TOKEN_DECIMALS = nativeTokenDecimals;
        PAYMENT_TRANSFER_GAS_LIMIT = paymentTransferGasLimit;
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
     * @notice Sends UTSToken and UTSConnector deployment crosschain requests via UTS protocol V1.
     * @param deployMetadata array of {DeployMetadata} structs, containing destination chain Ids and deploy parameters:
     *        dstChainId: destination chain Id
     *        isConnector: flag indicating whether is request for deploy connector(true) or token(false)
     *        params: abi.encoded {DeployTokenData} struct or abi.encoded {DeployConnectorData} struct
     * @dev See the {UTSERC20DataTypes.DeployTokenData} and {UTSERC20DataTypes.DeployConnectorData} for details.
     *
     * @param paymentToken address of the token used for payment.
     * @dev Any {paymentToken} address different from the {PAYMENT_TOKEN} is identified as a payment in native currency.
     *
     * @return paymentAmount total payment required for send deployment requests.
     * @return currentChainDeployment deployment address on the current chain (if a relevant request was provided).
     */
    function sendDeployRequest(
        DeployMetadata[] calldata deployMetadata,
        address paymentToken
    ) external payable whenNotPaused() returns(uint256 paymentAmount, address currentChainDeployment) {
        if (deployMetadata.length == 0) revert UTSDeploymentRouter__E0();

        for (uint256 i; deployMetadata.length > i; ++i) {
            if (deployMetadata[i].dstChainId != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(deployMetadata[i].dstChainId);

                if (config.factory.length == 0) revert UTSDeploymentRouter__E1();

                if (deployMetadata[i].isConnector) {
                    DeployConnectorData memory _params = abi.decode(deployMetadata[i].params, (DeployConnectorData));

                    if (_params.allowedChainIds.length != _params.chainConfigs.length) revert UTSDeploymentRouter__E3();
                } else {
                    DeployTokenData memory _params = abi.decode(deployMetadata[i].params, (DeployTokenData));

                    if (_params.allowedChainIds.length != _params.chainConfigs.length) revert UTSDeploymentRouter__E3();

                    if (_params.pureToken) {
                        if (_params.mintable || _params.globalBurnable || _params.onlyRoleBurnable || _params.feeModule) {
                            revert UTSDeploymentRouter__E4();
                        }

                        if (_params.mintedAmountToOwner > _params.initialSupply) revert UTSDeploymentRouter__E6();
                    } else {
                        if (_params.mintedAmountToOwner != _params.initialSupply) revert UTSDeploymentRouter__E6();
                    }
                }

                IUTSMasterRouter(MASTER_ROUTER).sendProposal(
                    0, // user's payload length
                    deployMetadata[i].dstChainId, 
                    abi.encode(
                        config.factory,
                        DEPLOY_MESSAGE_TYPE,
                        abi.encode(
                            deployMetadata[i].isConnector, 
                            msg.sender.toBytes(), 
                            deployMetadata[i].params
                        )
                    )
                );

                paymentAmount += 
                    IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(deployMetadata[i].dstChainId) * 
                    (deployMetadata[i].isConnector ? config.connectorDeployGas : config.tokenDeployGas) * 
                    (BPS + config.protocolFee) / BPS;

            } else {
                ( , currentChainDeployment) = IUTSFactory(FACTORY).deployByRouter(
                    deployMetadata[i].isConnector, 
                    msg.sender.toBytes(), 
                    deployMetadata[i].params
                );
            }
        }

        if (paymentToken == PAYMENT_TOKEN) {
            paymentAmount = _normalize(paymentAmount, IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(EOB_CHAIN_ID));

            if (paymentAmount > 0) {
                IERC20(PAYMENT_TOKEN).safeTransferFrom(
                    msg.sender, 
                    IUTSMasterRouter(MASTER_ROUTER).feeCollector(), 
                    paymentAmount
                );
            }
        } else {
            if (paymentAmount > msg.value) revert UTSDeploymentRouter__E5();

            IUTSMasterRouter(MASTER_ROUTER).feeCollector().call{
                value: address(this).balance, 
                gas: PAYMENT_TRANSFER_GAS_LIMIT
            }("");
        }

        return (paymentAmount, currentChainDeployment);
    }

    /**
     * @notice Executes a deployment request received from source chain via UTS protocol V1.
     * @param factoryAddress {UTSFactory} address on current chain.
     * @param messageType internal UTS protocol identifier for crosschain messages. Must match {DEPLOY_MESSAGE_TYPE}.
     * @param localParams abi.encoded deploy parameters, containing:
     *        isConnector: flag indicating whether is request for deploy connector(true) or token(false)
     *        deployer: source chain {msg.sender} address
     *        deployParams: abi.encoded {DeployTokenData} struct or abi.encoded {DeployConnectorData} struct
     * @return opResult the execution result code, represented as a uint8(UTSCoreDataTypes.OperationResult).
     * @dev Only {MASTER_ROUTER} can execute this function.
     */
    function execute(
        address factoryAddress, 
        bytes1 messageType,
        bytes calldata localParams
    ) external payable returns(uint8 opResult) {
        if (msg.sender != MASTER_ROUTER) revert UTSDeploymentRouter__E2();

        if (paused()) return uint8(OperationResult.RouterPaused); 
        if (messageType != DEPLOY_MESSAGE_TYPE) return uint8(OperationResult.InvalidMessageType); 
        if (!IUTSRegistry(REGISTRY).validateFactory(factoryAddress)) return uint8(OperationResult.UnauthorizedRouter);
        if (IPausable(factoryAddress).paused()) return uint8(OperationResult.RouterPaused);

        ( 
            bool _isConnector, 
            bytes memory _deployer,
            bytes memory _deployParams
        ) = abi.decode(localParams, (bool, bytes, bytes));

        (bool _deployResult, bytes memory _deployResponse) = factoryAddress.call(
            abi.encodeCall(IUTSFactory.deployByRouter, (_isConnector, _deployer, _deployParams))
        );

        if (_deployResult && _deployResponse.length > 0) {
            return uint8(OperationResult.Success);
        } else {
            return uint8(OperationResult.DeployFailed);
        }
    }

    /**
     * @notice Pauses the {sendDeployRequest} and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {sendDeployRequest} and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Sets the destination chains settings.
     * @param dstChainIds destination chain Ids.
     * @param newConfigs {DstDeployConfig} structs array containing destination chains settings: 
     *        factory: destination {UTSFactory} address
     *        tokenDeployGas: the amount of gas required to deploy the {UTSToken} on the destination chain
     *        connectorDeployGas: the amount of gas required to deploy the {UTSConnector} on the destination chain
     *        protocolFee: protocol fee (basis points) for crosschain deployment on the destination chain
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setDstDeployConfig(
        uint256[] calldata dstChainIds,
        DstDeployConfig[] calldata newConfigs
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newConfigs.length) revert UTSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) {
            _setFactory(dstChainIds[i], newConfigs[i].factory);
            _setTokenDeployGas(dstChainIds[i], newConfigs[i].tokenDeployGas);
            _setConnectorDeployGas(dstChainIds[i], newConfigs[i].connectorDeployGas);
            _setProtocolFee(dstChainIds[i], newConfigs[i].protocolFee);
        }
    }

    /**
     * @notice Sets the amounts of gas required to deploy on the destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newTokenDeployGas the amounts of gas required to deploy the {UTSToken} on the corresponding {dstChainId}.
     * @param newTokenDeployGas the amounts of gas required to deploy the {UTSConnector} on the corresponding {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstDeployGas(
        uint256[] calldata dstChainIds,
        uint64[] calldata newTokenDeployGas,
        uint64[] calldata newConnectorDeployGas
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newTokenDeployGas.length) revert UTSDeploymentRouter__E3();
        if (dstChainIds.length != newConnectorDeployGas.length) revert UTSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) {
            _setTokenDeployGas(dstChainIds[i], newTokenDeployGas[i]);
            _setConnectorDeployGas(dstChainIds[i], newConnectorDeployGas[i]);
        }
    }

    /**
     * @notice Sets the protocol fees for deploy on the destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newProtocolFees protocol fees (basis points) for crosschain deployment on the corresponding {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstProtocolFee(
        uint256[] calldata dstChainIds, 
        uint16[] calldata newProtocolFees
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newProtocolFees.length) revert UTSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setProtocolFee(dstChainIds[i], newProtocolFees[i]);
    }

    /**
     * @notice Sets the destination {UTSFactory} addresses.
     * @param dstChainIds destination chain Ids.
     * @param newFactory {UTSFactory} addresses on the corresponding {dstChainId}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setDstFactory(
        uint256[] calldata dstChainIds, 
        bytes[] calldata newFactory
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newFactory.length) revert UTSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setFactory(dstChainIds[i], newFactory[i]);
    }

    /**
     * @notice Estimates the total payment required for send crosschain deployment requests.
     * @param dstTokenChainIds destination chain Ids for {UTSToken} deployments.
     * @param dstConnectorChainIds destination chain Ids for {UTSConnector} deployments.
     * @return paymentTokenAmount estimated total payment amount in the {PAYMENT_TOKEN}.
     * @return paymentNativeAmount estimated total payment amount in native currency.
     */
    function estimateDeployTotal(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(uint256 paymentTokenAmount, uint256 paymentNativeAmount) {
        for (uint256 i; dstTokenChainIds.length > i; ++i) {
            if (dstTokenChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstTokenChainIds[i]);

                paymentNativeAmount += 
                    IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(dstTokenChainIds[i]) * 
                    config.tokenDeployGas * (BPS + config.protocolFee) / BPS;
            }
        }

        for (uint256 i; dstConnectorChainIds.length > i; ++i) {
            if (dstConnectorChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstConnectorChainIds[i]);

                paymentNativeAmount += 
                    IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(dstConnectorChainIds[i]) * 
                    config.connectorDeployGas * (BPS + config.protocolFee) / BPS;
            }
        }

        return (
            _normalize(paymentNativeAmount, IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(EOB_CHAIN_ID)), 
            paymentNativeAmount
        );
    }

    /**
     * @notice Estimates the separated payments required for send crosschain deployment requests in the {PAYMENT_TOKEN}.
     * @param dstTokenChainIds destination chain Ids for {UTSToken} deployments.
     * @param dstConnectorChainIds destination chain Ids for {UTSConnector} deployments.
     * @return tokenPaymentAmount array of estimated payment amount in the {PAYMENT_TOKEN} for each {dstChainId}.
     * @return connectorPaymentAmount array of estimated payment amount in the {PAYMENT_TOKEN} for each {dstChainId}.
     * @return totalPaymentAmount estimated total payment amount in the {PAYMENT_TOKEN}.
     */
    function estimateDeploy(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(
        uint256[] memory tokenPaymentAmount, 
        uint256[] memory connectorPaymentAmount, 
        uint256 totalPaymentAmount
    ) {
        uint256 _tokenToCurNativeRate = IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(EOB_CHAIN_ID);

        tokenPaymentAmount = new uint256[](dstTokenChainIds.length);
        connectorPaymentAmount = new uint256[](dstConnectorChainIds.length);

        for (uint256 i; dstTokenChainIds.length > i; ++i) {
            if (dstTokenChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstTokenChainIds[i]);

                uint256 _paymentAmount = _normalize(
                    IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(dstTokenChainIds[i]) * 
                    config.tokenDeployGas * (BPS + config.protocolFee) / BPS,
                    _tokenToCurNativeRate
                );

                tokenPaymentAmount[i] = _paymentAmount;
                totalPaymentAmount += _paymentAmount;
            } else {
                tokenPaymentAmount[i] = 0;
            }
        }

        for (uint256 i; dstConnectorChainIds.length > i; ++i) {
            if (dstConnectorChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstConnectorChainIds[i]);

                uint256 _paymentAmount = _normalize(
                    IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(dstConnectorChainIds[i]) * 
                    config.connectorDeployGas * (BPS + config.protocolFee) / BPS,
                    _tokenToCurNativeRate
                );

                connectorPaymentAmount[i] = _paymentAmount;
                totalPaymentAmount += _paymentAmount;
            } else {
                connectorPaymentAmount[i] = 0;
            }
        }
    }

    /**
     * @notice Estimates the separated payments required for send crosschain deployment requests in native currency.
     * @param dstTokenChainIds destination chain Ids for {UTSToken} deployments.
     * @param dstConnectorChainIds destination chain Ids for {UTSConnector} deployments.
     * @return tokenPaymentAmountNative array of estimated payment amount in native currency for each {dstChainId}.
     * @return connectorPaymentAmountNative array of estimated payment amount in native currency for each {dstChainId}.
     * @return totalPaymentAmountNative estimated total payment amount in native currency.
     */
    function estimateDeployNative(
        uint256[] calldata dstTokenChainIds,
        uint256[] calldata dstConnectorChainIds
    ) external view returns(
        uint256[] memory tokenPaymentAmountNative, 
        uint256[] memory connectorPaymentAmountNative, 
        uint256 totalPaymentAmountNative
    ) {
        tokenPaymentAmountNative = new uint256[](dstTokenChainIds.length);
        connectorPaymentAmountNative = new uint256[](dstConnectorChainIds.length);

        for (uint256 i; dstTokenChainIds.length > i; ++i) {
            if (dstTokenChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstTokenChainIds[i]);

                uint256 _paymentAmount = 
                    IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(dstTokenChainIds[i]) * 
                    config.tokenDeployGas * (BPS + config.protocolFee) / BPS;

                tokenPaymentAmountNative[i] = _paymentAmount;
                totalPaymentAmountNative += _paymentAmount;
            } else {
                tokenPaymentAmountNative[i] = 0;
            }
        }

        for (uint256 i; dstConnectorChainIds.length > i; ++i) {
            if (dstConnectorChainIds[i] != block.chainid) {
                DstDeployConfig memory config = dstDeployConfig(dstConnectorChainIds[i]);

                uint256 _paymentAmount =
                    IUTSPriceFeed(PRICE_FEED).getDstGasPriceAtSrcNative(dstConnectorChainIds[i]) * 
                    config.connectorDeployGas * (BPS + config.protocolFee) / BPS;

                connectorPaymentAmountNative[i] = _paymentAmount;
                totalPaymentAmountNative += _paymentAmount;
            } else {
                connectorPaymentAmountNative[i] = 0;
            }
        }
    }

    /**
     * @notice Returns the abi.encoded {DeployTokenData} struct as a parameter for the {sendDeployRequest} function.
     * @param deployData see the {UTSERC20DataTypes.DeployTokenData} for details.
     * @return abi.encoded {DeployTokenData} struct.
     */
    function getDeployTokenParams(DeployTokenData calldata deployData) external pure returns(bytes memory) {
        return abi.encode(deployData);
    }

    /**
     * @notice Returns the abi.encoded {DeployConnectorData} struct as a parameter for the {sendDeployRequest} function.
     * @param deployData see the {UTSERC20DataTypes.DeployConnectorData} for details.
     * @return abi.encoded {DeployConnectorData} struct.
     */
    function getDeployConnectorParams(DeployConnectorData calldata deployData) external pure returns(bytes memory) {
        return abi.encode(deployData);
    }

    /**
     * @notice Returns the UTSDeploymentRouter protocol version.
     * @return UTS protocol version.
     */
    function protocolVersion() public pure returns(bytes2) {
        return 0x0101;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSDeploymentRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns destination chain settings.
     * @param dstChainId destination chain Id.
     * @return {DstDeployConfig} struct.
     * @dev See the {UTSERC20DataTypes.DstDeployConfig} for details.
     */
    function dstDeployConfig(uint256 dstChainId) public view returns(DstDeployConfig memory) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId];
    }

    /**
     * @notice Returns the amount of gas required to deploy the {UTSToken}.
     * @param dstChainId destination chain Id.
     * @return The amount of gas required to deploy the {UTSToken} on the provided {dstChainId}.
     */
    function dstTokenDeployGas(uint256 dstChainId) external view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].tokenDeployGas;
    }

    /**
     * @notice Returns the amount of gas required to deploy the {UTSConnector}.
     * @param dstChainId destination chain Id.
     * @return The amount of gas required to deploy the {UTSConnector} on the provided {dstChainId}.
     */
    function dstConnectorDeployGas(uint256 dstChainId) external view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].connectorDeployGas;
    }

    /**
     * @notice Returns the protocol fee for deploy on the destination chains.
     * @param dstChainId destination chain Id.
     * @return Protocol fees (basis points) for crosschain deployment on the provided {dstChainId}.
     */
    function dstProtocolFee(uint256 dstChainId) external view returns(uint16) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].protocolFee;
    }

    /**
     * @notice Returns the destination {UTSFactory} contract address.
     * @param dstChainId destination chain Id.
     * @return {UTSFactory} address on the provided {dstChainId}.
     */
    function dstFactory(uint256 dstChainId) external view returns(bytes memory) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].factory;
    }

    function _normalize(uint256 amount, uint256 rate) internal view returns(uint256) {
        return (amount * rate / PRECISION).convert(NATIVE_TOKEN_DECIMALS, PAYMENT_TOKEN_DECIMALS);
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function _setTokenDeployGas(uint256 dstChainId, uint64 newTokenDeployGas) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].tokenDeployGas = newTokenDeployGas;

        emit ConfigTokenDeployGasSet(dstChainId, newTokenDeployGas, msg.sender);
    }

    function _setConnectorDeployGas(uint256 dstChainId, uint64 newConnectorDeployGas) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].connectorDeployGas = newConnectorDeployGas;

        emit ConfigConnectorDeployGasSet(dstChainId, newConnectorDeployGas, msg.sender);
    }

    function _setProtocolFee(uint256 dstChainId, uint16 newProtocolFee) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].protocolFee = newProtocolFee;

        emit ConfigProtocolFeeSet(dstChainId, newProtocolFee, msg.sender);
    }

    function _setFactory(uint256 dstChainId, bytes memory newFactory) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[dstChainId].factory = newFactory;

        emit ConfigFactorySet(dstChainId, newFactory, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}