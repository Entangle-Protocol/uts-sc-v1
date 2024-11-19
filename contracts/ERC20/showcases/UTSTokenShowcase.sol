// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../UTSBase.sol";

contract UTSTokenShowcase is UTSBase, ERC20, Ownable {

    constructor(
        address _router,  
        uint256[] memory _allowedChainIds,
        ChainConfig[] memory _chainConfigs
    ) Ownable(msg.sender) ERC20("UTS Token Showcase", "UTSTS") {
        __UTSBase_init(address(this), decimals());

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);

        _mint(msg.sender, 1_000_000 * 10 ** decimals());
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

        _update(from, address(0), amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override returns(uint256) {
        _update(address(0), to, amount);

        return amount;
    }

    function _authorizeCall() internal override onlyOwner() {
        
    }

}