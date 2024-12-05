// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenMintableWithFee.sol";

import "../interfaces/IUTSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for UTSTokenMintableWithFee contract.
 *
 * The bytecode is used by the {UTSFactory} for deployment.
 */
contract UTSCodeStorageMintableWithFee is IUTSCodeStorage {

    /**
     * @notice Returns the UTSTokenMintableWithFee creation bytecode.
     * @return bytecode creation bytecode of the {UTSTokenMintableWithFee} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(UTSTokenMintableWithFee).creationCode;
    }
    
}