# YieldFarm Protocol - API Documentation

## Overview

The YieldFarm Protocol API provides comprehensive access to all protocol functionality through Web3 interfaces, REST endpoints, and GraphQL queries. This documentation covers integration patterns, code examples, and best practices.

## Table of Contents

- [Web3 Integration](#web3-integration)
- [REST API](#rest-api)
- [GraphQL API](#graphql-api)
- [WebSocket Events](#websocket-events)
- [SDK Libraries](#sdk-libraries)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)

## Web3 Integration

### Getting Started

```javascript
import { ethers } from 'ethers';

// Connect to provider
const provider = new ethers.JsonRpcProvider('https://mainnet.infura.io/v3/YOUR_KEY');
const signer = provider.getSigner();

// Contract addresses
const YIELD_FARM_ADDRESS = '0x...';
const YIELD_TOKEN_ADDRESS = '0x...';

// Contract ABIs
const yieldFarmABI = [...]; // See contract documentation
const erc20ABI = [...];

// Initialize contracts
const yieldFarm = new ethers.Contract(YIELD_FARM_ADDRESS, yieldFarmABI, signer);
const yieldToken = new ethers.Contract(YIELD_TOKEN_ADDRESS, erc20ABI, signer);
```

### Core Operations

#### Staking Operations

```javascript
// Get pool information
async function getPoolInfo(poolId) {
  const poolInfo = await yieldFarm.getPoolInfo(poolId);
  return {
    lpToken: poolInfo.lpToken,
    allocPoint: poolInfo.allocPoint.toString(),
    totalStaked: ethers.formatEther(poolInfo.totalStaked),
    minStake: ethers.formatEther(poolInfo.minStakeAmount),
    maxStake: ethers.formatEther(poolInfo.maxStakeAmount)
  };
}

// Stake LP tokens
async function stakeTokens(poolId, amount) {
  try {
    const amountWei = ethers.parseEther(amount.toString());

    // Approve tokens first
    const lpToken = new ethers.Contract(poolInfo.lpToken, erc20ABI, signer);
    const approveTx = await lpToken.approve(YIELD_FARM_ADDRESS, amountWei);
    await approveTx.wait();

    // Stake tokens
    const stakeTx = await yieldFarm.deposit(poolId, amountWei);
    const receipt = await stakeTx.wait();

    return {
      success: true,
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error) {
    throw new Error(`Staking failed: ${error.message}`);
  }
}

// Withdraw tokens
async function withdrawTokens(poolId, amount) {
  try {
    const amountWei = ethers.parseEther(amount.toString());
    const tx = await yieldFarm.withdraw(poolId, amountWei);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error) {
    throw new Error(`Withdrawal failed: ${error.message}`);
  }
}

// Harvest rewards
async function harvestRewards(poolId) {
  try {
    const tx = await yieldFarm.harvest(poolId);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString()
    };
  } catch (error) {
    throw new Error(`Harvest failed: ${error.message}`);
  }
}
```

#### Query Operations

```javascript
// Get user information
async function getUserInfo(poolId, userAddress) {
  const userInfo = await yieldFarm.getUserInfo(poolId, userAddress);
  const pendingReward = await yieldFarm.pendingReward(poolId, userAddress);

  return {
    stakedAmount: ethers.formatEther(userInfo.amount),
    rewardDebt: ethers.formatEther(userInfo.rewardDebt),
    pendingRewards: ethers.formatEther(userInfo.pendingRewards),
    pendingReward: ethers.formatEther(pendingReward),
    lastStakeTime: new Date(userInfo.lastStakeTime.toNumber() * 1000)
  };
}

// Get all pools
async function getAllPools() {
  const poolLength = await yieldFarm.poolLength();
  const pools = [];

  for (let i = 0; i < poolLength; i++) {
    const poolInfo = await getPoolInfo(i);
    pools.push({ id: i, ...poolInfo });
  }

  return pools;
}

// Calculate APY
async function calculateAPY(poolId) {
  const poolInfo = await yieldFarm.getPoolInfo(poolId);
  const rewardPerBlock = await yieldFarm.rewardPerBlock();
  const totalAllocPoint = await yieldFarm.totalAllocPoint();

  const blocksPerYear = 365 * 24 * 60 * 60 / 12; // Assuming 12s block time
  const poolRewardPerYear = rewardPerBlock * blocksPerYear * poolInfo.allocPoint / totalAllocPoint;
  const totalStaked = poolInfo.totalStaked;

  if (totalStaked === 0n) return 0;

  const apy = (poolRewardPerYear * 100) / totalStaked;
  return parseFloat(ethers.formatEther(apy.toString()));
}
```

## REST API

### Base URL
```
https://api.yieldfarm.protocol/v1
```

### Authentication
```javascript
// API Key in header
headers: {
  'Authorization': 'Bearer YOUR_API_KEY',
  'Content-Type': 'application/json'
}
```

### Endpoints

#### Protocol Information

**GET** `/protocol/info`
```json
{
  "name": "YieldFarm Protocol",
  "version": "1.0.0",
  "chainId": 1,
  "contracts": {
    "yieldFarm": "0x...",
    "yieldToken": "0x...",
    "deployer": "0x..."
  },
  "metrics": {
    "totalValueLocked": "2400000.00",
    "totalRewardsDistributed": "150000.00",
    "activeUsers": 1247,
    "totalPools": 3
  }
}
```

**GET** `/protocol/stats`
```json
{
  "tvl": {
    "total": "2400000.00",
    "24hChange": "12.5"
  },
  "volume": {
    "24h": "890000.00",
    "7d": "5200000.00"
  },
  "users": {
    "active": 1247,
    "total": 5890,
    "newToday": 23
  }
}
```

#### Pool Information

**GET** `/pools`
```json
{
  "pools": [
    {
      "id": 0,
      "name": "ETH-USDC LP",
      "lpToken": "0x...",
      "allocPoint": 100,
      "totalStaked": "890000.00",
      "apy": "24.5",
      "participants": 456,
      "minStake": "1.0",
      "maxStake": "1000.0"
    }
  ]
}
```

**GET** `/pools/{poolId}`
```json
{
  "id": 0,
  "name": "ETH-USDC LP",
  "lpToken": "0x...",
  "allocPoint": 100,
  "totalStaked": "890000.00",
  "apy": "24.5",
  "participants": 456,
  "minStake": "1.0",
  "maxStake": "1000.0",
  "rewardHistory": [
    {
      "date": "2024-01-01",
      "totalRewards": "1250.00",
      "avgApy": "23.8"
    }
  ]
}
```

#### User Information

**GET** `/users/{address}`
```json
{
  "address": "0x...",
  "totalStaked": "5000.00",
  "totalRewards": "234.56",
  "activePools": [
    {
      "poolId": 0,
      "stakedAmount": "2500.00",
      "pendingRewards": "45.67",
      "lastAction": "2024-01-01T12:00:00Z"
    }
  ],
  "history": [
    {
      "type": "deposit",
      "poolId": 0,
      "amount": "1000.00",
      "timestamp": "2024-01-01T10:30:00Z",
      "txHash": "0x..."
    }
  ]
}
```

**GET** `/users/{address}/rewards`
```json
{
  "totalEarned": "234.56",
  "claimable": "45.67",
  "breakdown": [
    {
      "poolId": 0,
      "earned": "123.45",
      "pending": "23.45"
    }
  ]
}
```

#### Transactions

**GET** `/transactions?limit=50&offset=0`
```json
{
  "transactions": [
    {
      "hash": "0x...",
      "type": "deposit",
      "user": "0x...",
      "poolId": 0,
      "amount": "1000.00",
      "timestamp": "2024-01-01T12:00:00Z",
      "gasUsed": "120000",
      "status": "confirmed"
    }
  ],
  "pagination": {
    "total": 15000,
    "page": 1,
    "hasNext": true
  }
}
```

## GraphQL API

### Endpoint
```
https://api.yieldfarm.protocol/graphql
```

### Schema

```graphql
type Protocol {
  id: ID!
  name: String!
  version: String!
  totalValueLocked: BigDecimal!
  totalRewardsDistributed: BigDecimal!
  totalUsers: Int!
  pools: [Pool!]!
}

type Pool {
  id: ID!
  lpToken: String!
  allocPoint: BigInt!
  totalStaked: BigDecimal!
  apy: BigDecimal!
  participants: Int!
  minStakeAmount: BigDecimal!
  maxStakeAmount: BigDecimal!
  deposits: [Deposit!]!
  withdrawals: [Withdrawal!]!
}

type User {
  id: ID!
  address: String!
  totalStaked: BigDecimal!
  totalRewardsEarned: BigDecimal!
  stakes: [UserStake!]!
  transactions: [Transaction!]!
}

type UserStake {
  id: ID!
  user: User!
  pool: Pool!
  amount: BigDecimal!
  rewardDebt: BigDecimal!
  pendingRewards: BigDecimal!
  lastStakeTime: BigInt!
}

type Transaction {
  id: ID!
  hash: String!
  type: TransactionType!
  user: User!
  pool: Pool!
  amount: BigDecimal!
  timestamp: BigInt!
  gasUsed: BigInt!
}

enum TransactionType {
  DEPOSIT
  WITHDRAW
  HARVEST
  EMERGENCY_WITHDRAW
}
```

### Example Queries

```graphql
# Get protocol overview
query ProtocolOverview {
  protocol(id: "1") {
    name
    totalValueLocked
    totalUsers
    pools {
      id
      totalStaked
      apy
      participants
    }
  }
}

# Get user information
query UserInfo($address: String!) {
  user(id: $address) {
    address
    totalStaked
    totalRewardsEarned
    stakes {
      pool {
        id
      }
      amount
      pendingRewards
    }
    transactions(first: 10, orderBy: timestamp, orderDirection: desc) {
      hash
      type
      amount
      timestamp
    }
  }
}

# Get pool statistics
query PoolStats($poolId: String!) {
  pool(id: $poolId) {
    id
    totalStaked
    apy
    participants
    deposits(first: 100, orderBy: timestamp, orderDirection: desc) {
      user {
        address
      }
      amount
      timestamp
    }
  }
}
```

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.yieldfarm.protocol/ws');

ws.onopen = () => {
  // Subscribe to events
  ws.send(JSON.stringify({
    action: 'subscribe',
    events: ['deposits', 'withdrawals', 'harvests'],
    filters: {
      pools: [0, 1, 2],
      users: ['0x...']
    }
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received event:', data);
};
```

### Event Types

```javascript
// Deposit event
{
  "type": "deposit",
  "data": {
    "user": "0x...",
    "poolId": 0,
    "amount": "1000.00",
    "txHash": "0x...",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}

// Withdrawal event
{
  "type": "withdrawal",
  "data": {
    "user": "0x...",
    "poolId": 0,
    "amount": "500.00",
    "rewards": "45.67",
    "txHash": "0x...",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}

// Pool update event
{
  "type": "poolUpdate",
  "data": {
    "poolId": 0,
    "apy": "25.2",
    "totalStaked": "895000.00",
    "participants": 457
  }
}
```

## SDK Libraries

### JavaScript/TypeScript
```bash
npm install @yieldfarm/sdk
```

```javascript
import { YieldFarmSDK } from '@yieldfarm/sdk';

const sdk = new YieldFarmSDK({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR_KEY',
  apiKey: 'YOUR_API_KEY'
});

// High-level operations
await sdk.stake(poolId, amount);
await sdk.unstake(poolId, amount);
await sdk.harvest(poolId);

// Query operations
const pools = await sdk.getPools();
const userInfo = await sdk.getUserInfo(address);
```

### Python
```bash
pip install yieldfarm-python
```

```python
from yieldfarm import YieldFarmClient

client = YieldFarmClient(
    rpc_url='https://mainnet.infura.io/v3/YOUR_KEY',
    api_key='YOUR_API_KEY'
)

# Async operations
await client.stake(pool_id=0, amount=1000)
user_info = await client.get_user_info(address)
```

## Error Handling

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

### Error Response Format
```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "User does not have sufficient staked tokens",
    "details": {
      "required": "1000.00",
      "available": "500.00"
    }
  }
}
```

### Common Error Codes
- `INVALID_POOL_ID` - Pool does not exist
- `INSUFFICIENT_BALANCE` - Not enough tokens
- `AMOUNT_TOO_LOW` - Below minimum stake
- `AMOUNT_TOO_HIGH` - Above maximum stake
- `CONTRACT_PAUSED` - Protocol is paused
- `ALLOWANCE_INSUFFICIENT` - Token approval needed

## Rate Limiting

### Limits
- **Public endpoints**: 100 requests per minute
- **Authenticated endpoints**: 1000 requests per minute
- **WebSocket connections**: 10 concurrent per API key

### Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1609459200
```

## Best Practices

### Performance
- Use batch queries when possible
- Cache frequently accessed data
- Implement proper error retry logic
- Use WebSocket for real-time updates

### Security
- Never expose private keys in client code
- Use environment variables for API keys
- Implement proper authentication
- Validate all user inputs

### Integration
- Test on testnets first
- Implement graceful error handling
- Use appropriate gas limits
- Monitor transaction status

---

For more information, see our [GitHub repository](https://github.com/Martins-O/defi-yield-farming-protocol) or join our [Discord](https://discord.gg/yieldfarm).