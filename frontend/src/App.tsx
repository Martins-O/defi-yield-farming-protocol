import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

// Contract ABIs (simplified for demo)
const YIELD_FARM_ABI = [
  "function deposit(uint256 _pid, uint256 _amount) external",
  "function withdraw(uint256 _pid, uint256 _amount) external",
  "function harvest(uint256 _pid) external",
  "function pendingReward(uint256 _pid, address _user) external view returns (uint256)",
  "function getUserInfo(uint256 _pid, address _user) external view returns (uint256, uint256, uint256, uint256)",
  "function getPoolInfo(uint256 _pid) external view returns (address, uint256, uint256, uint256, uint256, uint256, uint256)",
  "function rewardPerBlock() external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

function App() {
  const [account, setAccount] = useState<string>('');
  const [provider, setProvider] = useState<any>(null);
  const [signer, setSigner] = useState<any>(null);
  const [contracts, setContracts] = useState<any>({});
  const [userStats, setUserStats] = useState<any>({});
  const [stakeAmount, setStakeAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  // Contract addresses (these would be set after deployment)
  const CONTRACT_ADDRESSES = {
    yieldFarm: '0x...', // Replace with actual deployed address
    lpToken: '0x...', // Replace with actual deployed address
    rewardToken: '0x...' // Replace with actual deployed address
  };

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    const ethereumProvider = await detectEthereumProvider();

    if (ethereumProvider) {
      const web3Provider = new ethers.BrowserProvider(ethereumProvider as any);
      setProvider(web3Provider);

      // Check if already connected
      const accounts = await web3Provider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
        const signer = await web3Provider.getSigner();
        setSigner(signer);
        await initializeContracts(signer);
      }
    } else {
      setMessage({ type: 'warning', text: 'Please install MetaMask to use this application.' });
    }
  };

  const initializeContracts = async (signer: any) => {
    try {
      const yieldFarmContract = new ethers.Contract(CONTRACT_ADDRESSES.yieldFarm, YIELD_FARM_ABI, signer);
      const lpTokenContract = new ethers.Contract(CONTRACT_ADDRESSES.lpToken, ERC20_ABI, signer);
      const rewardTokenContract = new ethers.Contract(CONTRACT_ADDRESSES.rewardToken, ERC20_ABI, signer);

      setContracts({
        yieldFarm: yieldFarmContract,
        lpToken: lpTokenContract,
        rewardToken: rewardTokenContract
      });

      await loadUserStats(signer.address, { yieldFarm: yieldFarmContract, lpToken: lpTokenContract, rewardToken: rewardTokenContract });
    } catch (error) {
      console.error('Contract initialization error:', error);
      setMessage({ type: 'warning', text: 'Contract addresses not set. Please deploy contracts first.' });
    }
  };

  const connectWallet = async () => {
    if (!provider) return;

    try {
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);
      setSigner(signer);
      await initializeContracts(signer);
      setMessage({ type: 'success', text: 'Wallet connected successfully!' });
    } catch (error) {
      console.error('Connection error:', error);
      setMessage({ type: 'warning', text: 'Failed to connect wallet.' });
    }
  };

  const loadUserStats = async (userAddress: string, contractsObj: any) => {
    try {
      const [userInfo, pendingReward, lpBalance, rewardBalance] = await Promise.all([
        contractsObj.yieldFarm.getUserInfo(0, userAddress),
        contractsObj.yieldFarm.pendingReward(0, userAddress),
        contractsObj.lpToken.balanceOf(userAddress),
        contractsObj.rewardToken.balanceOf(userAddress)
      ]);

      setUserStats({
        stakedAmount: ethers.formatEther(userInfo[0]),
        pendingReward: ethers.formatEther(pendingReward),
        lpBalance: ethers.formatEther(lpBalance),
        rewardBalance: ethers.formatEther(rewardBalance)
      });
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const handleStake = async () => {
    if (!contracts.yieldFarm || !stakeAmount) return;

    setLoading(true);
    try {
      const amount = ethers.parseEther(stakeAmount);

      // Check allowance
      const allowance = await contracts.lpToken.allowance(account, CONTRACT_ADDRESSES.yieldFarm);
      if (allowance < amount) {
        const approveTx = await contracts.lpToken.approve(CONTRACT_ADDRESSES.yieldFarm, amount);
        await approveTx.wait();
      }

      const tx = await contracts.yieldFarm.deposit(0, amount);
      await tx.wait();

      setMessage({ type: 'success', text: `Successfully staked ${stakeAmount} LP tokens!` });
      setStakeAmount('');
      await loadUserStats(account, contracts);
    } catch (error) {
      console.error('Staking error:', error);
      setMessage({ type: 'warning', text: 'Staking failed. Please try again.' });
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!contracts.yieldFarm || !withdrawAmount) return;

    setLoading(true);
    try {
      const amount = ethers.parseEther(withdrawAmount);
      const tx = await contracts.yieldFarm.withdraw(0, amount);
      await tx.wait();

      setMessage({ type: 'success', text: `Successfully withdrew ${withdrawAmount} LP tokens!` });
      setWithdrawAmount('');
      await loadUserStats(account, contracts);
    } catch (error) {
      console.error('Withdrawal error:', error);
      setMessage({ type: 'warning', text: 'Withdrawal failed. Please try again.' });
    }
    setLoading(false);
  };

  const handleHarvest = async () => {
    if (!contracts.yieldFarm) return;

    setLoading(true);
    try {
      const tx = await contracts.yieldFarm.harvest(0);
      await tx.wait();

      setMessage({ type: 'success', text: 'Successfully harvested rewards!' });
      await loadUserStats(account, contracts);
    } catch (error) {
      console.error('Harvest error:', error);
      setMessage({ type: 'warning', text: 'Harvest failed. Please try again.' });
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>🌾 DeFi Yield Farming Protocol</h1>
        <p>Stake your LP tokens and earn rewards</p>
      </div>

      {!account ? (
        <div className="card">
          <h2>Connect Your Wallet</h2>
          <p>Connect your MetaMask wallet to start farming</p>
          <button className="button" onClick={connectWallet}>
            Connect Wallet
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <h2>Connected: {account.slice(0, 6)}...{account.slice(-4)}</h2>
          </div>

          {message && (
            <div className={message.type}>
              {message.text}
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{userStats.stakedAmount || '0'}</div>
              <div className="stat-label">LP Tokens Staked</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userStats.pendingReward || '0'}</div>
              <div className="stat-label">Pending Rewards</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userStats.lpBalance || '0'}</div>
              <div className="stat-label">LP Token Balance</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{userStats.rewardBalance || '0'}</div>
              <div className="stat-label">Reward Token Balance</div>
            </div>
          </div>

          <div className="farm-section">
            <div className="card">
              <h3>Stake LP Tokens</h3>
              <div className="input-group">
                <label>Amount to Stake</label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <button
                className="button"
                onClick={handleStake}
                disabled={loading || !stakeAmount}
              >
                {loading ? <span className="loading"></span> : 'Stake Tokens'}
              </button>
            </div>

            <div className="card">
              <h3>Withdraw & Harvest</h3>
              <div className="input-group">
                <label>Amount to Withdraw</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <button
                className="button"
                onClick={handleWithdraw}
                disabled={loading || !withdrawAmount}
              >
                {loading ? <span className="loading"></span> : 'Withdraw Tokens'}
              </button>
              <button
                className="button"
                onClick={handleHarvest}
                disabled={loading}
              >
                {loading ? <span className="loading"></span> : 'Harvest Rewards'}
              </button>
            </div>
          </div>

          {CONTRACT_ADDRESSES.yieldFarm === '0x...' && (
            <div className="warning">
              <strong>Note:</strong> Contract addresses are not set. Please deploy the contracts and update the addresses in the frontend code.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;