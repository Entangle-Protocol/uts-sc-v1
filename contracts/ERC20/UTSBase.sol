// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "contracts/libraries/BytesLib.sol";
import "contracts/libraries/AddressConverter.sol";
import "contracts/libraries/DecimalsConverter.sol"; 
import "contracts/libraries/UTSERC20DataTypes.sol";

import "./interfaces/IUTSBase.sol";
import "./interfaces/IUTSRouter.sol";

/**
 * @dev
 * The {__UTSBase_init} function must be called before using other functions of the {UTSBase} contract.
 * The {_authorizeCall} function must be overridden to include access restriction to the {setRouter} and {setChainConfig} functions.
 * The {_mintTo} function must be overridden to implement {mint}/{transfer} underlying tokens to receiver {to} address by {_router}.
 * The {_burnFrom} function must be overridden to implement {burn}/{transferFrom} underlying tokens from {spender}/{from} address for bridging.
 */
abstract contract UTSBase is IUTSBase, ERC165 {
    using AddressConverter for address;
    using DecimalsConverter for uint256;
    using BytesLib for bytes;

    uint256 private  _retryNonce;
    address private  _router;

    address internal _underlyingToken;
    uint8   internal _decimals;

    mapping(uint256 chainId => ChainConfig dstChainConfig) internal _chainConfig;
    mapping(bytes32 msgHash => address receiverAddress) private _failedExecution;

    error UTSBase__E0();     // initialized
    error UTSBase__E1();     // access denied: only {router} allowed
    error UTSBase__E2();     // {to} zero address
    error UTSBase__E3();     // zero {amount} to bridge
    error UTSBase__E4();     // arguments length mismatch
    error UTSBase__E5();     // {peer} address paused
    error UTSBase__E6();     // {gasLimit} is less than min amount
    error UTSBase__E7();     // invalid {peer} address

    event RouterSet(address indexed caller, address newRouter);
    event ChainConfigUpdated(address indexed caller, uint256[] allowedChainIds, ChainConfig[] chainConfigs);
    event Redeemed(
        address indexed to, 
        uint256 amount, 
        bytes indexed peerAddressIndexed, 
        bytes peerAddress,
        uint256 indexed chainId,
        bytes sender
    );
    event Bridged(
        address indexed spender, 
        address from, 
        bytes indexed peerAddressIndexed, 
        bytes peerAddress,
        bytes to, 
        uint256 amount, 
        uint256 indexed chainId
    );
    event ExecutionFailed(
        address indexed to, 
        uint256 amount, 
        bytes customPayload, 
        Origin indexed originIndexed, 
        Origin origin,
        bytes indexed result, 
        uint256 nonce
    );

    /**
     * @notice Initializes basic settings
     * @param underlyingToken_ underlying ERC20 token address
     * @param decimals_ underlying token decimals
     * @notice Сan and should be called only once
     */
    function __UTSBase_init(address underlyingToken_, uint8 decimals_) internal {
        if (_retryNonce > 0) revert UTSBase__E0();

        _underlyingToken = underlyingToken_;
        _decimals = decimals_;
        // {_retryNonce} counter increases here for two reasons: 
        // 1. to block repeated {__UTSBase_init} call
        // 2. initialize the {_retryNonce} variable to unify the gas limit calculation of the {storeFailedExecution} call
        _retryNonce = 1;
    }

    /**
     * @notice Initiates the tokens bridging
     * @param from source tokens holder
     * @param to destination tokens receiver
     * @param amount amount to bridge
     * @param dstChainId destination chain Id
     * @param dstGasLimit {redeem} call gas limit
     * @param customPayload user's additional data
     * @param protocolPayload protocol's additional data
     * @return success Call result
     * @return bridgedAmount bridged amount
     */
    function bridge(
        address from,
        bytes calldata to, 
        uint256 amount, 
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes calldata customPayload,
        bytes calldata protocolPayload
    ) external payable virtual returns(bool success, uint256 bridgedAmount) {

        return _bridge(
            msg.sender, 
            from, 
            to, 
            amount, 
            dstChainId, 
            dstGasLimit, 
            customPayload, 
            protocolPayload
        );
    }

    /**
     * @notice Executes the tokens delivery from the source chain
     * @param to tokens receiver
     * @param amount amount to receive
     * @param customPayload user's additional data
     * @param origin source chain settings
     * @return Call result
     * @notice Only the {_router} can execute this function
     */
    function redeem(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin
    ) external payable virtual returns(bool) {
        _onlyRouter();

        return _redeem(to, amount, customPayload, origin);
    }

    /**
     * @notice Stores failed execution's data
     * @param to tokens receiver
     * @param amount amount to receive
     * @param customPayload user's additional data
     * @param origin source chain settings
     * @param result handled error message
     * @notice Only the {_router} can execute this function
     */
    function storeFailedExecution(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        bytes calldata result
    ) external virtual {
        _onlyRouter();

        _failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, _retryNonce))] = to;

        emit ExecutionFailed(to, amount, customPayload, origin, origin, result, _retryNonce);

        _retryNonce++;
    }

    /**
     * @notice Executes the tokens delivery after failed execution
     * @param to tokens receiver
     * @param amount amount to receive
     * @param customPayload user's additional data
     * @param origin source chain settings
     * @param nonce unique failed execution's counter
     * @return Call result
     */
    function retryRedeem(
        address to,
        uint256 amount,
        bytes calldata customPayload,
        Origin calldata origin,
        uint256 nonce
    ) external virtual returns(bool) {
        if (to == address(0)) return false;
        bytes32 _hash = keccak256(abi.encode(to, amount, customPayload, origin, nonce));
        if (_failedExecution[_hash] != to) return false;
        delete _failedExecution[_hash];

        return _redeem(to, amount, customPayload, origin);
    }

    /**
     * @notice Sets the destination chains settings
     * @param allowedChainIds chains Ids available for bridging
     * @param chainConfigs chains Ids settings
     * @return Call result
     */
    function setChainConfig(
        uint256[] calldata allowedChainIds,
        ChainConfig[] calldata chainConfigs
    ) external virtual returns(bool) {
        _authorizeCall();
        _setChainConfig(allowedChainIds, chainConfigs);

        return true;
    }

    /**
     * @notice Sets the UTSRouter address
     * @param newRouter UTSRouter address
     * @return Call result
     */
    function setRouter(address newRouter) external virtual returns(bool) {
        _authorizeCall();
        _setRouter(newRouter);

        return true;
    }

    /**
     * @notice Returns the UTSRouter {_router} address
     * @return routerAddress UTSRouter address
     */
    function router() public view returns(address routerAddress) {
        return _router;
    }

    /**
     * @notice Returns the UTSBase {protocolVersion}
     * @return UTSBase protocol version
     */
    function protocolVersion() public pure virtual returns(bytes2) {
        return 0x0101;
    }

    /**
     * @notice Returns the {underlyingToken} ERC20 address
     * @return Underlying ERC20 token address
     */
    function underlyingToken() public view virtual returns(address) {
        return _underlyingToken;
    }

    /**
     * @notice Returns whether failed execution's data is stored 
     * @param to tokens receiver
     * @param amount amount to receive
     * @param customPayload user's additional data
     * @param origin source chain settings
     * @param nonce unique failed execution's counter
     * @return Result
     */
    function isExecutionFailed(
        address to, 
        uint256 amount, 
        bytes calldata customPayload, 
        Origin calldata origin,
        uint256 nonce
    ) external view virtual returns(bool) {
        if (to == address(0)) return false;
        return _failedExecution[keccak256(abi.encode(to, amount, customPayload, origin, nonce))] == to;
    }

    /**
     * @notice Returns estimated minimal amount to pay for bridging and minimal gas limit
     * @param dstChainId destination chain Id
     * @param dstGasLimit {redeem} call gas limit
     * @param customPayloadLength user's additional data length
     * @param protocolPayload protocol's additional data
     * @return paymentAmount source chain native coin amount to pay for bridging
     * @return dstMinGasLimit destination chain minimal gas limit 
     */
    function estimateBridgeFee(
        uint256 dstChainId, 
        uint64 dstGasLimit, 
        uint16 customPayloadLength,
        bytes calldata protocolPayload
    ) public view virtual returns(uint256 paymentAmount, uint64 dstMinGasLimit) {
        dstMinGasLimit = IUTSRouter(_router).dstMinGasLimit(dstChainId);
        uint64 _configMinGasLimit = _chainConfig[dstChainId].minGasLimit;

        return (
            IUTSRouter(_router).getBridgeFee(dstChainId, dstGasLimit, customPayloadLength, protocolPayload), 
            dstMinGasLimit >= _configMinGasLimit ? dstMinGasLimit : _configMinGasLimit
        );
    }

    /**
     * @notice Returns configs for bridge/redeem functions 
     * @param chainIds destination chain Ids
     * @return configs {_chainConfig} array
     */
    function getChainConfigs(uint256[] calldata chainIds) external view returns(ChainConfig[] memory configs) {
        configs = new ChainConfig[](chainIds.length);
        for (uint256 i; chainIds.length > i; ++i) configs[i] = _chainConfig[chainIds[i]];
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns(bool) {
        return interfaceId == type(IUTSBase).interfaceId || super.supportsInterface(interfaceId);
    }

    function _bridge(
        address spender,
        address from,
        bytes memory to, 
        uint256 amount, 
        uint256 dstChainId, 
        uint64 dstGasLimit,
        bytes memory customPayload,
        bytes memory protocolPayload
    ) internal virtual returns(bool success, uint256 bridgedAmount) {
        if (from == address(0)) from = spender;

        ChainConfig memory config = _chainConfig[dstChainId];

        if (config.minGasLimit > dstGasLimit) revert UTSBase__E6();
        if (config.paused) revert UTSBase__E5();

        uint8 _srcDecimals = _decimals;
        amount = amount.convert(_srcDecimals, config.decimals).convert(config.decimals, _srcDecimals);

        amount = _burnFrom(
            spender,
            from,
            to, 
            amount, 
            dstChainId, 
            customPayload
        );

        if (amount == 0) revert UTSBase__E3();

        emit Bridged(spender, from, config.peerAddress, config.peerAddress, to, amount, dstChainId);

        return (
            _sendRequest(
                msg.value,
                config.peerAddress, 
                to, 
                amount,
                _srcDecimals, 
                dstChainId,
                dstGasLimit,
                customPayload,
                protocolPayload
            ), 
            amount
        );
    }

    function _sendRequest(
        uint256 payment,
        bytes memory dstToken,
        bytes memory to,
        uint256 amount,
        uint8 srcDecimals,
        uint256 dstChainId,
        uint64 dstGasLimit,
        bytes memory customPayload,
        bytes memory protocolPayload
    ) internal virtual returns(bool success) {
        return IUTSRouter(_router).bridge{value: payment}( 
            dstToken,
            msg.sender.toBytes(),
            to,
            amount,
            srcDecimals,
            dstChainId,
            dstGasLimit,
            customPayload,
            protocolPayload
        );
    }

    function _redeem(
        address to,
        uint256 amount,
        bytes memory customPayload,
        Origin memory origin
    ) internal virtual returns(bool success) {
        if (to == address(0)) revert UTSBase__E2();

        ChainConfig memory config = _chainConfig[origin.chainId];

        if (!config.peerAddress.equal(origin.peerAddress)) revert UTSBase__E7();
        if (config.paused) revert UTSBase__E5();
        
        amount = _mintTo(to, amount.convert(origin.decimals, _decimals), customPayload, origin);

        emit Redeemed(to, amount, origin.peerAddress, origin.peerAddress, origin.chainId, origin.sender);

        return true;
    }

    function _setChainConfig(uint256[] memory allowedChainIds, ChainConfig[] memory chainConfigs) internal virtual {
        if (allowedChainIds.length != chainConfigs.length) revert UTSBase__E4();
        for (uint256 i; allowedChainIds.length > i; ++i) _chainConfig[allowedChainIds[i]] = chainConfigs[i];

        emit ChainConfigUpdated(msg.sender, allowedChainIds, chainConfigs);
    }

    function _setRouter(address newRouter) internal virtual {
        _router = newRouter;

        emit RouterSet(msg.sender, newRouter);
    }

    function _onlyRouter() internal view {
        if (msg.sender != _router) revert UTSBase__E1();
    }

    function _authorizeCall() internal virtual;

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory customPayload,
        Origin memory origin
    ) internal virtual returns(uint256);

    function _burnFrom(
        address spender,
        address from,
        bytes memory to, 
        uint256 amount, 
        uint256 dstChainId, 
        bytes memory customPayload
    ) internal virtual returns(uint256);
}