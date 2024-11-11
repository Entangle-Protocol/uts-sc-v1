// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../connector/UTSConnectorWithFee.sol";

import "../interfaces/IUTSCodeStorage.sol";

contract UTSCodeStorageConnectorWithFee is IUTSCodeStorage {

    function getCode(bool /* isConnector */) external pure returns(bytes memory) {
        return type(UTSConnectorWithFee).creationCode;
    }
    
}