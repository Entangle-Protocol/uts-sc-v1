// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IPausable {

    function paused() external view returns(bool);

}