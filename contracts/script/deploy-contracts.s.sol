// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {ECDSAValidator} from "kernel/validator/ECDSAValidator.sol";
import {WebAuthnValidator} from "../src/validators/webauthn/WebAuthnValidator.sol";
import {CharityPaymaster} from "../src/CharityPaymaster.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {Counter} from "../src/Counter.sol";

/*
(in root directory instead of /contracts)

forge script --rpc-url http://localhost:8545 --root contracts contracts/script/deploy-contracts.s.sol --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
forge script --rpc-url $sepolia --root contracts contracts/script/deploy-contracts.s.sol --account dev --broadcast --verify

*/

contract DeployContracts is Script {
    function setUp() public {}

    function run() public {
        bytes32 salt = vm.envBytes32("SALT");
        console.logBytes32(salt);

        vm.startBroadcast();

        ECDSAValidator validator = new ECDSAValidator{salt: salt}();
        console.log("ECDSAValidator deployed at", address(validator));

        WebAuthnValidator webauthn = new WebAuthnValidator{salt: salt}();
        console.log("WebAuthnValidator deployed at", address(webauthn));

        Counter counter = new Counter{salt: salt}();
        console.log("Counter deployed at", address(counter));

        CharityPaymaster paymaster = new CharityPaymaster{salt: salt}();
        console.log("CharityPaymaster deployed at", address(paymaster));

        IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032).depositTo{value: 1 ether}(address(paymaster));
        console.log("Deposited 1 ETH to EntryPoint for paymaster");

        vm.stopBroadcast();
    }
}
