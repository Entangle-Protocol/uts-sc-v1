// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "contracts/libraries/UTSERC20DataTypes.sol";
import "contracts/libraries/UTSCoreDataTypes.sol";
import "contracts/libraries/AddressConverter.sol";
import "contracts/libraries/SafeCall.sol";

import "./interfaces/IUTSBaseExtended.sol";
import "./interfaces/IUTSRouter.sol";
import "contracts/interfaces/IUTSPriceFeed.sol";
import "contracts/interfaces/IUTSMasterRouter.sol";

/**
 * @notice A contract manages the sending and receiving of bridge crosschain messages for UTSTokens and UTSConnectors 
 * via UTS protocol V1.
 *
 * @dev It is an implementation of {UTSRouter} for UUPS.
 * The {UTSRouter} contract has specific access rights in target deployments to execute {redeem} and other required functions.
 */
contract UTSRouter is IUTSRouter, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using AddressConverter for *;
    using SafeCall for address;

    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice {AccessControl} role identifier for manager addresses.
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    /// @notice Internal UTS protocol identifier for crosschain bridge messages.
    bytes1 private constant BRIDGE_MESSAGE_TYPE = 0x01;

    /// @notice Internal UTS protocol identifier for crosschain config update messages.
    bytes1 private constant UPDATE_MESSAGE_TYPE = 0x03;

    /// @notice Basis points divisor for percentage calculations (100.00%).
    uint16 private constant BPS = 10000;

    /// @notice {bytes32} type length.
    uint8 private constant BYTES32_LENGTH = 32;

    /// @notice Address of the {UTSMasterRouter} contract.
    address public immutable MASTER_ROUTER;

    /// @notice Address of the {UTSPriceFeed} contract.
    address public immutable PRICE_FEED;

    /// @notice The amount of gas required to execute {storeFailedExecution} function.
    uint64 private immutable STORE_GAS_LIMIT;

    /// @notice The amount of gas per one {ChainConfig} required to execute {setChainConfigByRouter} function.
    uint64 private immutable UPDATE_GAS_LIMIT;

    /// @notice The gas limit for payment native currency transfer by low level {call} function.
    uint16 private immutable PAYMENT_TRANSFER_GAS_LIMIT;

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSRouter.Main
    struct Main {
        mapping(uint256 chainId => uint64 dstChainIdMinGasLimit) _dstMinGasLimit;
        mapping(uint256 chainId => uint16 dstChainIdProtocolFee) _dstProtocolFee;
        mapping(uint256 chainId => uint64 dstChainIdUpdateGas) _dstUpdateGas;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3fb4de75078a1dcbe9ae3da4a8b51c7f6a145aae2899508efdf94f16ebd0e000;

    /// @notice Indicates an error that the provided {msg.value} is insufficient to pay for the sending message.
    error UTSRouter__E0();

    /// @notice Indicates an error that the provided {dstChainId} is invalid.
    error UTSRouter__E1();

    /// @notice Indicates an error that the function caller has an incompatible {protocolVersion}.
    error UTSRouter__E2();

    /// @notice Indicates an error that the function caller is not the {MASTER_ROUTER}.
    error UTSRouter__E3();
    
    /// @notice Indicates an error that the provided {to} address is empty or zero address.
    error UTSRouter__E4();
    
    /// @notice Indicates an error that the provided {dstToken} address is empty or zero address.
    error UTSRouter__E5();
    
    /// @notice Indicates an error that the provided {gasLimit} is below the required minimum value.
    error UTSRouter__E6();

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error UTSRouter__E7();

    /**
     * @notice Emitted when the {_dstMinGasLimit} is updated.
     * @param dstChainId destination chain Id.
     * @param newDstMinGasLimit new {_dstMinGasLimit} value for corresponding {dstChainId}.
     * @param caller the caller address who set the new {_dstMinGasLimit} value.
     */
    event DstMinGasLimitSet(uint256 indexed dstChainId, uint64 newDstMinGasLimit, address indexed caller);

    /**
     * @notice Emitted when the {_dstProtocolFee} is updated.
     * @param dstChainId destination chain Id.
     * @param newDstProtocolFee new {_dstProtocolFee} value for corresponding {dstChainId}.
     * @param caller the caller address who set the new {_dstProtocolFee}.
     */
    event DstProtocolFeeSet(uint256 indexed dstChainId, uint16 newDstProtocolFee, address indexed caller);

    /**
     * @notice Emitted when the {_dstUpdateGas} is updated.
     * @param dstChainId destination chain Id.
     * @param newDstUpdateGas new {_dstUpdateGas} value for corresponding {dstChainId}.
     * @param caller the caller address who set the new {_dstUpdateGas} value.
     */
    event DstUpdateGasSet(uint256 indexed dstChainId, uint64 newDstUpdateGas, address indexed caller);

    /**
     * @notice Initializes immutable variables.
     * @param masterRouter address of the {UTSMasterRouter} contract.
     * @param priceFeed address of the {UTSPriceFeed} contract.
     * @param storeGasLimit amount of gas required to execute {storeFailedExecution} function.
     * @param updateGasLimit amount of gas required to execute {setChainConfigByRouter} function.
     * @param paymentTransferGasLimit gas limit for payment native currency transfer by low level {call} function.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor(
        address masterRouter, 
        address priceFeed,
        uint64 storeGasLimit,
        uint64 updateGasLimit,
        uint16 paymentTransferGasLimit
    ) {
        _disableInitializers();

        MASTER_ROUTER = masterRouter;
        PRICE_FEED = priceFeed;
        STORE_GAS_LIMIT = storeGasLimit;
        UPDATE_GAS_LIMIT = updateGasLimit;
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
     * @notice Sends tokens bridge message by {UTSToken} or {UTSConnector} to the destination chain.
     * @param dstToken the address of the {UTSToken} or {UTSConnector} on the destination chain.
     * @param sender {msg.sender} address of {UTSToken} or {UTSConnector} call.
     * @param to bridged tokens receiver on the destination chain.
     * @param amount tokens amount to bridge to the destination chain.
     * @param srcDecimals decimals of the source underlying ERC20 token.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param customPayload user's additional data.
     * @param protocolPayload UTS protocol's additional data.
     * @return success call result.
     *
     * @dev The {UTSToken} or {UTSConnector} peer contract on source and destination chains MUST follow requirements:
     *      1. Supporting and following the logic and interface of {UTSBase} contract
     *      2. UTS {protocolVersion} compatibility
     *      3. The {UTSRouter} contract must have specific access rights to execute {redeem} and {storeFailedExecution} functions
     *      4. The destination peer's {ChainConfig} must contain a source peer address
     */
    function bridge(
        bytes calldata dstToken,
        bytes calldata sender,
        bytes calldata to,
        uint256 amount,
        uint8 srcDecimals,
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable whenNotPaused() returns(bool success) {
        if (IUTSBase(msg.sender).protocolVersion() != protocolVersion()) revert UTSRouter__E2();
        if (dstMinGasLimit(dstChainId) > dstGasLimit) revert UTSRouter__E6();
        if (dstChainId == block.chainid) revert UTSRouter__E1();
        if (_isZeroAddress(to)) revert UTSRouter__E4();
        if (_isZeroAddress(dstToken)) revert UTSRouter__E5();
        if (getBridgeFee(dstChainId, dstGasLimit, customPayload.length, protocolPayload) > msg.value) revert UTSRouter__E0();

        _paymentTransfer();

        IUTSMasterRouter(MASTER_ROUTER).sendProposal(
            customPayload.length, 
            dstChainId, 
            abi.encode(
                dstToken,
                BRIDGE_MESSAGE_TYPE,
                abi.encode(
                    sender,
                    to, 
                    amount, 
                    block.chainid, 
                    msg.sender.toBytes(),
                    srcDecimals,
                    dstGasLimit,
                    customPayload
                )
            )
        );
        
        return true;
    }

    /**
     * @notice Sends a crosschain message to update {UTSToken} or {UTSConnector} destination chain settings to the provided chain.
     * @param sender {msg.sender} address of {UTSToken} or {UTSConnector} call.
     * @param dstChainIds destination chain Ids where the configuration updates should be applied.
     * @param dstPeers {UTSToken} or {UTSConnector} peer addresses on the {dstChainIds}.
     * @param newConfigs array of {ChainConfigUpdate} chain settings should be applied, containing:
     *        allowedChainIds: chains Ids available for bridging in both directions
     *        chainConfigs: {ChainConfig} settings for provided {ChainConfigUpdate.allowedChainIds}
     * @dev See the {UTSERC20DataTypes.ChainConfigUpdate} and {UTSERC20DataTypes.ChainConfig} for details
     * @return success call result.
     *
     * @dev {UTSToken} or {UTSConnector} peer contract on the destination chain must inherit from the {UTSBaseExtended} 
     * extension or implement its' logic and interface otherwise.
     */
    function requestToUpdateConfig(
        bytes calldata sender,
        uint256[] calldata dstChainIds,
        bytes[] calldata dstPeers,
        ChainConfigUpdate[] calldata newConfigs
    ) external payable whenNotPaused() returns(bool success) {
        if (IUTSBase(msg.sender).protocolVersion() != protocolVersion()) revert UTSRouter__E2();
        
        if (dstChainIds.length != dstPeers.length) revert UTSRouter__E7();
        if (dstChainIds.length != newConfigs.length) revert UTSRouter__E7();

        uint256 _paymentAmount;

        for (uint256 i; dstChainIds.length > i; ++i) {
            if (dstChainIds[i] == block.chainid) revert UTSRouter__E1();
            if (_isZeroAddress(dstPeers[i])) revert UTSRouter__E5();

            _paymentAmount += _getUpdateFee(dstChainIds[i], newConfigs[i].allowedChainIds.length);

            IUTSMasterRouter(MASTER_ROUTER).sendProposal(
                0, // user's payload length
                dstChainIds[i], 
                abi.encode(
                    dstPeers[i],
                    UPDATE_MESSAGE_TYPE,
                    abi.encode(
                        sender, 
                        block.chainid, 
                        msg.sender.toBytes(),
                        newConfigs[i]
                    )
                )
            );
        }

        if (_paymentAmount > msg.value) revert UTSRouter__E0();

        _paymentTransfer();

        return true;
    }

    /**
     * @notice Executes a crosschain message received from {UTSToken} or {UTSConnector} on source chain.
     * @param peerAddress {UTSToken} or {UTSConnector} contract address on current chain.
     * @param messageType internal UTS protocol identifier for crosschain messages.
     * @param localParams abi.encoded execution parameters depending on the {messageType}.
     * @return opResult the execution result code, represented as a uint8(UTSCoreDataTypes.OperationResult).
     * @dev Only {MASTER_ROUTER} can execute this function.
     */
    function execute(
        address peerAddress, 
        bytes1 messageType, 
        bytes calldata localParams
    ) external payable returns(uint8 opResult) {
        if (msg.sender != MASTER_ROUTER) revert UTSRouter__E3();
        if (paused()) return uint8(OperationResult.RouterPaused);

        if (messageType == UPDATE_MESSAGE_TYPE) return _executeUpdateConfigs(peerAddress, localParams);

        if (messageType == BRIDGE_MESSAGE_TYPE) return _executeRedeem(peerAddress, localParams);

        return uint8(OperationResult.InvalidMessageType);
    }

    /**
     * @notice Pauses the {bridge}, {requestToUpdateConfig}, and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {bridge}, {requestToUpdateConfig}, and {execute} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Sets the amounts of gas required to execute {redeem} function on the destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newDstMinGasLimits the amounts of gas required to execute {redeem} on the provided {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstMinGasLimit(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstMinGasLimits
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstMinGasLimits.length) revert UTSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstMinGasLimit(dstChainIds[i], newDstMinGasLimits[i]);
    }

    /**
     * @notice Sets the protocol fees for sending crosschain messages to the destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newDstProtocolFees protocol fees (basis points) for sending crosschain messages to the provided {dstChainId}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setDstProtocolFee(
        uint256[] calldata dstChainIds, 
        uint16[] calldata newDstProtocolFees
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newDstProtocolFees.length) revert UTSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstProtocolFee(dstChainIds[i], newDstProtocolFees[i]);
    }

    /**
     * @notice Sets the amounts of gas per one {ChainConfig} required to execute {setChainConfigByRouter} function on 
     * destination chains.
     * @param dstChainIds destination chain Ids.
     * @param newDstUpdateGas amounts of gas per one {ChainConfig} required to execute {setChainConfigByRouter} function
     * on the provided {dstChainId}.
     * @dev Only addresses with the {MANAGER_ROLE} can execute this function.
     */
    function setDstUpdateGas(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstUpdateGas
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstUpdateGas.length) revert UTSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstUpdateGas(dstChainIds[i], newDstUpdateGas[i]);
    }

    /**
     * @notice Returns the UTSRouter protocol version.
     * @return UTS protocol version.
     */
    function protocolVersion() public pure returns(bytes2) {
        return 0x0101;
    }

    /**
     * @notice Calculates the fee amount required for sending crosschain bridge message to the provided destination chain.
     * @param dstChainId destination chain Id.
     * @param dstGasLimit {redeem} call gas limit on the destination chain.
     * @param payloadLength user's additional data length.
     * @custom:unused-param protocolPayload UTS protocol's additional data.
     * @return bridgeFeeAmount fee amount required for sending crosschain bridge message in current native currency.
     */
    function getBridgeFee(
        uint256 dstChainId, 
        uint64 dstGasLimit, 
        uint256 payloadLength,
        bytes calldata /* protocolPayload */
    ) public view returns(uint256 bridgeFeeAmount) {
        (uint256 _dstGasPrice, uint256 _dstPricePerByte) = IUTSPriceFeed(PRICE_FEED).getPrices(dstChainId);
        return (dstGasLimit * _dstGasPrice + payloadLength * _dstPricePerByte) * (BPS + dstProtocolFee(dstChainId)) / BPS;
    }

    /**
     * @notice Calculates the fee amount required for sending crosschain update config message to the provided destination chains.
     * @param dstChainIds destination chain Ids.
     * @param configsLength sum of new {ChainConfig} lengths for each {dstChainId}.
     * @return updateFeeAmount total fee amount required for sending crosschain update config message in current native currency.
     */
    function getUpdateFee(
        uint256[] calldata dstChainIds, 
        uint256[] calldata configsLength
    ) external view returns(uint256 updateFeeAmount) {
        if (dstChainIds.length != configsLength.length) revert UTSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) updateFeeAmount += _getUpdateFee(dstChainIds[i], configsLength[i]);
    }
    
    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the amount of gas required to execute {redeem} function on the destination chain.
     * @param dstChainId destination chain Id.
     * @return dstMinGasLimitAmount the amount of gas required to execute {redeem} function on the provided {dstChainId}.
     */
    function dstMinGasLimit(uint256 dstChainId) public view returns(uint64 dstMinGasLimitAmount) {
        Main storage $ = _getMainStorage();
        return $._dstMinGasLimit[dstChainId];
    }

    /**
     * @notice Returns the protocol fee for sending crosschain messages on the destination chain.
     * @param dstChainId destination chain Id.
     * @return dstProtocolFeeRate protocol fees (basis points) for sending crosschain messages on the provided {dstChainId}.
     */
    function dstProtocolFee(uint256 dstChainId) public view returns(uint16 dstProtocolFeeRate) {
        Main storage $ = _getMainStorage();
        return $._dstProtocolFee[dstChainId];
    }

    /**
     * @notice Returns the amount of gas per {ChainConfig} required to execute {setChainConfigByRouter} function on the
     * destination chain.
     * @param dstChainId destination chain Id.
     * @return dstUpdateGasAmount the amount of gas per {ChainConfig} required to execute {setChainConfigByRouter} 
     * function on the provided {dstChainId}.
     */
    function dstUpdateGas(uint256 dstChainId) public view returns(uint64 dstUpdateGasAmount) {
        Main storage $ = _getMainStorage();
        return $._dstUpdateGas[dstChainId];
    }

    function _getUpdateFee(uint256 dstChainId, uint256 configsLength) internal view returns(uint256) {
        (uint256 _dstGasPrice, ) = IUTSPriceFeed(PRICE_FEED).getPrices(dstChainId);
        return ((configsLength + 4) * dstUpdateGas(dstChainId) * _dstGasPrice) * (BPS + dstProtocolFee(dstChainId)) / BPS;
    }

    function _isZeroAddress(bytes calldata bytesAddress) internal pure returns(bool zeroAddress) {
        if (BYTES32_LENGTH >= bytesAddress.length) if (bytes32(bytesAddress) == bytes32(0)) return true;
    }

    function _executeRedeem(address peerAddress, bytes calldata localParams) internal returns(uint8 opResult) {
        (
            bytes memory _srcSender,
            bytes memory _to, 
            uint256 _amount, 
            uint256 _srcChainId, 
            bytes memory _srcToken, 
            uint8 _srcDecimals,
            uint64 _gasLimit, 
            bytes memory _customPayload
        ) = abi.decode(localParams, (bytes, bytes, uint256, uint256, bytes, uint8, uint64, bytes));

        if (_srcChainId == block.chainid) return uint8(OperationResult.InvalidSrcChainId);
        if (_srcToken.length == 0) return uint8(OperationResult.InvalidSrcPeerAddress); 

        address _receiver = _to.toAddress(); 

        // the EVM receiver address must be 20 bytes long
        if (_to.length != 20) {
            return uint8(OperationResult.InvalidToAddress); 
        } else {
            if (_receiver == address(0)) return uint8(OperationResult.InvalidToAddress);
        }

        Origin memory _origin = Origin({
            sender: _srcSender,
            chainId: _srcChainId,
            peerAddress: _srcToken,
            decimals: _srcDecimals
        });

        if (_gasLimit > STORE_GAS_LIMIT) _gasLimit -= STORE_GAS_LIMIT;

        (bool _redeemResult, bytes memory _redeemResponse) = peerAddress.safeCall(
            _gasLimit,
            0,   // call {value}
            150, // max {_redeemResponse} bytes length to copy
            abi.encodeCall(IUTSBase.redeem, (_receiver, _amount, _customPayload, _origin))
        );

        if (_redeemResult) {
            return uint8(OperationResult.Success);
        } else {
            (bool _storeResult, /* bytes memory _storeResponse */) = peerAddress.safeCall(
                STORE_GAS_LIMIT,
                0, // call {value}
                0, // max {_storeResponse} bytes length to copy
                abi.encodeCall(
                    IUTSBase.storeFailedExecution, 
                    (_receiver, _amount, _customPayload, _origin, _redeemResponse)
                )
            );

            if (_storeResult) {
                return uint8(OperationResult.FailedAndStored);
            } else {
                return uint8(OperationResult.Failed);
            }
        }
    }

    function _executeUpdateConfigs(address peerAddress, bytes calldata localParams) internal returns(uint8 opResult) {
        (
            bytes memory _srcSender, 
            uint256 _srcChainId, 
            bytes memory _srcToken, 
            ChainConfigUpdate memory _newConfig
        ) = abi.decode(localParams, (bytes, uint256, bytes, ChainConfigUpdate));

        if (_srcChainId == block.chainid) return uint8(OperationResult.InvalidSrcChainId);
        if (_srcToken.length == 0) return uint8(OperationResult.InvalidSrcPeerAddress);

        Origin memory origin = Origin({
            sender: _srcSender,
            chainId: _srcChainId,
            peerAddress: _srcToken,
            decimals: 0 // meaningless variable in this message type
        });

        (bool _updateResult, /* bytes memory _updateResponse */) = peerAddress.safeCall(
            (_newConfig.allowedChainIds.length + 4) * UPDATE_GAS_LIMIT,
            0, // call {value}
            0, // max {_updateResponse} bytes length to copy
            abi.encodeCall(
                IUTSBaseExtended.setChainConfigByRouter, 
                (_newConfig.allowedChainIds, _newConfig.chainConfigs, origin)
            )
        );

        if (_updateResult) {
            return uint8(OperationResult.Success);
        } else {
            return uint8(OperationResult.Failed);
        }
    }

    function _paymentTransfer() internal {
        IUTSMasterRouter(MASTER_ROUTER).feeCollector().call{
            value: address(this).balance, 
            gas: PAYMENT_TRANSFER_GAS_LIMIT
        }("");
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function _setDstMinGasLimit(uint256 dstChainId, uint64 newDstMinGasLimit) internal {
        Main storage $ = _getMainStorage();
        $._dstMinGasLimit[dstChainId] = newDstMinGasLimit;

        emit DstMinGasLimitSet(dstChainId, newDstMinGasLimit, msg.sender);
    }

    function _setDstProtocolFee(uint256 dstChainId, uint16 newDstProtocolFee) internal {
        Main storage $ = _getMainStorage();
        $._dstProtocolFee[dstChainId] = newDstProtocolFee;

        emit DstProtocolFeeSet(dstChainId, newDstProtocolFee, msg.sender);
    }

    function _setDstUpdateGas(uint256 dstChainId, uint64 newDstUpdateGas) internal {
        Main storage $ = _getMainStorage();
        $._dstUpdateGas[dstChainId] = newDstUpdateGas;

        emit DstUpdateGasSet(dstChainId, newDstUpdateGas, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}