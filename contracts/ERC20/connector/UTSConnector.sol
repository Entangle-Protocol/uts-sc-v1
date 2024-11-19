// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../extensions/UTSBaseIndexed.sol";

import "../interfaces/IUTSConnector.sol";

contract UTSConnector is IUTSConnector, UTSBaseIndexed, AccessControl {
    using SafeERC20 for IERC20Metadata;

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

    function underlyingDecimals() external view returns(uint8) {
        return _decimals;
    }

    function underlyingBalance() external view returns(uint256) {
        return IERC20Metadata(_underlyingToken).balanceOf(address(this));
    }

    function underlyingName() external view returns(string memory) {
        return IERC20Metadata(_underlyingToken).name();
    }

    function underlyingSymbol() external view returns(string memory) {
        return IERC20Metadata(_underlyingToken).symbol();
    }

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