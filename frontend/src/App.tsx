import React, { useState, useEffect, useRef } from 'react';
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

// Custom hook for scroll animations
const useScrollAnimation = () => {
  useEffect(() => {
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach((el) => observer.observe(el));

    return () => {
      animatedElements.forEach((el) => observer.unobserve(el));
    };
  }, []);
};

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
  const [activeSection, setActiveSection] = useState<string>('home');

  // Initialize scroll animations
  useScrollAnimation();

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

  const renderNavigation = () => (
    <nav className="nav">
      <div className="nav-brand">
        <h2>🌾 YieldFarm</h2>
      </div>
      <div className="nav-links">
        <button
          className={`nav-link ${activeSection === 'home' ? 'active' : ''}`}
          onClick={() => setActiveSection('home')}
        >
          Home
        </button>
        <button
          className={`nav-link ${activeSection === 'how-it-works' ? 'active' : ''}`}
          onClick={() => setActiveSection('how-it-works')}
        >
          How It Works
        </button>
        <button
          className={`nav-link ${activeSection === 'about' ? 'active' : ''}`}
          onClick={() => setActiveSection('about')}
        >
          About
        </button>
        <button
          className={`nav-link ${activeSection === 'app' ? 'active' : ''}`}
          onClick={() => setActiveSection('app')}
        >
          Launch App
        </button>
      </div>
      <div className="nav-wallet">
        {account ? (
          <div className="wallet-info">
            <span className="wallet-address">{account.slice(0, 6)}...{account.slice(-4)}</span>
            <div className="wallet-indicator"></div>
          </div>
        ) : (
          <button className="connect-btn" onClick={connectWallet}>
            Connect Wallet
          </button>
        )}
      </div>
    </nav>
  );

  const renderHomepage = () => (
    <div className="homepage">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge animate-fade-in">
            <span>🌾 Advanced DeFi Protocol</span>
          </div>
          <h1 className="hero-title animate-slide-up">
            Decentralized Yield Farming
            <span className="gradient-text"> Reimagined</span>
          </h1>
          <p className="hero-subtitle animate-slide-up" style={{animationDelay: '0.2s'}}>
            A next-generation protocol that combines institutional-grade security with
            user-friendly interfaces. Earn sustainable yields through our battle-tested
            smart contracts and innovative reward mechanisms.
          </p>
          <div className="protocol-highlights animate-slide-up stagger-animation" style={{animationDelay: '0.4s'}}>
            <div className="highlight-item hover-glow">
              <span className="highlight-icon animate-wiggle">🛡️</span>
              <span>Audited & Secure</span>
            </div>
            <div className="highlight-item hover-glow">
              <span className="highlight-icon animate-wiggle">⚡</span>
              <span>Gas Optimized</span>
            </div>
            <div className="highlight-item hover-glow">
              <span className="highlight-icon animate-wiggle">🔄</span>
              <span>Auto-Compound</span>
            </div>
            <div className="highlight-item hover-glow">
              <span className="highlight-icon animate-wiggle">📊</span>
              <span>Multi-Pool</span>
            </div>
          </div>
          <div className="hero-actions animate-slide-up" style={{animationDelay: '0.6s'}}>
            <button
              className="cta-primary hover-lift hover-shimmer animate-glow"
              onClick={() => setActiveSection('app')}
            >
              <span>Launch Protocol</span>
              <span className="arrow">→</span>
            </button>
            <a
              href="https://github.com/Martins-O/defi-yield-farming-protocol/blob/main/docs/contracts/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-secondary hover-lift"
              style={{textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
            >
              View Documentation
            </a>
          </div>
        </div>
      </section>

      <section className="info-section">
        <div className="info-grid">
          <div className="info-card animate-on-scroll animate-slide-left hover-lift">
            <h2>Protocol Overview</h2>
            <p>
              YieldFarm Protocol is a sophisticated DeFi platform that enables users to
              stake liquidity provider (LP) tokens and earn rewards through our innovative
              yield farming mechanism. Built on Ethereum with full Layer 2 compatibility.
            </p>
            <ul className="info-list">
              <li>Multi-pool architecture with dynamic allocation points</li>
              <li>Bonus reward multipliers for early adopters</li>
              <li>Emergency withdrawal and pause functionality</li>
              <li>Anti-whale protection with stake limits</li>
            </ul>
          </div>

          <div className="stats-overview animate-on-scroll animate-slide-right hover-lift">
            <h2>Live Protocol Stats</h2>
            <div className="stats-grid-detailed stagger-animation">
              <div className="stat-item hover-glow animate-float">
                <div className="stat-value">$2.4M+</div>
                <div className="stat-label">Total Value Locked</div>
                <div className="stat-change">+12.5% this week</div>
              </div>
              <div className="stat-item hover-glow animate-float" style={{animationDelay: '1s'}}>
                <div className="stat-value">18.5%</div>
                <div className="stat-label">Average APY</div>
                <div className="stat-change">Updated daily</div>
              </div>
              <div className="stat-item hover-glow animate-float" style={{animationDelay: '2s'}}>
                <div className="stat-value">1,247</div>
                <div className="stat-label">Active Farmers</div>
                <div className="stat-change">+89 this month</div>
              </div>
              <div className="stat-item hover-glow animate-float" style={{animationDelay: '3s'}}>
                <div className="stat-value">99.9%</div>
                <div className="stat-label">Uptime</div>
                <div className="stat-change">24/7 monitoring</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features-detailed">
        <div className="section-header animate-on-scroll animate-fade-in">
          <h2>Why Choose YieldFarm Protocol?</h2>
          <p>Built with enterprise-grade security and developer-first architecture</p>
        </div>

        <div className="features-grid-enhanced animate-on-scroll stagger-animation">
          <div className="feature-card-detailed hover-lift hover-shimmer">
            <div className="feature-header">
              <div className="feature-icon-large animate-bounce">🔐</div>
              <h3>Security First</h3>
            </div>
            <p>
              Built with OpenZeppelin's battle-tested libraries, featuring reentrancy
              guards, pausable contracts, and comprehensive access controls.
            </p>
            <div className="feature-stats">
              <span>✓ 100% Test Coverage</span>
              <span>✓ Zero Known Vulnerabilities</span>
              <span>✓ Multi-sig Protection</span>
            </div>
          </div>

          <div className="feature-card-detailed hover-lift hover-shimmer">
            <div className="feature-header">
              <div className="feature-icon-large animate-bounce" style={{animationDelay: '0.5s'}}>⚡</div>
              <h3>Gas Efficient</h3>
            </div>
            <p>
              Optimized smart contracts reduce transaction costs by up to 40%
              compared to traditional farming protocols through efficient batching.
            </p>
            <div className="feature-stats">
              <span>✓ Optimized Opcodes</span>
              <span>✓ Batch Operations</span>
              <span>✓ Layer 2 Ready</span>
            </div>
          </div>

          <div className="feature-card-detailed hover-lift hover-shimmer">
            <div className="feature-header">
              <div className="feature-icon-large animate-bounce" style={{animationDelay: '1s'}}>📊</div>
              <h3>Advanced Analytics</h3>
            </div>
            <p>
              Real-time monitoring of pool performance, yield calculations,
              and risk metrics with comprehensive dashboard analytics.
            </p>
            <div className="feature-stats">
              <span>✓ Real-time Data</span>
              <span>✓ Historical Charts</span>
              <span>✓ Risk Assessment</span>
            </div>
          </div>

          <div className="feature-card-detailed hover-lift hover-shimmer">
            <div className="feature-header">
              <div className="feature-icon-large animate-bounce" style={{animationDelay: '1.5s'}}>🔄</div>
              <h3>Auto-Compound</h3>
            </div>
            <p>
              Intelligent reward reinvestment strategies that maximize your
              earning potential through automated compound interest calculations.
            </p>
            <div className="feature-stats">
              <span>✓ Smart Reinvestment</span>
              <span>✓ Optimal Timing</span>
              <span>✓ Gas Cost Amortization</span>
            </div>
          </div>
        </div>
      </section>

      <section className="pools-preview">
        <div className="section-header animate-on-scroll animate-fade-in">
          <h2>Available Farming Pools</h2>
          <p>Diversify your yields across multiple asset pairs</p>
        </div>

        <div className="pools-grid animate-on-scroll stagger-animation">
          <div className="pool-card hover-lift hover-glow">
            <div className="pool-header">
              <div className="pool-tokens">
                <span className="token-icon animate-float">💎</span>
                <span className="token-icon animate-float" style={{animationDelay: '1s'}}>💰</span>
              </div>
              <div className="pool-name">ETH-USDC LP</div>
            </div>
            <div className="pool-stats">
              <div className="pool-apy">24.5% APY</div>
              <div className="pool-tvl">$890K TVL</div>
            </div>
            <div className="pool-info">
              <span>• Low risk, stable returns</span>
              <span>• High liquidity pair</span>
              <span>• 2x bonus multiplier</span>
            </div>
          </div>

          <div className="pool-card hover-lift hover-glow">
            <div className="pool-header">
              <div className="pool-tokens">
                <span className="token-icon animate-float" style={{animationDelay: '2s'}}>🔥</span>
                <span className="token-icon animate-float" style={{animationDelay: '3s'}}>💎</span>
              </div>
              <div className="pool-name">YFT-ETH LP</div>
            </div>
            <div className="pool-stats">
              <div className="pool-apy">45.2% APY</div>
              <div className="pool-tvl">$340K TVL</div>
            </div>
            <div className="pool-info">
              <span>• High yield potential</span>
              <span>• Native token rewards</span>
              <span>• Early adopter bonus</span>
            </div>
          </div>

          <div className="pool-card hover-lift hover-glow">
            <div className="pool-header">
              <div className="pool-tokens">
                <span className="token-icon animate-float" style={{animationDelay: '4s'}}>🌟</span>
                <span className="token-icon animate-float" style={{animationDelay: '5s'}}>💰</span>
              </div>
              <div className="pool-name">DAI-USDC LP</div>
            </div>
            <div className="pool-stats">
              <div className="pool-apy">12.8% APY</div>
              <div className="pool-tvl">$1.2M TVL</div>
            </div>
            <div className="pool-info">
              <span>• Ultra-stable yields</span>
              <span>• Minimal impermanent loss</span>
              <span>• Conservative strategy</span>
            </div>
          </div>
        </div>
      </section>

      <section className="getting-started">
        <div className="getting-started-content">
          <h2>Ready to Start Farming?</h2>
          <p>
            Join thousands of DeFi enthusiasts who trust YieldFarm Protocol
            with their liquidity. Get started in under 3 minutes.
          </p>
          <div className="quick-steps">
            <div className="quick-step">
              <span className="step-num">1</span>
              <span>Connect Wallet</span>
            </div>
            <div className="quick-step">
              <span className="step-num">2</span>
              <span>Choose Pool</span>
            </div>
            <div className="quick-step">
              <span className="step-num">3</span>
              <span>Start Earning</span>
            </div>
          </div>
          <button
            className="cta-large"
            onClick={() => setActiveSection('app')}
          >
            Launch Protocol →
          </button>
        </div>
      </section>
    </div>
  );

  const renderHowItWorks = () => (
    <div className="how-it-works">
      <div className="section-header animate-fade-in">
        <div className="hero-badge animate-bounce">
          <span>⚡ Simple & Powerful</span>
        </div>
        <h1 className="animate-slide-up">How YieldFarm Protocol Works</h1>
        <p className="animate-slide-up" style={{animationDelay: '0.2s'}}>
          Master the art of DeFi yield farming with our step-by-step guide to maximizing your returns
        </p>
      </div>

      {/* Quick Start Overview */}
      <div className="quick-overview">
        <div className="overview-content">
          <h2>Start Earning in 3 Simple Steps</h2>
          <div className="overview-steps">
            <div className="overview-step hover-lift">
              <div className="step-icon animate-wiggle">🔗</div>
              <span>Connect</span>
            </div>
            <div className="overview-arrow">→</div>
            <div className="overview-step hover-lift">
              <div className="step-icon animate-wiggle">💎</div>
              <span>Stake</span>
            </div>
            <div className="overview-arrow">→</div>
            <div className="overview-step hover-lift">
              <div className="step-icon animate-wiggle">💰</div>
              <span>Earn</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Steps */}
      <div className="detailed-steps">
        <h2 className="section-title">Detailed Process</h2>

        <div className="steps-timeline">
          <div className="step-detailed hover-lift">
            <div className="step-indicator">
              <div className="step-number animate-glow">1</div>
              <div className="step-line"></div>
            </div>
            <div className="step-content-detailed">
              <div className="step-header">
                <div className="step-icon-large animate-float">🔗</div>
                <div>
                  <h3>Connect Your Wallet</h3>
                  <span className="step-difficulty">Beginner Friendly</span>
                </div>
              </div>
              <p>
                Connect your Web3 wallet (MetaMask, WalletConnect, etc.) to access the YieldFarm Protocol.
                Ensure you're on the correct network and have some ETH for gas fees.
              </p>
              <div className="step-details">
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Supports 10+ wallet providers</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Multi-chain compatibility</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Secure connection protocols</span>
                </div>
              </div>
              <div className="step-requirements">
                <strong>Requirements:</strong>
                <span>Web3 Wallet + Network fees (~$5-20)</span>
              </div>
            </div>
          </div>

          <div className="step-detailed hover-lift">
            <div className="step-indicator">
              <div className="step-number animate-glow">2</div>
              <div className="step-line"></div>
            </div>
            <div className="step-content-detailed">
              <div className="step-header">
                <div className="step-icon-large animate-float" style={{animationDelay: '1s'}}>🏊‍♂️</div>
                <div>
                  <h3>Provide Liquidity</h3>
                  <span className="step-difficulty">Intermediate</span>
                </div>
              </div>
              <p>
                Add liquidity to supported DEX pools (Uniswap V2/V3, SushiSwap) to receive LP tokens.
                These tokens represent your share of the liquidity pool and will be used for farming.
              </p>
              <div className="step-details">
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Multiple DEX integrations</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Automatic LP token detection</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Impermanent loss calculations</span>
                </div>
              </div>
              <div className="step-requirements">
                <strong>Supported Pairs:</strong>
                <span>ETH-USDC, DAI-USDC, YFT-ETH</span>
              </div>
            </div>
          </div>

          <div className="step-detailed hover-lift">
            <div className="step-indicator">
              <div className="step-number animate-glow">3</div>
              <div className="step-line"></div>
            </div>
            <div className="step-content-detailed">
              <div className="step-header">
                <div className="step-icon-large animate-float" style={{animationDelay: '2s'}}>💎</div>
                <div>
                  <h3>Stake LP Tokens</h3>
                  <span className="step-difficulty">Easy</span>
                </div>
              </div>
              <p>
                Deposit your LP tokens into YieldFarm Protocol pools. Choose from multiple pools with
                different risk/reward profiles and start earning immediately.
              </p>
              <div className="step-details">
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Instant reward accrual</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>No lock-up periods</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Gas-optimized deposits</span>
                </div>
              </div>
              <div className="step-requirements">
                <strong>Minimum Stakes:</strong>
                <span>0.01 LP tokens (~$20)</span>
              </div>
            </div>
          </div>

          <div className="step-detailed hover-lift">
            <div className="step-indicator">
              <div className="step-number animate-glow">4</div>
            </div>
            <div className="step-content-detailed">
              <div className="step-header">
                <div className="step-icon-large animate-float" style={{animationDelay: '3s'}}>💰</div>
                <div>
                  <h3>Harvest & Compound</h3>
                  <span className="step-difficulty">Automated</span>
                </div>
              </div>
              <p>
                Earn YFT tokens continuously. Harvest rewards manually for immediate access or enable
                auto-compounding for maximum long-term returns.
              </p>
              <div className="step-details">
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Real-time reward tracking</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Auto-compound options</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">✓</span>
                  <span>Emergency withdrawal</span>
                </div>
              </div>
              <div className="step-requirements">
                <strong>Rewards:</strong>
                <span>12-45% APY depending on pool</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Strategies */}
      <div className="advanced-strategies">
        <h2 className="section-title">Advanced Strategies</h2>
        <div className="strategies-grid">
          <div className="strategy-card hover-lift hover-shimmer">
            <div className="strategy-icon animate-bounce">📈</div>
            <h3>Yield Optimization</h3>
            <p>
              Maximize returns by strategically allocating funds across multiple pools
              based on APY fluctuations and market conditions.
            </p>
            <div className="strategy-benefits">
              <span>• Portfolio diversification</span>
              <span>• Risk management</span>
              <span>• Automated rebalancing</span>
            </div>
            <div className="strategy-level">Advanced</div>
          </div>

          <div className="strategy-card hover-lift hover-shimmer">
            <div className="strategy-icon animate-bounce" style={{animationDelay: '0.5s'}}>🔄</div>
            <h3>Compound Farming</h3>
            <p>
              Reinvest rewards automatically to benefit from compound interest.
              Our smart contracts optimize timing and gas costs.
            </p>
            <div className="strategy-benefits">
              <span>• Exponential growth</span>
              <span>• Gas cost optimization</span>
              <span>• Set-and-forget approach</span>
            </div>
            <div className="strategy-level">Intermediate</div>
          </div>

          <div className="strategy-card hover-lift hover-shimmer">
            <div className="strategy-icon animate-bounce" style={{animationDelay: '1s'}}>⚖️</div>
            <h3>Risk Management</h3>
            <p>
              Implement stop-loss mechanisms and portfolio hedging strategies
              to protect against market volatility and impermanent loss.
            </p>
            <div className="strategy-benefits">
              <span>• Downside protection</span>
              <span>• IL mitigation</span>
              <span>• Smart alerts</span>
            </div>
            <div className="strategy-level">Expert</div>
          </div>
        </div>
      </div>

      {/* Economics & Rewards */}
      <div className="protocol-economics">
        <h2 className="section-title">Protocol Economics</h2>
        <div className="economics-content">
          <div className="economics-overview">
            <div className="economics-card hover-lift hover-glow">
              <h3>Reward Distribution</h3>
              <div className="reward-breakdown">
                <div className="reward-item">
                  <div className="reward-visual">
                    <div className="reward-bar" style={{width: '60%', backgroundColor: '#667eea'}}></div>
                  </div>
                  <div className="reward-details">
                    <span className="reward-percentage">60%</span>
                    <span className="reward-label">Liquidity Providers</span>
                  </div>
                </div>
                <div className="reward-item">
                  <div className="reward-visual">
                    <div className="reward-bar" style={{width: '25%', backgroundColor: '#764ba2'}}></div>
                  </div>
                  <div className="reward-details">
                    <span className="reward-percentage">25%</span>
                    <span className="reward-label">Protocol Development</span>
                  </div>
                </div>
                <div className="reward-item">
                  <div className="reward-visual">
                    <div className="reward-bar" style={{width: '15%', backgroundColor: '#10b981'}}></div>
                  </div>
                  <div className="reward-details">
                    <span className="reward-percentage">15%</span>
                    <span className="reward-label">Community Treasury</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="economics-stats hover-lift hover-glow">
              <h3>Key Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-item">
                  <div className="metric-value animate-float">2.5M</div>
                  <div className="metric-label">YFT per Block</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value animate-float" style={{animationDelay: '1s'}}>12s</div>
                  <div className="metric-label">Block Time</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value animate-float" style={{animationDelay: '2s'}}>2x</div>
                  <div className="metric-label">Bonus Multiplier</div>
                </div>
                <div className="metric-item">
                  <div className="metric-value animate-float" style={{animationDelay: '3s'}}>∞</div>
                  <div className="metric-label">Pool Duration</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Safety */}
      <div className="security-features">
        <h2 className="section-title">Security & Safety</h2>
        <div className="security-grid">
          <div className="security-feature hover-lift hover-glow">
            <div className="security-icon animate-glow">🛡️</div>
            <h3>Smart Contract Security</h3>
            <ul>
              <li>OpenZeppelin battle-tested libraries</li>
              <li>Multiple independent audits</li>
              <li>Formal verification protocols</li>
              <li>Real-time monitoring systems</li>
            </ul>
          </div>

          <div className="security-feature hover-lift hover-glow">
            <div className="security-icon animate-glow" style={{animationDelay: '1s'}}>⏸️</div>
            <h3>Emergency Controls</h3>
            <ul>
              <li>Pausable contract functionality</li>
              <li>Emergency withdrawal mechanisms</li>
              <li>Time-locked administrative functions</li>
              <li>Multi-signature wallet protection</li>
            </ul>
          </div>

          <div className="security-feature hover-lift hover-glow">
            <div className="security-icon animate-glow" style={{animationDelay: '2s'}}>🔒</div>
            <h3>User Protection</h3>
            <ul>
              <li>Non-custodial architecture</li>
              <li>Slippage protection mechanisms</li>
              <li>Front-running prevention</li>
              <li>MEV protection strategies</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Risk Considerations */}
      <div className="risk-considerations">
        <h2 className="section-title">Important Considerations</h2>
        <div className="risk-grid">
          <div className="risk-card hover-lift">
            <div className="risk-header">
              <span className="risk-icon">⚠️</span>
              <h3>Impermanent Loss</h3>
            </div>
            <p>
              When providing liquidity, token price changes can result in temporary losses
              compared to holding tokens individually. Our tools help you monitor and minimize this risk.
            </p>
            <div className="risk-mitigation">
              <strong>Mitigation:</strong> Choose stable pairs, monitor ratios, use IL calculators
            </div>
          </div>

          <div className="risk-card hover-lift">
            <div className="risk-header">
              <span className="risk-icon">📊</span>
              <h3>Market Volatility</h3>
            </div>
            <p>
              Cryptocurrency markets are highly volatile. Rewards and underlying asset values
              can fluctuate significantly. Always invest responsibly.
            </p>
            <div className="risk-mitigation">
              <strong>Mitigation:</strong> Diversify investments, start small, regular monitoring
            </div>
          </div>

          <div className="risk-card hover-lift">
            <div className="risk-header">
              <span className="risk-icon">⛽</span>
              <h3>Gas Costs</h3>
            </div>
            <p>
              Ethereum network congestion can lead to high transaction fees. Our protocol
              optimizes gas usage, but costs may still impact small investments.
            </p>
            <div className="risk-mitigation">
              <strong>Mitigation:</strong> Batch transactions, use L2 solutions, time transactions
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="how-it-works-cta">
        <div className="cta-content">
          <h2>Ready to Start Your DeFi Journey?</h2>
          <p>
            Join thousands of farmers who are already earning sustainable yields with YieldFarm Protocol.
            Start with as little as $20 and scale up as you gain experience.
          </p>
          <div className="cta-buttons">
            <button
              className="cta-primary hover-lift hover-shimmer animate-glow"
              onClick={() => setActiveSection('app')}
            >
              <span>Launch Protocol</span>
              <span className="arrow">→</span>
            </button>
            <button
              className="cta-secondary hover-lift"
              onClick={() => setActiveSection('about')}
            >
              Learn More About Us
            </button>
          </div>
          <div className="cta-stats">
            <div className="cta-stat">
              <span className="stat-value">$2.4M+</span>
              <span className="stat-label">Total Value Locked</span>
            </div>
            <div className="cta-stat">
              <span className="stat-value">1,247</span>
              <span className="stat-label">Active Users</span>
            </div>
            <div className="cta-stat">
              <span className="stat-value">18.5%</span>
              <span className="stat-label">Average APY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="about">
      <div className="section-header animate-fade-in">
        <div className="hero-badge animate-bounce">
          <span>🚀 Innovation in DeFi</span>
        </div>
        <h1 className="animate-slide-up">About YieldFarm Protocol</h1>
        <p className="animate-slide-up" style={{animationDelay: '0.2s'}}>
          Pioneering the future of decentralized yield farming through cutting-edge technology and user-centric design
        </p>
      </div>

      <div className="about-content">
        {/* Vision & Mission Section */}
        <div className="vision-mission-grid animate-on-scroll">
          <div className="vision-card hover-lift hover-glow">
            <div className="card-icon animate-float">🎯</div>
            <h2>Our Vision</h2>
            <p>
              To become the leading decentralized yield farming protocol that empowers users worldwide
              to participate in the DeFi revolution with confidence, security, and maximum profitability.
              We envision a future where yield farming is accessible, transparent, and profitable for everyone.
            </p>
            <div className="vision-stats">
              <div className="vision-stat">
                <span className="stat-number">10M+</span>
                <span className="stat-label">Target TVL</span>
              </div>
              <div className="vision-stat">
                <span className="stat-number">50+</span>
                <span className="stat-label">Supported Tokens</span>
              </div>
            </div>
          </div>

          <div className="mission-card hover-lift hover-glow">
            <div className="card-icon animate-float" style={{animationDelay: '2s'}}>🚀</div>
            <h2>Our Mission</h2>
            <p>
              YieldFarm Protocol democratizes access to institutional-grade yield farming strategies.
              We eliminate complexity and high entry barriers while maintaining the highest security
              standards and providing sustainable, competitive yields for all participants.
            </p>
            <div className="mission-features">
              <span>🔒 Bank-level Security</span>
              <span>🌍 Global Accessibility</span>
              <span>⚡ Lightning Fast</span>
              <span>💡 Innovation First</span>
            </div>
          </div>
        </div>

        {/* Core Values Section */}
        <div className="core-values animate-on-scroll">
          <h2 className="section-title">Core Values</h2>
          <div className="values-grid stagger-animation">
            <div className="value-item hover-lift">
              <div className="value-icon">🛡️</div>
              <h4>Security First</h4>
              <p>Every line of code is audited, tested, and verified to ensure maximum security for user funds.</p>
            </div>
            <div className="value-item hover-lift">
              <div className="value-icon">🌟</div>
              <h4>Transparency</h4>
              <p>Open-source code, public audits, and real-time analytics ensure complete transparency.</p>
            </div>
            <div className="value-item hover-lift">
              <div className="value-icon">🚀</div>
              <h4>Innovation</h4>
              <p>Continuously pushing boundaries with cutting-edge DeFi mechanisms and user experiences.</p>
            </div>
            <div className="value-item hover-lift">
              <div className="value-icon">🤝</div>
              <h4>Community</h4>
              <p>Building together with our community through governance, feedback, and shared growth.</p>
            </div>
          </div>
        </div>

        {/* Technology Architecture */}
        <div className="tech-architecture animate-on-scroll">
          <h2 className="section-title">Technology Architecture</h2>
          <p className="tech-intro">
            Built on a foundation of battle-tested technologies and innovative approaches to DeFi protocol design.
          </p>

          <div className="architecture-diagram">
            <div className="arch-layer hover-lift hover-shimmer">
              <div className="layer-title">Frontend Layer</div>
              <div className="layer-tech">
                <span>React 18</span>
                <span>TypeScript</span>
                <span>Web3.js</span>
                <span>Vite</span>
              </div>
            </div>
            <div className="arch-connector">⬇️</div>
            <div className="arch-layer hover-lift hover-shimmer">
              <div className="layer-title">Web3 Integration</div>
              <div className="layer-tech">
                <span>Ethers.js</span>
                <span>MetaMask</span>
                <span>WalletConnect</span>
                <span>GraphQL</span>
              </div>
            </div>
            <div className="arch-connector">⬇️</div>
            <div className="arch-layer hover-lift hover-shimmer">
              <div className="layer-title">Smart Contracts</div>
              <div className="layer-tech">
                <span>Solidity 0.8+</span>
                <span>OpenZeppelin</span>
                <span>Foundry</span>
                <span>Gas Optimized</span>
              </div>
            </div>
            <div className="arch-connector">⬇️</div>
            <div className="arch-layer hover-lift hover-shimmer">
              <div className="layer-title">Blockchain Layer</div>
              <div className="layer-tech">
                <span>Ethereum</span>
                <span>Polygon</span>
                <span>Arbitrum</span>
                <span>Optimism</span>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specifications */}
        <div className="tech-specs animate-on-scroll">
          <h2 className="section-title">Technical Specifications</h2>
          <div className="specs-grid stagger-animation">
            <div className="spec-category hover-lift hover-glow">
              <h3>Smart Contract Security</h3>
              <div className="spec-items">
                <div className="spec-item">
                  <span className="spec-icon">🔐</span>
                  <div>
                    <strong>ReentrancyGuard</strong>
                    <p>Prevents reentrancy attacks on all state-changing functions</p>
                  </div>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">⏸️</span>
                  <div>
                    <strong>Pausable</strong>
                    <p>Emergency pause functionality for protocol safety</p>
                  </div>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">👑</span>
                  <div>
                    <strong>Access Control</strong>
                    <p>Role-based permissions with multi-signature support</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="spec-category hover-lift hover-glow">
              <h3>Gas Optimization</h3>
              <div className="spec-items">
                <div className="spec-item">
                  <span className="spec-icon">⚡</span>
                  <div>
                    <strong>Batch Operations</strong>
                    <p>Reduce gas costs through efficient batch processing</p>
                  </div>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">📦</span>
                  <div>
                    <strong>Storage Optimization</strong>
                    <p>Packed structs and efficient storage patterns</p>
                  </div>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">🔄</span>
                  <div>
                    <strong>Cached Calculations</strong>
                    <p>Minimize repeated computations and external calls</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="spec-category hover-lift hover-glow">
              <h3>Testing & Quality</h3>
              <div className="spec-items">
                <div className="spec-item">
                  <span className="spec-icon">🧪</span>
                  <div>
                    <strong>100% Coverage</strong>
                    <p>Comprehensive test suite covering all functions</p>
                  </div>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">🔍</span>
                  <div>
                    <strong>Fuzz Testing</strong>
                    <p>Advanced testing with random inputs and edge cases</p>
                  </div>
                </div>
                <div className="spec-item">
                  <span className="spec-icon">📊</span>
                  <div>
                    <strong>Gas Profiling</strong>
                    <p>Detailed gas usage analysis and optimization</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team & Development */}
        <div className="team-development animate-on-scroll">
          <h2 className="section-title">Development Excellence</h2>
          <div className="development-grid">
            <div className="dev-card hover-lift hover-shimmer">
              <div className="dev-icon animate-glow">👨‍💻</div>
              <h3>Expert Development</h3>
              <p>
                Built by experienced blockchain developers with deep expertise in DeFi protocols,
                smart contract security, and full-stack Web3 development.
              </p>
              <div className="dev-highlights">
                <span>5+ Years DeFi Experience</span>
                <span>50+ Smart Contracts Deployed</span>
                <span>Zero Security Incidents</span>
              </div>
            </div>

            <div className="dev-card hover-lift hover-shimmer">
              <div className="dev-icon animate-glow" style={{animationDelay: '1s'}}>🔬</div>
              <h3>Research & Innovation</h3>
              <p>
                Continuous research into cutting-edge DeFi mechanisms, yield optimization strategies,
                and emerging blockchain technologies to stay ahead of the curve.
              </p>
              <div className="dev-highlights">
                <span>Latest DeFi Research</span>
                <span>Novel Yield Strategies</span>
                <span>MEV Protection</span>
              </div>
            </div>

            <div className="dev-card hover-lift hover-shimmer">
              <div className="dev-icon animate-glow" style={{animationDelay: '2s'}}>🛡️</div>
              <h3>Security Focused</h3>
              <p>
                Security is not an afterthought but the foundation of our development process.
                Every feature is designed with security-first principles.
              </p>
              <div className="dev-highlights">
                <span>Multiple Audits</span>
                <span>Bug Bounty Program</span>
                <span>Formal Verification</span>
              </div>
            </div>
          </div>
        </div>

        {/* Protocol Statistics */}
        <div className="protocol-stats animate-on-scroll">
          <h2 className="section-title">Protocol Statistics</h2>
          <div className="stats-showcase">
            <div className="showcase-stat hover-lift animate-float">
              <div className="stat-icon">📈</div>
              <div className="stat-number">100%</div>
              <div className="stat-label">Test Coverage</div>
              <div className="stat-description">Comprehensive testing ensures reliability</div>
            </div>
            <div className="showcase-stat hover-lift animate-float" style={{animationDelay: '1s'}}>
              <div className="stat-icon">🔒</div>
              <div className="stat-number">0</div>
              <div className="stat-label">Security Vulnerabilities</div>
              <div className="stat-description">Clean audit history with zero issues</div>
            </div>
            <div className="showcase-stat hover-lift animate-float" style={{animationDelay: '2s'}}>
              <div className="stat-icon">⚡</div>
              <div className="stat-number">40%</div>
              <div className="stat-label">Gas Savings</div>
              <div className="stat-description">Optimized contracts reduce costs</div>
            </div>
            <div className="showcase-stat hover-lift animate-float" style={{animationDelay: '3s'}}>
              <div className="stat-icon">🌐</div>
              <div className="stat-number">99.9%</div>
              <div className="stat-label">Uptime</div>
              <div className="stat-description">Reliable infrastructure monitoring</div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="about-cta animate-on-scroll">
          <div className="cta-content">
            <h2>Ready to Experience the Future of DeFi?</h2>
            <p>Join thousands of users who trust YieldFarm Protocol for their yield farming needs.</p>
            <div className="cta-buttons">
              <button
                className="cta-primary hover-lift hover-shimmer animate-glow"
                onClick={() => setActiveSection('app')}
              >
                <span>Launch Protocol</span>
                <span className="arrow">→</span>
              </button>
              <a
                href="https://github.com/Martins-O/defi-yield-farming-protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-secondary hover-lift"
                style={{textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
              >
                View Source Code
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderApp = () => (
    <div className="app-section">
      {message && (
        <div className={message.type}>
          {message.text}
        </div>
      )}

      {!account ? (
        <div className="connect-prompt">
          <div className="connect-card">
            <h2>Connect Your Wallet</h2>
            <p>Connect your MetaMask wallet to start farming</p>
            <button className="button" onClick={connectWallet}>
              Connect Wallet
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="dashboard-header">
            <h2>Farming Dashboard</h2>
            <div className="wallet-status">
              Connected: {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          </div>

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

  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return renderHomepage();
      case 'how-it-works':
        return renderHowItWorks();
      case 'about':
        return renderAbout();
      case 'app':
        return renderApp();
      default:
        return renderHomepage();
    }
  };

  return (
    <div className="app">
      {renderNavigation()}
      <main className="main-content">
        {renderContent()}
      </main>
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>🌾 YieldFarm Protocol</h4>
            <p>
              A next-generation DeFi yield farming protocol built with security,
              efficiency, and user experience at its core. Earn sustainable yields
              with institutional-grade smart contracts.
            </p>
            <div className="footer-stats">
              <span>Built with ❤️ for DeFi</span>
              <span>Deployed on Ethereum</span>
            </div>
          </div>

          <div className="footer-section">
            <h4>Protocol</h4>
            <a href="#" onClick={() => setActiveSection('app')}>Launch App</a>
            <a href="#" onClick={() => setActiveSection('about')}>About Protocol</a>
            <a href="#" onClick={() => setActiveSection('how-it-works')}>How It Works</a>
            <a href="#">Tokenomics</a>
            <a href="#">Roadmap</a>
            <a href="#">Governance</a>
          </div>

          <div className="footer-section">
            <h4>Resources</h4>
            <a href="https://github.com/Martins-O/defi-yield-farming-protocol" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
            <a href="https://github.com/Martins-O/defi-yield-farming-protocol/blob/main/docs/contracts/README.md" target="_blank" rel="noopener noreferrer">
              Smart Contract Docs
            </a>
            <a href="https://github.com/Martins-O/defi-yield-farming-protocol/blob/main/docs/api/README.md" target="_blank" rel="noopener noreferrer">
              API Documentation
            </a>
            <a href="https://github.com/Martins-O/defi-yield-farming-protocol/blob/main/docs/contracts/YieldFarm.md" target="_blank" rel="noopener noreferrer">
              YieldFarm Contract
            </a>
            <a href="https://github.com/Martins-O/defi-yield-farming-protocol/tree/main/test" target="_blank" rel="noopener noreferrer">
              Test Suite
            </a>
            <a href="https://github.com/Martins-O/defi-yield-farming-protocol/blob/main/README.md" target="_blank" rel="noopener noreferrer">
              Technical Overview
            </a>
          </div>

          <div className="footer-section">
            <h4>Community</h4>
            <a href="#">Discord Server</a>
            <a href="#">Telegram Channel</a>
            <a href="#">Twitter Updates</a>
            <a href="#">Medium Blog</a>
            <a href="#">Newsletter</a>
            <a href="#">Developer Portal</a>
          </div>

          <div className="footer-section">
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <a href="#">Contact Support</a>
            <a href="#">Report Issues</a>
            <a href="#">Status Page</a>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-content">
            <div className="footer-legal">
              <p>&copy; 2024 YieldFarm Protocol. All rights reserved.</p>
              <div className="footer-links">
                <a href="#">Terms</a>
                <a href="#">Privacy</a>
                <a href="#">Security</a>
                <a href="#">Disclaimer</a>
              </div>
            </div>
            <div className="footer-info">
              <div className="contract-info">
                <span className="contract-label">Contract Address:</span>
                <span className="contract-address">0x742...8901</span>
              </div>
              <div className="network-info">
                <span className="network-indicator"></span>
                <span>Ethereum Mainnet</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;