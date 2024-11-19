// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ERC20Modified.sol";
import "../extensions/UTSBaseIndexed.sol";

contract UTSTokenPure is UTSBaseIndexed, ERC20Modified, AccessControl {
    using AddressConverter for bytes;

    function initializeToken(DeployTokenData calldata params) external { 
        __ERC20_init(params.name, params.symbol);
        __UTSBase_init(address(this), params.decimals);

        _setRouter(params.router.toAddress());
        _setChainConfig(params.allowedChainIds, params.chainConfigs);

        if (params.initialSupply > 0) {
            _update(address(0), params.owner.toAddress(), params.mintedAmountToOwner);
            _update(address(0), address(this), params.initialSupply - params.mintedAmountToOwner);
        }

        _grantRole(DEFAULT_ADMIN_ROLE, params.owner.toAddress());
    }

    function decimals() public view override returns(uint8) {
        return _decimals;
    }

    function supportsInterface(bytes4 interfaceId) public view override(UTSBase, AccessControl) returns(bool) {
        return interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    function _burnFrom(
        address spender,
        address from, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal override returns(uint256) {
        if (from != spender) _spendAllowance(from, spender, amount);

        _transfer(from, address(this), amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override returns(uint256) {
        if (to != address(this)) _transfer(address(this), to, amount);
        
        return amount;
    }

    function _authorizeCall() internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }

}