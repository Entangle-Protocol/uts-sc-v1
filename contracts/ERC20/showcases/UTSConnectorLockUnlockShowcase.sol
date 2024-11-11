// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../UTSBase.sol";

contract UTSConnectorLockUnlockShowcase is UTSBase, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable _underlyingToken;

    constructor(
        address underlyingToken_,
        address _router,  
        uint256[] memory _allowedChainIds,
        ChainConfig[] memory _chainConfigs
    ) Ownable(msg.sender) {
        __UTSBase_init(
            IERC20Metadata(underlyingToken_).decimals(),
            _router,  
            _allowedChainIds,
            _chainConfigs
        );

        _underlyingToken = IERC20(underlyingToken_);
    }

    function underlyingDecimals() external view returns(uint8) {
        return _decimals;
    }

    function underlyingToken() public view override returns(address) {
        return address(_underlyingToken);
    }

    function _burnFrom(
        address spender,
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* payload */
    ) internal override returns(uint256) {
        _underlyingToken.safeTransferFrom(spender, address(this), amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* payload */,
        Origin memory /* origin */
    ) internal override returns(uint256) {
        _underlyingToken.safeTransfer(to, amount);

        return amount;
    }

    function _authorizeCall() internal override onlyOwner() {

    }

}