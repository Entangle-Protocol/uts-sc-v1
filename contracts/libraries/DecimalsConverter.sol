// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

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