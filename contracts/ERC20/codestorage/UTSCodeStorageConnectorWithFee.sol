// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../connector/UTSConnectorWithFee.sol";

import "../interfaces/IUTSCodeStorage.sol";

/**
 * @notice A contract stores creation bytecode for UTSConnectorWithFee contract.
 *
 * The bytecode is used by the {UTSFactory} for deployment.
 */
contract UTSCodeStorageConnectorWithFee is IUTSCodeStorage {

    /**
     * @notice Returns the UTSConnectorWithFee creation bytecode.
     * @return bytecode creation bytecode of the {UTSConnectorWithFee} contract.
     */
    function getCode(bool /* isConnector */) external pure returns(bytes memory bytecode) {
        return type(UTSConnectorWithFee).creationCode;
    }
    
}