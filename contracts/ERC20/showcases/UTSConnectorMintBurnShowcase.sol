// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../UTSBase.sol";

interface IERC20Extended {
    
    function mint(address to, uint256 amount) external;

    function burnFrom(address from, uint256 amount) external;

}

contract UTSConnectorMintBurnShowcase is UTSBase, Ownable, Pausable {

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

    function pause() external onlyOwner() {
        _pause();
    }

    function unpause() external onlyOwner() {
        _unpause();
    }

    function _burnFrom(
        address spender,
        address /* from */, 
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal override whenNotPaused() returns(uint256) {
        IERC20Extended(_underlyingToken).burnFrom(spender, amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
        Origin memory /* origin */
    ) internal override whenNotPaused() returns(uint256) {
        IERC20Extended(_underlyingToken).mint(to, amount);

        return amount;
    }

    function _authorizeCall() internal override onlyOwner() {

    }

}