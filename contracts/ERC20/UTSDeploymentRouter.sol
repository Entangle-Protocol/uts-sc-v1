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

contract UTSDeploymentRouter is IUTSDeploymentRouter, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using AddressConverter for address;
    using DecimalsConverter for uint256;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    uint256 public constant EOB_CHAIN_ID = 33033;

    bytes1 private constant DEPLOY_MESSAGE_TYPE = 0x02;
    uint16 private constant BPS = 10000;
    uint24 private constant PRECISION = 1000000;

    address public immutable MASTER_ROUTER;
    address public immutable PRICE_FEED;
    address public immutable FACTORY;
    address public immutable REGISTRY;
    address public immutable PAYMENT_TOKEN;

    uint8  private immutable PAYMENT_TOKEN_DECIMALS;
    uint8  private immutable NATIVE_TOKEN_DECIMALS;
    uint16 private immutable PAYMENT_TRANSFER_GAS_LIMIT;

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSDeploymentRouter.Main
    struct Main {
        mapping(uint256 chainId => DstDeployConfig) _dstDeployConfig;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSDeploymentRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x5ef83cde492754da3fd6bddb04f9c0eea61921570db6556ef7bb11412c3f9000;

    error UTSDeploymentRouter__E0();     // {deployMetadata} zero length
    error UTSDeploymentRouter__E1();     // unallowed {dstChainId} 
    error UTSDeploymentRouter__E2();     // access denied: you are not a {MASTER_ROUTER}
    error UTSDeploymentRouter__E3();     // arguments length mismatch
    error UTSDeploymentRouter__E4();     // unsupported configuration
    error UTSDeploymentRouter__E5();     // insufficient {paymentAmount}
    error UTSDeploymentRouter__E6();     // invalid {mintedAmountToOwner}

    event ConfigFactorySet(uint256 indexed chainId, bytes newFactory, address indexed caller);
    event ConfigProtocolFeeSet(uint256 indexed chainId, uint16 newProtocolFee, address indexed caller);
    event ConfigTokenDeployGasSet(uint256 indexed chainId, uint64 newTokenDeployGas, address indexed caller);
    event ConfigConnectorDeployGasSet(uint256 indexed chainId, uint64 newConnectorDeployGas, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
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

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

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

    function execute(
        address dstFactoryAddress, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult) {
        if (msg.sender != MASTER_ROUTER) revert UTSDeploymentRouter__E2();
        if (paused()) return uint8(OperationResult.RouterPaused); 

        if (messageType != DEPLOY_MESSAGE_TYPE) return uint8(OperationResult.InvalidMessageType); 

        ( 
            bool _isConnector, 
            bytes memory _deployer,
            bytes memory _deployParams
        ) = abi.decode(localParams, (bool, bytes, bytes));

        if (!IUTSRegistry(REGISTRY).validateFactory(dstFactoryAddress)) return uint8(OperationResult.UnauthorizedRouter);
        if (IPausable(dstFactoryAddress).paused()) return uint8(OperationResult.RouterPaused);

        (bool _deployResult, bytes memory _deployResponse) = dstFactoryAddress.call(
            abi.encodeCall(IUTSFactory.deployByRouter, (_isConnector, _deployer, _deployParams))
        );

        if (_deployResult && _deployResponse.length > 0) {
            return uint8(OperationResult.Success);
        } else {
            return uint8(OperationResult.DeployFailed);
        }
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

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

    function setDstProtocolFee(
        uint256[] calldata dstChainIds, 
        uint16[] calldata newProtocolFees
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newProtocolFees.length) revert UTSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setProtocolFee(dstChainIds[i], newProtocolFees[i]);
    }

    function setDstFactory(
        uint256[] calldata dstChainIds, 
        bytes[] calldata newFactory
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newFactory.length) revert UTSDeploymentRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setFactory(dstChainIds[i], newFactory[i]);
    }

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

    function getDeployTokenParams(DeployTokenData calldata deployData) external pure returns(bytes memory) {
        return abi.encode(deployData);
    }

    function getDeployConnectorParams(DeployConnectorData calldata deployData) external pure returns(bytes memory) {
        return abi.encode(deployData);
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0x0101;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSDeploymentRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function _normalize(uint256 amount, uint256 rate) internal view returns(uint256) {
        return (amount * rate / PRECISION).convert(NATIVE_TOKEN_DECIMALS, PAYMENT_TOKEN_DECIMALS);
    }

    function dstDeployConfig(uint256 dstChainId) public view returns(DstDeployConfig memory) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId];
    }

    function dstTokenDeployGas(uint256 dstChainId) external view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].tokenDeployGas;
    }

    function dstConnectorDeployGas(uint256 dstChainId) external view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].connectorDeployGas;
    }

    function dstProtocolFee(uint256 dstChainId) external view returns(uint16) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].protocolFee;
    }

    function dstFactory(uint256 dstChainId) external view returns(bytes memory) {
        Main storage $ = _getMainStorage();
        return $._dstDeployConfig[dstChainId].factory;
    }

    function _setTokenDeployGas(uint256 chainId, uint64 newTokenDeployGas) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[chainId].tokenDeployGas = newTokenDeployGas;

        emit ConfigTokenDeployGasSet(chainId, newTokenDeployGas, msg.sender);
    }

    function _setConnectorDeployGas(uint256 chainId, uint64 newConnectorDeployGas) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[chainId].connectorDeployGas = newConnectorDeployGas;

        emit ConfigConnectorDeployGasSet(chainId, newConnectorDeployGas, msg.sender);
    }

    function _setProtocolFee(uint256 chainId, uint16 newProtocolFee) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[chainId].protocolFee = newProtocolFee;

        emit ConfigProtocolFeeSet(chainId, newProtocolFee, msg.sender);
    }

    function _setFactory(uint256 chainId, bytes memory newFactory) internal {
        Main storage $ = _getMainStorage();
        $._dstDeployConfig[chainId].factory = newFactory;

        emit ConfigFactorySet(chainId, newFactory, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}