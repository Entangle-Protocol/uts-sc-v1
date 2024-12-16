// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../extensions/UTSBaseIndexed.sol";

import "../interfaces/IUTSConnector.sol";

/**
 * @notice A contract that provides functionality to use UTS protocol V1 crosschain messaging for bridging 
 * existing ERC20 token.
 * 
 * A UTSConnector stores and releases underlying ERC20 tokens and interacts with the UTS protocol.
 */
contract UTSConnector is IUTSConnector, UTSBaseIndexed, AccessControl {
    using SafeERC20 for IERC20Metadata;

    /**
     * @notice Initializes basic settings with provided parameters.
     * @param _owner the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}.
     * @param underlyingToken_ underlying ERC20 token address.
     * @param _router the address of the authorized {UTSRouter}.
     * @param _allowedChainIds chains Ids available for bridging in both directions.
     * @param _chainConfigs array of {ChainConfig} settings for provided {_allowedChainIds}.
     * @dev See the {UTSERC20DataTypes.ChainConfig} for details.
     * @dev Can and MUST be called only once. Reinitialization is prevented by {UTSBase.__UTSBase_init} function.
     */
    function initializeConnector(
        address _owner,
        address underlyingToken_,
        address _router,  
        uint256[] calldata _allowedChainIds,
        ChainConfig[] calldata _chainConfigs
    ) external { 
        __UTSBase_init(underlyingToken_, IERC20Metadata(underlyingToken_).decimals());

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
    }

    /**
     * @notice Returns decimals value of the underlying ERC20 token.
     * @return {ERC20.decimals} of the {_underlyingToken}.
     */
    function underlyingDecimals() external view returns(uint8) {
        return _decimals;
    }

    /**
     * @notice Returns the balance of the underlying ERC20 token held by the UTSConnector.
     * @return {_underlyingToken} balance held by the {UTSConnector}.
     */
    function underlyingBalance() external view returns(uint256) {
        return IERC20Metadata(_underlyingToken).balanceOf(address(this));
    }

    /**
     * @notice Returns the name of the underlying ERC20 token.
     * @return {IERC20.name} of the {_underlyingToken}.
     */
    function underlyingName() external view returns(string memory) {
        return IERC20Metadata(_underlyingToken).name();
    }

    /**
     * @notice Returns the symbol of the underlying ERC20 token.
     * @return {IERC20.symbol} of the {_underlyingToken}.
     */
    function underlyingSymbol() external view returns(string memory) {
        return IERC20Metadata(_underlyingToken).symbol();
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
    function supportsInterface(bytes4 interfaceId) public view override(UTSBase, AccessControl) returns(bool) {
        return interfaceId == type(IUTSConnector).interfaceId || super.supportsInterface(interfaceId);
    }

    function _burnFrom(
        address spender,
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal virtual override returns(uint256) {
        IERC20Metadata(_underlyingToken).safeTransferFrom(spender, address(this), amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal virtual override returns(uint256) {
        if (to != address(this)) IERC20Metadata(_underlyingToken).safeTransfer(to, amount);

        return amount;
    }

    function _authorizeCall() internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }
}