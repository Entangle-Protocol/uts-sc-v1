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

contract UTSMasterRouter is IUTSMasterRouter, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using AddressConverter for bytes;

    bytes32 public constant ROUTER_ROLE = keccak256("ROUTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @dev protocol name as bytes32(abi.encodePacked(""))
    bytes32 private constant PROTOCOL_ID = 0x4554530000000000000000000000000000000000000000000000000000000000;

    /// @dev PhotonFunctionSelectorLib.encodeFunctionSelector(0, abi.encode(UTSMasterRouter.executeProposal.selector))
    bytes   private constant FUNCTION_SELECTOR = hex'002030faa25900000000000000000000000000000000000000000000000000000000';

    uint16   public constant PAYLOAD_SIZE_LIMIT = 2048;

    address private immutable ENDPOINT;
    uint16  private immutable GET_ROUTER_GAS_LIMIT;

    /// @custom:storage-location erc7201:UTSProtocol.storage.UTSMasterRouter.Main
    struct Main {
        address _feeCollector;
        mapping(uint256 chainId => bytes dstMasterRouterAddress) _dstMasterRouter;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("UTSProtocol.storage.UTSMasterRouter.Main")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x9d0b2f5de8f19fc5177eb3417d724c91bd022aca0743e67245c972a15b745f00;

    error UTSMasterRouter__E0();     // access denied: you are not an {ENDPOINT}
    error UTSMasterRouter__E1();     // {payloadLength} exceeds limit
    error UTSMasterRouter__E2();     // unallowed {dstChainId}
    error UTSMasterRouter__E3();     // arguments length mismatch

    event FeeCollectorSet(address newFeeCollector, address indexed caller);
    event DstMasterRouterSet(uint256 indexed chainId, bytes newDstMasterRouter, address indexed caller);
    event ProposalExecuted(
        uint8 indexed OperationResult, 
        address indexed dstPeerAddress, 
        address router, 
        bytes params,
        uint256 indexed srcChainId,
        bytes32[2] srcOpTxId
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address endpoint, uint16 getRouterGasLimit) {
        _disableInitializers();

        ENDPOINT = endpoint;
        GET_ROUTER_GAS_LIMIT = getRouterGasLimit;
    }

    function initialize(address defaultAdmin) external initializer() {
        __UUPSUpgradeable_init();
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

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
            OperationResult _opResult
        ) = (_dstPeer.toAddress(), address(0), OperationResult.Success);

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
                        _opResult = OperationResult(abi.decode(_executeResponse, (uint8)));
                    } else {
                        _opResult = OperationResult.IncompatibleRouter;
                    }
                } else {
                    _opResult = OperationResult.UnauthorizedRouter;
                }
            } else {
                _opResult = OperationResult.MasterRouterPaused;
            }
        } else {
            _opResult = OperationResult.InvalidDstPeerAddress;
        }

        emit ProposalExecuted(uint8(_opResult), _dstPeerAddress, _router, _params, _srcChainId, _srcOpTxId);
    }

    function setFeeCollector(address newFeeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setFeeCollector(newFeeCollector);
    }

    function setDstMasterRouter(
        uint256[] calldata dstChainIds, 
        bytes[] calldata newDstMasterRouter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dstChainIds.length != newDstMasterRouter.length) revert UTSMasterRouter__E3();
        for (uint256 i; dstChainIds.length > i; ++i) _setDstMasterRouter(dstChainIds[i], newDstMasterRouter[i]);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function validateRouter(address target) external view returns(bool) {
        return hasRole(ROUTER_ROLE, target);
    }

    function _authorizeUpgrade(address /* newImplementation */) internal override onlyRole(DEFAULT_ADMIN_ROLE) {

    }

    function supportsInterface(bytes4 interfaceId) public view override returns(bool) {
        return interfaceId == type(IUTSMasterRouter).interfaceId || super.supportsInterface(interfaceId);
    }

    function feeCollector() external view returns(address) {
        Main storage $ = _getMainStorage();
        return $._feeCollector;
    }

    function dstMasterRouter(uint256 dstChainId) public view returns(bytes memory) {
        Main storage $ = _getMainStorage();
        return $._dstMasterRouter[dstChainId];
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