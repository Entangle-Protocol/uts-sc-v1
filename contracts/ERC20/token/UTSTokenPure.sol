// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ERC20Modified.sol";
import "../extensions/UTSBaseIndexed.sol";

/**
 * @notice An ERC20 compliant token contract with integrated functionality to use UTS protocol V1 crosschain messaging
 * for bridging this token itself.    
 *
 * @dev A lock/unlock mechanism is used to send and receive {UTSTokenPure} tokens crosschain bridges. 
 * A UTSTokenPure contract stores and releases {UTSTokenPure} tokens itself.
 * This token has a fixed total supply, {UTSTokenPure} tokens cannot be minted or burned once the contract is initialized.
 */
contract UTSTokenPure is UTSBaseIndexed, ERC20Modified, AccessControl {
    using AddressConverter for bytes;

    /**
     * @notice Initializes basic settings with provided parameters.
     *
     * @param params {DeployTokenData} struct containing {UTSTokenPure} initialization parameters: 
     *        owner: the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}
     *        name: the {ERC20.name} of the {UTSTokenPure} token
     *        symbol: the {ERC20.symbol} of the {UTSTokenPure} token
     *        decimals: the {ERC20.decimals} of the {UTSTokenPure} token
     *        initialSupply: total initial {UTSTokenPure} supply to mint
     *        mintedAmountToOwner: initial {UTSTokenPure} supply to mint to {owner} balance
     *        pureToken: flag indicating whether the {UTSToken} is use lock/unlock or mint/burn mechanism for bridging
     *        mintable: flag indicating whether {owner} can mint an unlimited amount of {UTSTokenPure} tokens
     *        globalBurnable: flag indicating whether the {UTSTokenPure} is globally burnable by anyone
     *        onlyRoleBurnable: flag indicating whether only addresses with the {AccessControl.BURNER_ROLE} can burn tokens
     *        feeModule: flag indicating whether the {UTSTokenPure} is supports the fee deducting for bridging
     *        router: the address of the authorized {UTSRouter}
     *        allowedChainIds: chains Ids available for bridging in both directions
     *        chainConfigs: {ChainConfig} settings for provided {allowedChainIds}
     *        salt: value used for precalculation of {UTSTokenPure} contract address
     *
     * @dev {pureToken}, {mintable}, {globalBurnable}, {onlyRoleBurnable}, {feeModule}, and {salt} parameters DO NOT 
     * impact on the executable code here and {UTSTokenPure} settings in this function. 
     * It defines the creation bytecode before deployment and initialization.
     *
     * The difference in the amount between the {initialSupply} and the {mintedAmountToOwner} is minted to the 
     * balance of the {UTSTokenPure} contract itself, to provide liquidity for receiving bridges from other chains.
     *
     * Can and MUST be called only once. Reinitialization is prevented by {UTSBase.__UTSBase_init} function.
     */
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

    /**
     * @notice Returns decimals value of the {UTSTokenPure}.
     * @return {_decimals} of the {UTSTokenPure}.
     */
    function decimals() public view override returns(uint8) {
        return _decimals;
    }

    /**
     * @notice Returns true if this contract implements the interface defined by `interfaceId`.
     * See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified
     * to learn more about how these ids are created.
     */
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