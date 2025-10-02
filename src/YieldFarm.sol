// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract YieldFarm is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    struct PoolInfo {
        IERC20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accTokenPerShare;
        uint256 totalStaked;
        uint256 minStakeAmount;
        uint256 maxStakeAmount;
    }

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        uint256 lastStakeTime;
    }

    IERC20 public rewardToken;
    uint256 public rewardPerBlock;
    uint256 public startBlock;
    uint256 public bonusEndBlock;
    uint256 public constant BONUS_MULTIPLIER = 2;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public totalAllocPoint = 0;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event RewardPaid(address indexed user, uint256 indexed pid, uint256 amount);

    constructor(
        IERC20 _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock
    ) {
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        startBlock = _startBlock;
        bonusEndBlock = _bonusEndBlock;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    function addPool(
        uint256 _allocPoint,
        IERC20 _lpToken,
        uint256 _minStakeAmount,
        uint256 _maxStakeAmount,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accTokenPerShare: 0,
                totalStaked: 0,
                minStakeAmount: _minStakeAmount,
                maxStakeAmount: _maxStakeAmount
            })
        );
    }

    function setPool(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) external onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        if (_to <= bonusEndBlock) {
            return (_to - _from) * BONUS_MULTIPLIER;
        } else if (_from >= bonusEndBlock) {
            return _to - _from;
        } else {
            return (bonusEndBlock - _from) * BONUS_MULTIPLIER + (_to - bonusEndBlock);
        }
    }

    function pendingReward(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accTokenPerShare = pool.accTokenPerShare;
        uint256 lpSupply = pool.totalStaked;

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 tokenReward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
            accTokenPerShare = accTokenPerShare + (tokenReward * 1e12) / lpSupply;
        }

        return (user.amount * accTokenPerShare) / 1e12 - user.rewardDebt + user.pendingRewards;
    }

    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.totalStaked;
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 tokenReward = (multiplier * rewardPerBlock * pool.allocPoint) / totalAllocPoint;
        pool.accTokenPerShare = pool.accTokenPerShare + (tokenReward * 1e12) / lpSupply;
        pool.lastRewardBlock = block.number;
    }

    function deposit(uint256 _pid, uint256 _amount) external nonReentrant whenNotPaused {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        require(_amount >= pool.minStakeAmount, "Amount below minimum");
        require(user.amount + _amount <= pool.maxStakeAmount, "Amount exceeds maximum");

        updatePool(_pid);

        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accTokenPerShare) / 1e12 - user.rewardDebt;
            user.pendingRewards = user.pendingRewards + pending;
        }

        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        user.amount = user.amount + _amount;
        user.lastStakeTime = block.timestamp;
        pool.totalStaked = pool.totalStaked + _amount;
        user.rewardDebt = (user.amount * pool.accTokenPerShare) / 1e12;

        emit Deposit(msg.sender, _pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "Insufficient balance");

        updatePool(_pid);

        uint256 pending = (user.amount * pool.accTokenPerShare) / 1e12 - user.rewardDebt + user.pendingRewards;

        user.amount = user.amount - _amount;
        pool.totalStaked = pool.totalStaked - _amount;
        user.rewardDebt = (user.amount * pool.accTokenPerShare) / 1e12;

        if (pending > 0) {
            user.pendingRewards = 0;
            safeRewardTransfer(msg.sender, pending);
            emit RewardPaid(msg.sender, _pid, pending);
        }

        pool.lpToken.safeTransfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    function harvest(uint256 _pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        updatePool(_pid);

        uint256 pending = (user.amount * pool.accTokenPerShare) / 1e12 - user.rewardDebt + user.pendingRewards;

        if (pending > 0) {
            user.pendingRewards = 0;
            user.rewardDebt = (user.amount * pool.accTokenPerShare) / 1e12;
            safeRewardTransfer(msg.sender, pending);
            emit RewardPaid(msg.sender, _pid, pending);
        }
    }

    function emergencyWithdraw(uint256 _pid) external nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;

        user.amount = 0;
        user.rewardDebt = 0;
        user.pendingRewards = 0;
        pool.totalStaked = pool.totalStaked - amount;

        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    function safeRewardTransfer(address _to, uint256 _amount) internal {
        uint256 rewardBal = rewardToken.balanceOf(address(this));
        if (_amount > rewardBal) {
            rewardToken.safeTransfer(_to, rewardBal);
        } else {
            rewardToken.safeTransfer(_to, _amount);
        }
    }

    function updateRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        massUpdatePools();
        rewardPerBlock = _rewardPerBlock;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getUserInfo(uint256 _pid, address _user) external view returns (
        uint256 amount,
        uint256 rewardDebt,
        uint256 pendingRewards,
        uint256 lastStakeTime
    ) {
        UserInfo storage user = userInfo[_pid][_user];
        return (user.amount, user.rewardDebt, user.pendingRewards, user.lastStakeTime);
    }

    function getPoolInfo(uint256 _pid) external view returns (
        address lpToken,
        uint256 allocPoint,
        uint256 lastRewardBlock,
        uint256 accTokenPerShare,
        uint256 totalStaked,
        uint256 minStakeAmount,
        uint256 maxStakeAmount
    ) {
        PoolInfo storage pool = poolInfo[_pid];
        return (
            address(pool.lpToken),
            pool.allocPoint,
            pool.lastRewardBlock,
            pool.accTokenPerShare,
            pool.totalStaked,
            pool.minStakeAmount,
            pool.maxStakeAmount
        );
    }
}