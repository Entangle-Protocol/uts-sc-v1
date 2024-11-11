// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
 
import "../token/UTSTokenMintable.sol";

import "../interfaces/IUTSCodeStorage.sol";

contract UTSCodeStorageMintable is IUTSCodeStorage {

    function getCode(bool /* isConnector */) external pure returns(bytes memory) {
        return type(UTSTokenMintable).creationCode;
    }
    
}