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

contract UTSRouter is IUTSRouter, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using AddressConverter for *;
    using SafeCall for address;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    bytes1 private constant BRIDGE_MESSAGE_TYPE = 0x01;
    bytes1 private constant UPDATE_MESSAGE_TYPE = 0x03;
    uint16 private constant BPS = 10000;
    uint8  private constant BYTES32_LENGTH = 32;

    address public immutable MASTER_ROUTER;
    address public immutable PRICE_FEED;

    uint64 private immutable STORE_GAS_LIMIT;
    uint64 private immutable UPDATE_GAS_LIMIT;
    uint16 private immutable PAYMENT_TRANSFER_GAS_LIMIT;

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSRouter.Main
    struct Main {
        mapping(uint256 chainId => uint64 dstChainIdMinGasLimit) _dstMinGasLimit;
        mapping(uint256 chainId => uint16 dstChainIdProtocolFee) _dstProtocolFee;
        mapping(uint256 chainId => uint64 dstChainIdUpdateGas) _dstUpdateGas;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3fb4de75078a1dcbe9ae3da4a8b51c7f6a145aae2899508efdf94f16ebd0e000;

    error UTSRouter__E0();     // insufficient {payment}
    error UTSRouter__E1();     // invalid {dstChainId} value
    error UTSRouter__E2();     // {protocolVersion} mismatch
    error UTSRouter__E3();     // access denied: you are not a {MASTER_ROUTER}
    error UTSRouter__E4();     // {to} zero address
    error UTSRouter__E5();     // {dstToken} zero address
    error UTSRouter__E6();     // {gasLimit} is less than min amount
    error UTSRouter__E7();     // arguments length mismatch

    event DstMinGasLimitSet(uint256 indexed chainId, uint64 newDstMinGasLimit, address indexed caller);
    event DstProtocolFeeSet(uint256 indexed chainId, uint16 newDstProtocolFee, address indexed caller);
    event DstUpdateGasSet(uint256 indexed chainId, uint64 newDstUpdateGas, address indexed caller);

    /// @custom:oz-upgrades-unsafe-allow constructor
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

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    function bridge(
        bytes calldata dstToken,
        bytes calldata sender,
        bytes calldata to,
        uint256 amount,
        uint8 srcDecimals,
        uint256 dstChainId,
        uint64 gasLimit,
        bytes calldata payload
    ) external payable whenNotPaused() returns(bool success) {
        if (IUTSBase(msg.sender).protocolVersion() != protocolVersion()) revert UTSRouter__E2();
        if (dstMinGasLimit(dstChainId) > gasLimit) revert UTSRouter__E6();
        if (dstChainId == block.chainid) revert UTSRouter__E1();
        if (BYTES32_LENGTH >= to.length) if (bytes32(to) == bytes32(0)) revert UTSRouter__E4();
        if (BYTES32_LENGTH >= dstToken.length) if (bytes32(dstToken) == bytes32(0)) revert UTSRouter__E5();
        if (getBridgeFee(dstChainId, gasLimit, payload.length) > msg.value) revert UTSRouter__E0();

        _paymentTransfer();

        IUTSMasterRouter(MASTER_ROUTER).sendProposal(
            payload.length, 
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
                    gasLimit,
                    payload
                )
            )
        );
        
        return true;
    }

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
            if (BYTES32_LENGTH >= dstPeers[i].length) if (bytes32(dstPeers[i]) == bytes32(0)) revert UTSRouter__E5();

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

    function execute(address dstToken, bytes1 messageType, bytes calldata localParams) external payable returns(uint8) {
        if (msg.sender != MASTER_ROUTER) revert UTSRouter__E3();
        if (paused()) return uint8(OperationResult.RouterPaused);

        if (messageType == UPDATE_MESSAGE_TYPE) return _executeUpdateConfigs(dstToken, localParams);

        if (messageType == BRIDGE_MESSAGE_TYPE) return _executeRedeem(dstToken, localParams);

        return uint8(OperationResult.InvalidMessageType);
    }

    function _executeRedeem(address dstToken, bytes calldata localParams) internal returns(uint8) {
        (
            bytes memory _srcSender,
            bytes memory _to, 
            uint256 _amount, 
            uint256 _srcChainId, 
            bytes memory _srcToken, 
            uint8 _srcDecimals,
            uint64 _gasLimit, 
            bytes memory _payload
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

        (bool _redeemResult, bytes memory _redeemResponse) = dstToken.safeCall(
            _gasLimit,
            0,   // call {value}
            150, // max {_redeemResponse} bytes length to copy
            abi.encodeCall(IUTSBase.redeem, (_receiver, _amount, _payload, _origin))
        );

        if (_redeemResult) {
            return uint8(OperationResult.Success);
        } else {
            (bool _storeResult, /* bytes memory _storeResponse */) = dstToken.safeCall(
                STORE_GAS_LIMIT,
                0, // call {value}
                0, // max {_storeResponse} bytes length to copy
                abi.encodeCall(IUTSBase.storeFailedExecution, (_receiver, _amount, _payload, _origin, _redeemResponse))
            );

            if (_storeResult) {
                return uint8(OperationResult.FailedAndStored);
            } else {
                return uint8(OperationResult.Failed);
            }
        }
    }

    function _executeUpdateConfigs(address dstToken, bytes calldata localParams) internal returns(uint8) {
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

        (bool _updateResult, /* bytes memory _updateResponse */) = dstToken.safeCall(
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

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setDstMinGasLimit(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstMinGasLimits
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstMinGasLimits.length) revert UTSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstMinGasLimit(dstChainIds[i], newDstMinGasLimits[i]);
    }

    function setDstProtocolFee(
        uint256[] calldata dstChainIds, 
        uint16[] calldata newDstProtocolFees
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newDstProtocolFees.length) revert UTSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstProtocolFee(dstChainIds[i], newDstProtocolFees[i]);
    }

    function setDstUpdateGas(
        uint256[] calldata dstChainIds, 
        uint64[] calldata newDstUpdateGas
    ) external onlyRole(MANAGER_ROLE) {
        if (dstChainIds.length != newDstUpdateGas.length) revert UTSRouter__E7();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstUpdateGas(dstChainIds[i], newDstUpdateGas[i]);
    }

    function protocolVersion() public pure returns(bytes2) {
        return 0x0101;
    }

    function getBridgeFee(uint256 dstChainId, uint64 gasLimit, uint256 payloadLength) public view returns(uint256) {
        (uint256 _dstGasPrice, uint256 _dstPricePerByte) = IUTSPriceFeed(PRICE_FEED).getPrices(dstChainId);
        return (gasLimit * _dstGasPrice + payloadLength * _dstPricePerByte) * (BPS + dstProtocolFee(dstChainId)) / BPS;
    }

    function getUpdateFee(uint256[] calldata dstChainIds, uint256[] calldata configsLength) external view returns(uint256 amount) {
        for (uint256 i; dstChainIds.length > i; ++i) amount += _getUpdateFee(dstChainIds[i], configsLength[i]);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function _paymentTransfer() internal {
        IUTSMasterRouter(MASTER_ROUTER).feeCollector().call{
            value: address(this).balance, 
            gas: PAYMENT_TRANSFER_GAS_LIMIT
        }("");
    }

    function _getUpdateFee(uint256 dstChainId, uint256 configsLength) internal view returns(uint256) {
        (uint256 _dstGasPrice, ) = IUTSPriceFeed(PRICE_FEED).getPrices(dstChainId);
        return ((configsLength + 4) * dstUpdateGas(dstChainId) * _dstGasPrice) * (BPS + dstProtocolFee(dstChainId)) / BPS;
    }

    function dstMinGasLimit(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstMinGasLimit[dstChainId];
    }

    function dstProtocolFee(uint256 dstChainId) public view returns(uint16) {
        Main storage $ = _getMainStorage();
        return $._dstProtocolFee[dstChainId];
    }

    function dstUpdateGas(uint256 dstChainId) public view returns(uint64) {
        Main storage $ = _getMainStorage();
        return $._dstUpdateGas[dstChainId];
    }

    function _setDstMinGasLimit(uint256 chainId, uint64 newDstMinGasLimit) internal {
        Main storage $ = _getMainStorage();
        $._dstMinGasLimit[chainId] = newDstMinGasLimit;

        emit DstMinGasLimitSet(chainId, newDstMinGasLimit, msg.sender);
    }

    function _setDstProtocolFee(uint256 chainId, uint16 newDstProtocolFee) internal {
        Main storage $ = _getMainStorage();
        $._dstProtocolFee[chainId] = newDstProtocolFee;

        emit DstProtocolFeeSet(chainId, newDstProtocolFee, msg.sender);
    }

    function _setDstUpdateGas(uint256 chainId, uint64 newDstUpdateGas) internal {
        Main storage $ = _getMainStorage();
        $._dstUpdateGas[chainId] = newDstUpdateGas;

        emit DstUpdateGasSet(chainId, newDstUpdateGas, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}