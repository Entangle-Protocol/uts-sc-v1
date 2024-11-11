// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ERC20Burnable.sol";
import "../extensions/UTSBaseIndexed.sol";

import "../interfaces/IUTSToken.sol";

contract UTSToken is IUTSToken, UTSBaseIndexed, ERC20Burnable, AccessControl {
    using AddressConverter for bytes;

    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    bool public globalBurnable;
    bool public onlyRoleBurnable;

    error UTSToken__E0();     // access denied: only role allowed
    error UTSToken__E1();     // non burnable   

    function initializeToken(DeployTokenData calldata params) external { 
        __ERC20_init(params.name, params.symbol);
        __UTSBase_init(
            params.decimals,
            params.router.toAddress(),  
            params.allowedChainIds,
            params.chainConfigs
        );

        if (params.initialSupply > 0) super._update(address(0), params.owner.toAddress(), params.initialSupply);

        globalBurnable = params.onlyRoleBurnable ? true : params.globalBurnable;
        onlyRoleBurnable = params.onlyRoleBurnable;

        _grantRole(DEFAULT_ADMIN_ROLE, params.owner.toAddress());
    }

    function decimals() public view override returns(uint8) {
        return _decimals;
    }

    function underlyingToken() public view override returns(address) {
        return address(this);
    }

    function supportsInterface(bytes4 interfaceId) public view override(UTSBase, AccessControl) returns(bool) {
        return interfaceId == type(IUTSToken).interfaceId || interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    function _burnFrom(
        address spender,
        address from,
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* payload */
    ) internal virtual override returns(uint256) {
        if (from != spender) _spendAllowance(from, spender, amount);

        super._update(from, address(0), amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* payload */,
        Origin memory /* origin */
    ) internal virtual override returns(uint256) {
        super._update(address(0), to, amount);

        return amount;
    }

    function _authorizeCall() internal virtual override onlyRole(DEFAULT_ADMIN_ROLE) {
        
    }

    function _update(address from, address to, uint256 value) internal virtual override {
        if (to == address(0)){
            if (!globalBurnable) revert UTSToken__E1();
            if (onlyRoleBurnable) if (!hasRole(BURNER_ROLE, msg.sender)) revert UTSToken__E0();
        }

        super._update(from, to, value);
    }

}