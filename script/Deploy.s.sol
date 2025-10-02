// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/YieldFarm.sol";
import "../src/YieldToken.sol";
import "../src/MockLPToken.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        YieldToken rewardToken = new YieldToken();
        console.log("YieldToken deployed at:", address(rewardToken));

        MockLPToken lpToken = new MockLPToken("Mock LP Token", "mLP");
        console.log("MockLPToken deployed at:", address(lpToken));

        uint256 rewardPerBlock = 1e18;
        uint256 startBlock = block.number + 10;
        uint256 bonusEndBlock = startBlock + 28800;

        YieldFarm yieldFarm = new YieldFarm(
            rewardToken,
            rewardPerBlock,
            startBlock,
            bonusEndBlock
        );
        console.log("YieldFarm deployed at:", address(yieldFarm));

        rewardToken.transfer(address(yieldFarm), rewardToken.balanceOf(msg.sender) / 2);
        console.log("Transferred tokens to farm contract");

        yieldFarm.addPool(100, lpToken, 1e18, 1000e18, true);
        console.log("Added LP token pool");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("YieldToken:", address(rewardToken));
        console.log("MockLPToken:", address(lpToken));
        console.log("YieldFarm:", address(yieldFarm));
        console.log("Reward per block:", rewardPerBlock);
        console.log("Start block:", startBlock);
        console.log("Bonus end block:", bonusEndBlock);
    }
}