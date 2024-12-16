// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import "@entangle_protocol/oracle-sdk/contracts/IProposer.sol";

import "./libraries/AddressConverter.sol";
import "./libraries/UTSCoreDataTypes.sol";

import "./interfaces/IUTSMasterRouter.sol";
import "./ERC20/interfaces/IUTSRouter.sol";

/**
 * @notice A contract manages the upper layer sending and receiving of all crosschain messages via UTS protocol V1.
 *
 * @dev It is an implementation of {UTSMasterRouter} for UUPS.
 */
contract UTSMasterRouter is IUTSMasterRouter, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using AddressConverter for bytes;

    /// @notice {AccessControl} role identifier for UTS router addresses.
    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    
    /// @notice {AccessControl} role identifier for pauser addresses.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Internal protocol identifier as bytes32(abi.encodePacked("")).
    bytes32 private constant PROTOCOL_ID = 0x4554530000000000000000000000000000000000000000000000000000000000;

    /// @notice Internal function identifier as PhotonFunctionSelectorLib.encodeFunctionSelector(0, abi.encode(UTSMasterRouter.executeProposal.selector)).
    bytes private constant FUNCTION_SELECTOR = hex'002030faa25900000000000000000000000000000000000000000000000000000000';

    /// @notice Maximum {customPayload} length for crosschain messaging.
    uint16 public constant PAYLOAD_SIZE_LIMIT = 2048;

    /// @notice Address of the {EndPoint} contract.
    address private immutable ENDPOINT;

    /// @notice The gas limit for {router} function call in the {executeProposal} function.
    uint16 private immutable GET_ROUTER_GAS_LIMIT;

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSMasterRouter.Main
    struct Main {
        address _feeCollector;
        mapping(uint256 chainId => bytes dstMasterRouterAddress) _dstMasterRouter;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSMasterRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x9d0b2f5de8f19fc5177eb3417d724c91bd022aca0743e67245c972a15b745f00;

    /// @notice Indicates an error that the function caller is not the {ENDPOINT}.
    error UTSMasterRouter__E0();
    
    /// @notice Indicates an error that the provided {payloadLength} exceeds the {PAYLOAD_SIZE_LIMIT}.
    error UTSMasterRouter__E1();

    /// @notice Indicates an error that the provided {dstChainId} is not supported.
    error UTSMasterRouter__E2();

    /// @notice Indicates an error that lengths of provided arrays do not match.
    error UTSMasterRouter__E3();

    /**
     * @notice Emitted when the {_feeCollector} address is updated.
     * @param newFeeCollector new {_feeCollector} address.
     * @param caller the caller address who set the new {_feeCollector}.
     */
    event FeeCollectorSet(address newFeeCollector, address indexed caller);

    /**
     * @notice Emitted when the {_dstMasterRouter} contract address is updated.
     * @param chainId destination chain Id.
     * @param newDstMasterRouter new {_dstMasterRouter} address for corresponding {dstChainId}.
     * @param caller the caller address who set the new {_dstMasterRouter}.
     */
    event DstMasterRouterSet(uint256 indexed chainId, bytes newDstMasterRouter, address indexed caller);

    /**
     * @notice Emitted when received crosschain message is executed.
     * @param OperationResult the execution result code, represented as a uint8(UTSCoreDataTypes.OperationResult).
     * @param dstPeerAddress current chain target contract address, e.g. {UTSToken} or {UTSFactory}.
     * @param router target contract's {router}, e.g. {UTSRouter}.
     * @param params abi.encoded local execution params.
     * @param srcChainId source message chain Id.
     * @param srcOpTxId source message transaction hash.
     */
    event ProposalExecuted(
        uint8 indexed OperationResult, 
        address indexed dstPeerAddress, 
        address router, 
        bytes params,
        uint256 indexed srcChainId,
        bytes32[2] srcOpTxId
    );

    /**
     * @notice Initializes immutable variables.
     * @param endpoint {EndPoint} contract address.
     * @param getRouterGasLimit the gas limit for {router} function call in the {executeProposal} function.
     *
     * @custom:oz-upgrades-unsafe-allow constructor
     */ 
    constructor(address endpoint, uint16 getRouterGasLimit) {
        _disableInitializers();

        ENDPOINT = endpoint;
        GET_ROUTER_GAS_LIMIT = getRouterGasLimit;
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
     * @notice Sends a crosschain message to the destination chain.
     * @param payloadLength {customPayload} length.
     * @param dstChainId destination chain Id.
     * @param params abi.encoded local execution params.
     * @dev Only addresses with the {ROUTER_ROLE} can execute this function.
     */
    function sendProposal(
        uint256 payloadLength, 
        uint256 dstChainId, 
        bytes calldata params
    ) external payable onlyRole(ROUTER_ROLE) whenNotPaused() {
        if (payloadLength > PAYLOAD_SIZE_LIMIT) revert UTSMasterRouter__E1();
        bytes memory _dstMasterRouterAddress = dstMasterRouter(dstChainId);
        if (_dstMasterRouterAddress.length == 0) revert UTSMasterRouter__E2();

        IProposer(ENDPOINT).propose(
            PROTOCOL_ID, 
            dstChainId, 
            _dstMasterRouterAddress, 
            FUNCTION_SELECTOR, 
            params
        );
    }

    /**
     * @notice Executes a crosschain message received from {UTSMasterRouter} on source chain and directs execution 
     * to the appropriate UTS router.
     * @param data abi.encoded execution params.
     * @dev Only {ENDPOINT} can execute this function.
     */
    function executeProposal(bytes calldata data) external payable {
        if (msg.sender != ENDPOINT) revert UTSMasterRouter__E0();

        (
            /* bytes32 _srcProtocolId */, 
            uint256 _srcChainId,
            /* uint256 _srcBlockNumber */, 
            bytes32[2] memory _srcOpTxId, 
            bytes memory _params
        ) = abi.decode(data, (bytes32, uint256, uint256, bytes32[2], bytes));

        ( 
            bytes memory _dstPeer, 
            bytes1 _messageType,
            bytes memory _localParams
        ) = abi.decode(_params, (bytes, bytes1, bytes));

        (
            address _dstPeerAddress, 
            address _router, 
            uint8 _opResult
        ) = (_dstPeer.toAddress(), address(0), uint8(OperationResult.Success));

        (
            bool _getRouterResult,
            bytes memory _getRouterResponse
        ) = _dstPeerAddress.staticcall{gas: GET_ROUTER_GAS_LIMIT}(abi.encodeWithSignature("router()"));

        if (_getRouterResult && _getRouterResponse.length > 0) {
            _router = _getRouterResponse.toAddressPadded();

            if (!paused()) {
                if (hasRole(ROUTER_ROLE, _router)) {
                    (bool _executeResult, bytes memory _executeResponse) = _router.call(
                        abi.encodeCall(IUTSRouter.execute, (_dstPeerAddress, _messageType, _localParams))
                    );

                    if (_executeResult && _executeResponse.length > 0) {
                        _opResult = abi.decode(_executeResponse, (uint8));
                    } else {
                        _opResult = uint8(OperationResult.IncompatibleRouter);
                    }
                } else {
                    _opResult = uint8(OperationResult.UnauthorizedRouter);
                }
            } else {
                _opResult = uint8(OperationResult.MasterRouterPaused);
            }
        } else {
            _opResult = uint8(OperationResult.InvalidDstPeerAddress);
        }

        emit ProposalExecuted(_opResult, _dstPeerAddress, _router, _params, _srcChainId, _srcOpTxId);
    }

    /**
     * @notice Sets the {_feeCollector} address.
     * @param newFeeCollector new {_feeCollector} address.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     */
    function setFeeCollector(address newFeeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setFeeCollector(newFeeCollector);
    }

    /**
     * @notice Sets the destination {UTSMasterRouter} contract addresses.
     * @param dstChainIds destination chain Ids.
     * @param newDstMasterRouter new {UTSMasterRouter} addresses on the corresponding {dstChainId}.
     * @dev Only addresses with the {DEFAULT_ADMIN_ROLE} can execute this function.
     * @dev The {UTSMasterRouter} address MUST be represented as abi.encode(address) for EVM compatible chains.
     */
    function setDstMasterRouter(
        uint256[] calldata dstChainIds, 
        bytes[] calldata newDstMasterRouter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newDstMasterRouter.length) revert UTSMasterRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstMasterRouter(dstChainIds[i], newDstMasterRouter[i]);
    }

    /**
     * @notice Pauses the {sendProposal} and {executeProposal} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses the {sendProposal} and {executeProposal} functions.
     * @dev Only addresses with the {PAUSER_ROLE} can execute this function.
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Returns whether provided {target} address has the {AccessControl.ROUTER_ROLE}.
     * @param target target contract address.
     * @return isAuthorized result.
     */
    function validateRouter(address target) external view returns(bool isAuthorized) {
        return hasRole(ROUTER_ROLE, target);
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSMasterRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * @notice Returns the {_feeCollector} address.
     * @return {_feeCollector} address.
     */
    function feeCollector() external view returns(address) {
        Main storage $ = _getMainStorage();
        return $._feeCollector;
    }

    /**
     * @notice Returns the destination {UTSMasterRouter} contract address.
     * @param dstChainId destination chain Id.
     * @return {UTSMasterRouter} address on the corresponding {dstChainId}.
     */
    function dstMasterRouter(uint256 dstChainId) public view returns(bytes memory) {
        Main storage $ = _getMainStorage();
        return $._dstMasterRouter[dstChainId];
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function _setFeeCollector(address newFeeCollector) internal {
        Main storage $ = _getMainStorage();
        $._feeCollector = newFeeCollector;

        emit FeeCollectorSet(newFeeCollector, msg.sender);
    }

    function _setDstMasterRouter(uint256 dstChainId, bytes memory newDstMasterRouter) internal {
        Main storage $ = _getMainStorage();
        $._dstMasterRouter[dstChainId] = newDstMasterRouter;

        emit DstMasterRouterSet(dstChainId, newDstMasterRouter, msg.sender);
    }

    function _getMainStorage() private pure returns(Main storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }
}