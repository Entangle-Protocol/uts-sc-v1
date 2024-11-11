// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import "../UTSBase.sol";

interface IERC20Extended {
    
    function mintTo(address to, uint256 amount) external;

    function burnFrom(address from, uint256 amount) external;

}

contract UTSConnectorMintBurnShowcase is UTSBase, Ownable, Pausable {

    IERC20Extended private immutable _underlyingToken;

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

        _underlyingToken = IERC20Extended(underlyingToken_);
    }

    function underlyingDecimals() external view returns(uint8) {
        return _decimals;
    }

    function underlyingToken() public view override returns(address) {
        return address(_underlyingToken);
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
        bytes memory /* payload */
    ) internal override whenNotPaused() returns(uint256) {
        _underlyingToken.burnFrom(spender, amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* payload */,
        Origin memory /* origin */
    ) internal override whenNotPaused() returns(uint256) {
        _underlyingToken.mintTo(to, amount);

        return amount;
    }

    function _authorizeCall() internal override onlyOwner() {

    }

}