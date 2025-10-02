# DeFi Yield Farming Protocol

A comprehensive DeFi yield farming protocol built with Solidity and Foundry, featuring staking pools, reward distribution, and a React frontend interface.

## 🌟 Features

### Smart Contracts
- **YieldFarm**: Main farming contract with multiple pool support
- **YieldToken**: ERC-20 reward token with capped supply
- **MockLPToken**: Test LP token for development
- **Security Features**: ReentrancyGuard, Pausable, Ownable
- **Anti-whale Mechanisms**: Min/max stake limits per pool

### Key Functionality
- Multiple farming pools with different allocation points
- Dynamic reward calculation based on pool share
- Bonus multiplier for early farmers
- Emergency withdrawal functionality
- Harvest rewards without unstaking
- Pausable operations for emergency stops

### Frontend Interface
- React + TypeScript + Vite
- MetaMask integration
- Real-time stats display
- Stake/Unstake/Harvest operations
- Responsive design

## 🏗️ Architecture

```
DeFi Yield Farming Protocol
├── Smart Contracts
│   ├── YieldFarm.sol (Main farming logic)
│   ├── YieldToken.sol (Reward token)
│   └── MockLPToken.sol (Test LP token)
├── Frontend
│   ├── React TypeScript app
│   ├── Ethers.js integration
│   └── MetaMask connectivity
└── Testing & Deployment
    ├── Comprehensive test suite
    └── Deployment scripts
```

## 🚀 Quick Start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js](https://nodejs.org/) (v16+)
- [MetaMask](https://metamask.io/) browser extension

### Installation

1. **Clone and setup the project:**
```bash
cd defi-yield-farming
forge install
```

2. **Compile contracts:**
```bash
forge build
```

3. **Run tests:**
```bash
forge test
```

4. **Setup frontend:**
```bash
cd frontend
npm install
```

### Development

1. **Test contracts:**
```bash
forge test -vvv
```

2. **Deploy to local network:**
```bash
# Start local node
anvil

# Deploy contracts (in another terminal)
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast
```

3. **Start frontend:**
```bash
cd frontend
npm run dev
```

## 📖 Smart Contract Details

### YieldFarm Contract

**Key Functions:**
- `addPool()`: Add new farming pool
- `deposit()`: Stake LP tokens
- `withdraw()`: Unstake and claim rewards
- `harvest()`: Claim rewards without unstaking
- `emergencyWithdraw()`: Emergency unstake (forfeits rewards)

**Pool Configuration:**
- Allocation points (reward distribution weight)
- Min/max stake amounts
- LP token address

### Reward Calculation

Rewards are calculated using the following formula:
```
pending_reward = (user_amount * pool.accTokenPerShare) / 1e12 - user.rewardDebt
```

**Bonus Multiplier:**
- 2x rewards before bonus end block
- 1x rewards after bonus end block

### Security Features

1. **ReentrancyGuard**: Prevents reentrancy attacks
2. **Pausable**: Emergency stop functionality
3. **Ownable**: Access control for admin functions
4. **SafeERC20**: Safe token transfers
5. **Min/Max Limits**: Anti-whale mechanisms

## 🧪 Testing

The protocol includes comprehensive tests covering:

- Pool creation and management
- Deposit/withdrawal functionality
- Reward calculations
- Multi-user scenarios
- Emergency withdrawals
- Access controls
- Pause/unpause functionality

**Run all tests:**
```bash
forge test
```

**Run tests with detailed output:**
```bash
forge test -vvv
```

**Generate coverage report:**
```bash
forge coverage
```

## 🚀 Deployment

### Local Deployment

1. **Start local blockchain:**
```bash
anvil
```

2. **Deploy contracts:**
```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --private-key $PRIVATE_KEY --broadcast
```

### Testnet Deployment

1. **Set environment variables:**
```bash
export PRIVATE_KEY="your_private_key"
export RPC_URL="https://goerli.infura.io/v3/your_key"
```

2. **Deploy to Goerli:**
```bash
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
```

3. **Update frontend contract addresses in `frontend/src/App.tsx`**

## 🔧 Configuration

### Contract Parameters

**YieldFarm Constructor:**
- `rewardToken`: Address of reward token
- `rewardPerBlock`: Tokens distributed per block
- `startBlock`: Farming start block
- `bonusEndBlock`: Bonus period end block

**Pool Parameters:**
- `allocPoint`: Reward allocation weight
- `lpToken`: LP token contract address
- `minStakeAmount`: Minimum stake amount
- `maxStakeAmount`: Maximum stake per user

### Frontend Configuration

Update contract addresses in `frontend/src/App.tsx`:
```typescript
const CONTRACT_ADDRESSES = {
  yieldFarm: '0x...', // YieldFarm contract address
  lpToken: '0x...', // LP token address
  rewardToken: '0x...' // Reward token address
};
```

## 📊 Key Metrics

### Pool Stats
- Total Value Locked (TVL)
- Annual Percentage Yield (APY)
- Total participants
- Reward distribution rate

### User Stats
- Staked amount
- Pending rewards
- Token balances
- Harvest history

## 🛡️ Security Considerations

1. **Auditing**: Consider professional audit before mainnet deployment
2. **Time Locks**: Implement time locks for critical parameter changes
3. **Emergency Procedures**: Clear emergency response protocols
4. **Testing**: Extensive testing on testnets
5. **Monitoring**: Real-time monitoring and alerting

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenZeppelin for security contract libraries
- Foundry for development framework
- Ethereum community for DeFi innovations

## 📞 Support

For questions and support:
- Create an issue in this repository
- Join our Discord community
- Follow us on Twitter

---

**⚠️ Disclaimer**: This is educational/portfolio code. Use at your own risk. Not audited for production use.
