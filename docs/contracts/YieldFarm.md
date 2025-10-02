# YieldFarm Contract Documentation

## Contract Overview

The `YieldFarm` contract is the core component of the YieldFarm Protocol, managing multiple farming pools, reward distribution, and user stakes.

## Contract Address
- **Mainnet**: `0x...` (To be deployed)
- **Testnet**: `0x...` (To be deployed)

## Inheritance
```solidity
contract YieldFarm is Ownable, ReentrancyGuard, Pausable
```

## State Variables

### Core Configuration
```solidity
IERC20 public rewardToken;           // YFT reward token
uint256 public rewardPerBlock;       // Tokens distributed per block
uint256 public startBlock;           // Farming start block
uint256 public bonusEndBlock;        // Bonus period end block
uint256 public constant BONUS_MULTIPLIER = 2; // 2x rewards during bonus
```

### Pool Management
```solidity
PoolInfo[] public poolInfo;          // Array of all pools
uint256 public totalAllocPoint = 0;  // Total allocation points
mapping(uint256 => mapping(address => UserInfo)) public userInfo; // User stakes
```

## Data Structures

### PoolInfo
```solidity
struct PoolInfo {
    IERC20 lpToken;          // LP token contract address
    uint256 allocPoint;      // Allocation points (reward weight)
    uint256 lastRewardBlock; // Last block rewards were calculated
    uint256 accTokenPerShare;// Accumulated tokens per share (scaled by 1e12)
    uint256 totalStaked;     // Total LP tokens staked in pool
    uint256 minStakeAmount;  // Minimum stake amount per user
    uint256 maxStakeAmount;  // Maximum stake amount per user
}
```

### UserInfo
```solidity
struct UserInfo {
    uint256 amount;          // LP tokens staked by user
    uint256 rewardDebt;      // Reward debt for calculation
    uint256 pendingRewards;  // Accumulated pending rewards
    uint256 lastStakeTime;   // Last time user staked tokens
}
```

## Functions

### View Functions

#### `poolLength()`
Returns the number of pools.
```solidity
function poolLength() external view returns (uint256)
```

#### `pendingReward(uint256 _pid, address _user)`
Calculate pending rewards for a user in a specific pool.
```solidity
function pendingReward(uint256 _pid, address _user) external view returns (uint256)
```

#### `getUserInfo(uint256 _pid, address _user)`
Get user information for a specific pool.
```solidity
function getUserInfo(uint256 _pid, address _user) external view returns (
    uint256 amount,
    uint256 rewardDebt,
    uint256 pendingRewards,
    uint256 lastStakeTime
)
```

#### `getPoolInfo(uint256 _pid)`
Get pool information.
```solidity
function getPoolInfo(uint256 _pid) external view returns (
    address lpToken,
    uint256 allocPoint,
    uint256 lastRewardBlock,
    uint256 accTokenPerShare,
    uint256 totalStaked,
    uint256 minStakeAmount,
    uint256 maxStakeAmount
)
```

#### `getMultiplier(uint256 _from, uint256 _to)`
Calculate reward multiplier for a block range.
```solidity
function getMultiplier(uint256 _from, uint256 _to) public view returns (uint256)
```

### Administrative Functions

#### `addPool(...)`
Add a new farming pool (only owner).
```solidity
function addPool(
    uint256 _allocPoint,
    IERC20 _lpToken,
    uint256 _minStakeAmount,
    uint256 _maxStakeAmount,
    bool _withUpdate
) external onlyOwner
```

**Parameters:**
- `_allocPoint`: Allocation points for reward distribution
- `_lpToken`: LP token contract address
- `_minStakeAmount`: Minimum stake amount per user
- `_maxStakeAmount`: Maximum stake amount per user
- `_withUpdate`: Whether to update all pools before adding

#### `setPool(...)`
Update an existing pool's allocation points (only owner).
```solidity
function setPool(
    uint256 _pid,
    uint256 _allocPoint,
    bool _withUpdate
) external onlyOwner
```

#### `updateRewardPerBlock(uint256 _rewardPerBlock)`
Update the reward per block (only owner).
```solidity
function updateRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner
```

### User Functions

#### `deposit(uint256 _pid, uint256 _amount)`
Stake LP tokens in a farming pool.
```solidity
function deposit(uint256 _pid, uint256 _amount) external nonReentrant whenNotPaused
```

**Requirements:**
- Amount must be >= pool's minimum stake amount
- Total user stake must be <= pool's maximum stake amount
- User must have approved the LP tokens
- Contract must not be paused

**Process:**
1. Updates pool rewards
2. Calculates and stores pending rewards
3. Transfers LP tokens from user
4. Updates user and pool state
5. Emits `Deposit` event

#### `withdraw(uint256 _pid, uint256 _amount)`
Withdraw LP tokens and claim rewards.
```solidity
function withdraw(uint256 _pid, uint256 _amount) external nonReentrant
```

**Requirements:**
- User must have sufficient staked amount
- Amount must be > 0

**Process:**
1. Updates pool rewards
2. Calculates total pending rewards
3. Updates user and pool state
4. Transfers rewards to user
5. Transfers LP tokens back to user
6. Emits `Withdraw` and `RewardPaid` events

#### `harvest(uint256 _pid)`
Claim rewards without withdrawing LP tokens.
```solidity
function harvest(uint256 _pid) external nonReentrant
```

**Process:**
1. Updates pool rewards
2. Calculates pending rewards
3. Transfers rewards to user
4. Updates reward debt
5. Emits `RewardPaid` event

#### `emergencyWithdraw(uint256 _pid)`
Emergency withdrawal without rewards (for contract issues).
```solidity
function emergencyWithdraw(uint256 _pid) external nonReentrant
```

**Warning:** Forfeits all pending rewards!

### Pool Update Functions

#### `massUpdatePools()`
Update reward variables for all pools.
```solidity
function massUpdatePools() public
```

#### `updatePool(uint256 _pid)`
Update reward variables for a specific pool.
```solidity
function updatePool(uint256 _pid) public
```

**Process:**
1. Checks if update is needed
2. Calculates new rewards based on block difference
3. Updates accumulated tokens per share
4. Updates last reward block

### Emergency Functions

#### `pause()` / `unpause()`
Emergency pause/unpause functionality (only owner).
```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
```

## Events

```solidity
event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
event RewardPaid(address indexed user, uint256 indexed pid, uint256 amount);
```

## Mathematical Formulas

### Pending Reward Calculation
```
pending = (user.amount * pool.accTokenPerShare) / 1e12 - user.rewardDebt + user.pendingRewards
```

### Accumulated Tokens Per Share Update
```
pool.accTokenPerShare += (blockReward * 1e12) / pool.totalStaked
```

### Block Reward Calculation
```
blockReward = multiplier * rewardPerBlock * pool.allocPoint / totalAllocPoint
```

## Gas Optimizations

### Batch Operations
- `massUpdatePools()` for efficient bulk updates
- Cached calculations to minimize repeated computations
- Optimized storage access patterns

### State Management
- Minimal external calls
- Efficient data structures
- Gas-aware algorithm design

## Security Considerations

### Reentrancy Protection
All external functions use `nonReentrant` modifier.

### Input Validation
- Minimum/maximum stake amount checks
- Pool existence validation
- Sufficient balance verification

### Emergency Procedures
- Pausable functionality for emergencies
- Emergency withdrawal without rewards
- Owner-only administrative functions

## Integration Examples

### Basic Staking
```javascript
// Approve LP tokens
await lpToken.approve(yieldFarmAddress, amount);

// Stake tokens
await yieldFarm.deposit(poolId, amount);

// Check pending rewards
const pending = await yieldFarm.pendingReward(poolId, userAddress);

// Harvest rewards
await yieldFarm.harvest(poolId);

// Withdraw tokens
await yieldFarm.withdraw(poolId, amount);
```

### Pool Information
```javascript
// Get pool count
const poolCount = await yieldFarm.poolLength();

// Get pool info
const poolInfo = await yieldFarm.getPoolInfo(poolId);

// Get user info
const userInfo = await yieldFarm.getUserInfo(poolId, userAddress);
```

## Common Issues and Solutions

### Issue: Transaction Reverts with "Insufficient balance"
**Solution:** User doesn't have enough staked tokens for withdrawal amount.

### Issue: Transaction Reverts with "Amount below minimum"
**Solution:** Increase stake amount to meet pool's minimum requirement.

### Issue: High gas costs
**Solution:** Use `massUpdatePools()` before multiple operations, or wait for less congested network times.

### Issue: Rewards not updating
**Solution:** Call `updatePool()` or perform any stake operation to trigger reward calculation.

---

For more information, see the [API Documentation](../api/README.md) or join our [Discord](https://discord.gg/yieldfarm).