// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/YieldFarm.sol";
import "../src/YieldToken.sol";
import "../src/MockLPToken.sol";

contract YieldFarmTest is Test {
    YieldFarm public yieldFarm;
    YieldToken public rewardToken;
    MockLPToken public lpToken;

    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    uint256 public constant REWARD_PER_BLOCK = 1e18;
    uint256 public constant START_BLOCK = 100;
    uint256 public constant BONUS_END_BLOCK = 200;

    function setUp() public {
        vm.startPrank(owner);

        rewardToken = new YieldToken();
        lpToken = new MockLPToken("LP Token", "LP");

        yieldFarm = new YieldFarm(
            rewardToken,
            REWARD_PER_BLOCK,
            START_BLOCK,
            BONUS_END_BLOCK
        );

        rewardToken.transfer(address(yieldFarm), 1000000e18);

        yieldFarm.addPool(100, lpToken, 1e18, 1000e18, true);

        vm.stopPrank();

        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);

        lpToken.mint(user1, 1000e18);
        lpToken.mint(user2, 1000e18);
    }

    function testPoolCreation() public {
        assertEq(yieldFarm.poolLength(), 1);

        (
            address poolLpToken,
            uint256 allocPoint,
            uint256 lastRewardBlock,
            uint256 accTokenPerShare,
            uint256 totalStaked,
            uint256 minStakeAmount,
            uint256 maxStakeAmount
        ) = yieldFarm.getPoolInfo(0);

        assertEq(poolLpToken, address(lpToken));
        assertEq(allocPoint, 100);
        assertEq(totalStaked, 0);
        assertEq(minStakeAmount, 1e18);
        assertEq(maxStakeAmount, 1000e18);
    }

    function testDeposit() public {
        vm.startPrank(user1);

        lpToken.approve(address(yieldFarm), 100e18);

        vm.roll(START_BLOCK + 1);
        yieldFarm.deposit(0, 100e18);

        (uint256 amount, , , ) = yieldFarm.getUserInfo(0, user1);
        assertEq(amount, 100e18);

        (, , , , uint256 totalStaked, , ) = yieldFarm.getPoolInfo(0);
        assertEq(totalStaked, 100e18);

        vm.stopPrank();
    }

    function testWithdraw() public {
        vm.startPrank(user1);

        lpToken.approve(address(yieldFarm), 100e18);

        vm.roll(START_BLOCK + 1);
        yieldFarm.deposit(0, 100e18);

        vm.roll(START_BLOCK + 10);
        yieldFarm.withdraw(0, 50e18);

        (uint256 amount, , , ) = yieldFarm.getUserInfo(0, user1);
        assertEq(amount, 50e18);

        vm.stopPrank();
    }

    function testHarvest() public {
        vm.startPrank(user1);

        lpToken.approve(address(yieldFarm), 100e18);

        vm.roll(START_BLOCK + 1);
        yieldFarm.deposit(0, 100e18);

        vm.roll(START_BLOCK + 10);

        uint256 pendingBefore = yieldFarm.pendingReward(0, user1);
        assertGt(pendingBefore, 0);

        uint256 balanceBefore = rewardToken.balanceOf(user1);
        yieldFarm.harvest(0);
        uint256 balanceAfter = rewardToken.balanceOf(user1);

        assertGt(balanceAfter, balanceBefore);

        vm.stopPrank();
    }

    function testMultipleUsers() public {
        vm.startPrank(user1);
        lpToken.approve(address(yieldFarm), 100e18);
        vm.roll(START_BLOCK + 1);
        yieldFarm.deposit(0, 100e18);
        vm.stopPrank();

        vm.startPrank(user2);
        lpToken.approve(address(yieldFarm), 200e18);
        vm.roll(START_BLOCK + 5);
        yieldFarm.deposit(0, 200e18);
        vm.stopPrank();

        vm.roll(START_BLOCK + 15);

        uint256 pending1 = yieldFarm.pendingReward(0, user1);
        uint256 pending2 = yieldFarm.pendingReward(0, user2);

        assertGt(pending1, 0);
        assertGt(pending2, 0);
        assertGt(pending1, pending2);
    }

    function testEmergencyWithdraw() public {
        vm.startPrank(user1);

        lpToken.approve(address(yieldFarm), 100e18);

        vm.roll(START_BLOCK + 1);
        yieldFarm.deposit(0, 100e18);

        uint256 balanceBefore = lpToken.balanceOf(user1);
        yieldFarm.emergencyWithdraw(0);
        uint256 balanceAfter = lpToken.balanceOf(user1);

        assertEq(balanceAfter - balanceBefore, 100e18);

        (uint256 amount, , , ) = yieldFarm.getUserInfo(0, user1);
        assertEq(amount, 0);

        vm.stopPrank();
    }

    function testMinMaxStakeConstraints() public {
        vm.startPrank(user1);

        lpToken.approve(address(yieldFarm), 2000e18);

        vm.expectRevert("Amount below minimum");
        yieldFarm.deposit(0, 0.5e18);

        vm.expectRevert("Amount exceeds maximum");
        yieldFarm.deposit(0, 1500e18);

        vm.stopPrank();
    }

    function testPauseUnpause() public {
        vm.startPrank(owner);
        yieldFarm.pause();
        vm.stopPrank();

        vm.startPrank(user1);
        lpToken.approve(address(yieldFarm), 100e18);

        vm.expectRevert("Pausable: paused");
        yieldFarm.deposit(0, 100e18);

        vm.stopPrank();

        vm.startPrank(owner);
        yieldFarm.unpause();
        vm.stopPrank();

        vm.startPrank(user1);
        vm.roll(START_BLOCK + 1);
        yieldFarm.deposit(0, 100e18);
        vm.stopPrank();
    }

    function testOnlyOwnerFunctions() public {
        vm.startPrank(user1);

        vm.expectRevert("Ownable: caller is not the owner");
        yieldFarm.addPool(50, lpToken, 1e18, 1000e18, false);

        vm.expectRevert("Ownable: caller is not the owner");
        yieldFarm.setPool(0, 150, false);

        vm.expectRevert("Ownable: caller is not the owner");
        yieldFarm.updateRewardPerBlock(2e18);

        vm.expectRevert("Ownable: caller is not the owner");
        yieldFarm.pause();

        vm.stopPrank();
    }
}