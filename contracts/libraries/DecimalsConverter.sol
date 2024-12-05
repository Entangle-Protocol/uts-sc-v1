// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @notice The library contains utility function for converting amounts with different decimals values for the UTS protocol V1.
 */
library DecimalsConverter {

    function convert(uint256 amount, uint256 decimalsIn, uint256 decimalsOut) internal pure returns(uint256) {
        if (decimalsOut > decimalsIn) {
            return amount * (10 ** (decimalsOut - decimalsIn));
        } else {
            if (decimalsOut < decimalsIn) {
                return amount / (10 ** (decimalsIn - decimalsOut));
            }
        }

        return amount;
    }

}