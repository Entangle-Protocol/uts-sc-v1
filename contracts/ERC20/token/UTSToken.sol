// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

import "./ERC20Burnable.sol";
import "../extensions/UTSBaseIndexed.sol";

import "../interfaces/IUTSToken.sol";

/**
 * @notice An ERC20 compliant token contract with integrated functionality to use UTS protocol V1 crosschain messaging
 * for bridging this token itself.  
 *
 * @dev A mint/burn mechanism is used to send and receive ERC20 tokens crosschain bridges.
 */
contract UTSToken is IUTSToken, UTSBaseIndexed, ERC20Burnable, AccessControl {
    using AddressConverter for bytes;

    /// @notice {AccessControl} role identifier for burner addresses.
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /// @notice Flag indicating whether the {UTSToken} is globally burnable by anyone.
    bool public globalBurnable;

    /// @notice Flag indicating whether only addresses with the {BURNER_ROLE} can burn tokens.
    bool public onlyRoleBurnable;

    /// @notice Indicates an error that the function caller does not have the {AccessControl} role.
    error UTSToken__E0();
    
    /// @notice Indicates an error that the burning tokens is not enabled.
    error UTSToken__E1();

    /**
     * @notice Initializes basic settings with provided parameters.
     *
     * @param params {DeployTokenData} struct containing {UTSToken} initialization parameters:
     *        owner: the address of the initial {AccessControl.DEFAULT_ADMIN_ROLE}
     *        name: the {ERC20.name} of the {UTSToken} token
     *        symbol: the {ERC20.symbol} of the {UTSToken} token
     *        decimals: the {ERC20.decimals} of the {UTSToken} token
     *        initialSupply: total initial {UTSToken} supply to mint
     *        mintedAmountToOwner: initial {UTSToken} supply to mint to {owner} balance
     *        pureToken: flag indicating whether the {UTSToken} is use lock/unlock or mint/burn mechanism for bridging
     *        mintable: flag indicating whether {owner} can mint an unlimited amount of {UTSToken} tokens
     *        globalBurnable: flag indicating whether the {UTSToken} is globally burnable by anyone
     *        onlyRoleBurnable: flag indicating whether only addresses with the {AccessControl.BURNER_ROLE} can burn tokens
     *        feeModule: flag indicating whether the {UTSToken} is supports the fee deducting for bridging
     *        router: the address of the authorized {UTSRouter}
     *        allowedChainIds: chains Ids available for bridging in both directions
     *        chainConfigs: {ChainConfig} settings for provided {allowedChainIds}
     *        salt: value used for precalculation of {UTSToken} contract address
     *
     * @dev {mintedAmountToOwner}, {pureToken}, {mintable}, {feeModule}, and {salt} parameters DO NOT impact on
     * the executable code here and {UTSToken} settings in this function. 
     * It defines the creation bytecode before deployment and initialization.
     *
     * Can and MUST be called only once. Reinitialization is prevented by {UTSBase.__UTSBase_init} function.
     */
    function initializeToken(DeployTokenData calldata params) external { 
        __ERC20_init(params.name, params.symbol);
        __UTSBase_init(address(this), params.decimals);

        _setRouter(params.router.toAddress());
        _setChainConfig(params.allowedChainIds, params.chainConfigs);

        if (params.initialSupply > 0) super._update(address(0), params.owner.toAddress(), params.initialSupply);

        globalBurnable = params.onlyRoleBurnable ? true : params.globalBurnable;
        onlyRoleBurnable = params.onlyRoleBurnable;

        _grantRole(DEFAULT_ADMIN_ROLE, params.owner.toAddress());
    }

    /**
     * @notice Returns decimals value of the {UTSToken}.
     * @return {_decimals} of the {UTSToken}.
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
        return interfaceId == type(IUTSToken).interfaceId || interfaceId == type(IERC20).interfaceId || super.supportsInterface(interfaceId);
    }

    function _burnFrom(
        address spender,
        address from,
        bytes memory /* to */, 
        uint256 amount, 
        uint256 /* dstChainId */, 
        bytes memory /* customPayload */
    ) internal virtual override returns(uint256) {
        if (from != spender) _spendAllowance(from, spender, amount);

        super._update(from, address(0), amount);

        return amount;
    }

    function _mintTo(
        address to,
        uint256 amount,
        bytes memory /* customPayload */,
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