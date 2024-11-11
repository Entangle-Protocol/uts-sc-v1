// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSToken.sol";
import "../connector/UTSConnector.sol";

import "../interfaces/IUTSCodeStorage.sol";

contract UTSCodeStorage is IUTSCodeStorage {

    function getCode(bool isConnector) external pure returns(bytes memory) {
        return isConnector ? type(UTSConnector).creationCode : type(UTSToken).creationCode;
    }
    
}