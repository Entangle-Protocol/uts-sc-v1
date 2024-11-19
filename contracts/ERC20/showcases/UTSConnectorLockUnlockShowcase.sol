// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../UTSBase.sol";

contract UTSConnectorLockUnlockShowcase is UTSBase, Ownable {
    using SafeERC20 for IERC20;

    constructor(
        address underlyingToken_,
        address _router,  
        uint256[] memory _allowedChainIds,
        ChainConfig[] memory _chainConfigs
    ) Ownable(msg.sender) {
        __UTSBase_init(underlyingToken_, IERC20Metadata(underlyingToken_).decimals());

        _setRouter(_router);
        _setChainConfig(_allowedChainIds, _chainConfigs);
    }

    function underlyingDecimals() external view returns(uint8) {
        return _decimals;
    }

    function _burnFrom(
        address spender,
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal override returns(uint256) {
        IERC20(_underlyingToken).safeTransferFrom(spender, address(this), amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override returns(uint256) {
         IERC20(_underlyingToken).safeTransfer(to, amount);

        return amount;
    }

    function _authorizeCall() internal override onlyOwner() {

    }

}