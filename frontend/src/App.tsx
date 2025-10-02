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
  const [activeDashboardPage, setActiveDashboardPage] = useState<string>('overview');

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

  const renderDashboardOverview = () => (
    <div className="dashboard-overview">
      {/* Portfolio Summary */}
      <div className="portfolio-summary">
        <div className="summary-cards">
          <div className="summary-card hover-lift">
            <div className="card-header">
              <h3>Total Portfolio Value</h3>
              <span className="card-icon">💰</span>
            </div>
            <div className="card-value">$12,450.67</div>
            <div className="card-change positive">+5.23% (24h)</div>
          </div>
          <div className="summary-card hover-lift">
            <div className="card-header">
              <h3>Total Staked</h3>
              <span className="card-icon">🏦</span>
            </div>
            <div className="card-value">{userStats.stakedAmount || '0'} LP</div>
            <div className="card-change neutral">Across 3 pools</div>
          </div>
          <div className="summary-card hover-lift">
            <div className="card-header">
              <h3>Pending Rewards</h3>
              <span className="card-icon">⭐</span>
            </div>
            <div className="card-value">{userStats.pendingReward || '0'} YFT</div>
            <div className="card-change positive">Ready to harvest</div>
          </div>
          <div className="summary-card hover-lift">
            <div className="card-header">
              <h3>Average APY</h3>
              <span className="card-icon">📈</span>
            </div>
            <div className="card-value">23.7%</div>
            <div className="card-change positive">+2.1% this week</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-grid">
          <button className="action-btn hover-lift hover-shimmer" onClick={() => setActiveDashboardPage('pools')}>
            <span className="action-icon">🌊</span>
            <span className="action-text">Browse Pools</span>
          </button>
          <button className="action-btn hover-lift hover-shimmer" onClick={handleHarvest} disabled={loading}>
            <span className="action-icon">🌾</span>
            <span className="action-text">Harvest All</span>
          </button>
          <button className="action-btn hover-lift hover-shimmer" onClick={() => setActiveDashboardPage('portfolio')}>
            <span className="action-icon">📊</span>
            <span className="action-text">View Portfolio</span>
          </button>
          <button className="action-btn hover-lift hover-shimmer" onClick={() => setActiveDashboardPage('analytics')}>
            <span className="action-icon">📈</span>
            <span className="action-text">Analytics</span>
          </button>
        </div>
      </div>

      {/* Active Positions */}
      <div className="active-positions">
        <h3>Active Positions</h3>
        <div className="positions-grid">
          <div className="position-card hover-lift">
            <div className="position-header">
              <div className="pool-tokens">
                <span className="token-icon">💎</span>
                <span className="token-icon">💰</span>
              </div>
              <div className="position-info">
                <h4>ETH-USDC LP</h4>
                <span className="pool-type">Stable Pair</span>
              </div>
            </div>
            <div className="position-stats">
              <div className="stat">
                <span className="stat-label">Staked</span>
                <span className="stat-value">2,500 LP</span>
              </div>
              <div className="stat">
                <span className="stat-label">Value</span>
                <span className="stat-value">$5,245.30</span>
              </div>
              <div className="stat">
                <span className="stat-label">APY</span>
                <span className="stat-value">24.5%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Pending</span>
                <span className="stat-value">45.67 YFT</span>
              </div>
            </div>
            <div className="position-actions">
              <button className="btn-secondary">Manage</button>
              <button className="btn-primary">Harvest</button>
            </div>
          </div>

          <div className="position-card hover-lift">
            <div className="position-header">
              <div className="pool-tokens">
                <span className="token-icon">🔥</span>
                <span className="token-icon">💎</span>
              </div>
              <div className="position-info">
                <h4>YFT-ETH LP</h4>
                <span className="pool-type">High Yield</span>
              </div>
            </div>
            <div className="position-stats">
              <div className="stat">
                <span className="stat-label">Staked</span>
                <span className="stat-value">1,200 LP</span>
              </div>
              <div className="stat">
                <span className="stat-label">Value</span>
                <span className="stat-value">$3,890.45</span>
              </div>
              <div className="stat">
                <span className="stat-label">APY</span>
                <span className="stat-value">45.2%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Pending</span>
                <span className="stat-value">78.32 YFT</span>
              </div>
            </div>
            <div className="position-actions">
              <button className="btn-secondary">Manage</button>
              <button className="btn-primary">Harvest</button>
            </div>
          </div>

          <div className="position-card hover-lift">
            <div className="position-header">
              <div className="pool-tokens">
                <span className="token-icon">🌟</span>
                <span className="token-icon">💰</span>
              </div>
              <div className="position-info">
                <h4>DAI-USDC LP</h4>
                <span className="pool-type">Conservative</span>
              </div>
            </div>
            <div className="position-stats">
              <div className="stat">
                <span className="stat-label">Staked</span>
                <span className="stat-value">5,000 LP</span>
              </div>
              <div className="stat">
                <span className="stat-label">Value</span>
                <span className="stat-value">$5,002.15</span>
              </div>
              <div className="stat">
                <span className="stat-label">APY</span>
                <span className="stat-value">12.8%</span>
              </div>
              <div className="stat">
                <span className="stat-label">Pending</span>
                <span className="stat-value">23.45 YFT</span>
              </div>
            </div>
            <div className="position-actions">
              <button className="btn-secondary">Manage</button>
              <button className="btn-primary">Harvest</button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <h3>Recent Activity</h3>
        <div className="activity-list">
          <div className="activity-item">
            <div className="activity-icon">🌾</div>
            <div className="activity-details">
              <span className="activity-action">Harvested rewards</span>
              <span className="activity-amount">+156.78 YFT</span>
            </div>
            <div className="activity-time">2 hours ago</div>
          </div>
          <div className="activity-item">
            <div className="activity-icon">📈</div>
            <div className="activity-details">
              <span className="activity-action">Staked to ETH-USDC pool</span>
              <span className="activity-amount">+500 LP</span>
            </div>
            <div className="activity-time">1 day ago</div>
          </div>
          <div className="activity-item">
            <div className="activity-icon">💰</div>
            <div className="activity-details">
              <span className="activity-action">Withdrew from YFT-ETH pool</span>
              <span className="activity-amount">-200 LP</span>
            </div>
            <div className="activity-time">3 days ago</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboardPools = () => (
    <div className="dashboard-pools">
      <div className="pools-header">
        <h3>Available Farming Pools</h3>
        <div className="pools-filters">
          <button className="filter-btn active">All Pools</button>
          <button className="filter-btn">High APY</button>
          <button className="filter-btn">Stable Pairs</button>
          <button className="filter-btn">My Positions</button>
        </div>
      </div>

      <div className="pools-grid-dashboard">
        <div className="pool-card-dashboard hover-lift">
          <div className="pool-header-dashboard">
            <div className="pool-tokens">
              <span className="token-icon animate-float">💎</span>
              <span className="token-icon animate-float" style={{animationDelay: '1s'}}>💰</span>
            </div>
            <div className="pool-info-header">
              <h4>ETH-USDC LP</h4>
              <span className="pool-category">Stable Pair</span>
            </div>
            <div className="pool-badge">Active</div>
          </div>

          <div className="pool-metrics">
            <div className="metric-item">
              <span className="metric-label">APY</span>
              <span className="metric-value gradient-text">24.5%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">TVL</span>
              <span className="metric-value">$890K</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Your Stake</span>
              <span className="metric-value">2,500 LP</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Pending</span>
              <span className="metric-value">45.67 YFT</span>
            </div>
          </div>

          <div className="pool-actions">
            <div className="stake-section">
              <div className="input-group">
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="Amount to stake"
                  className="stake-input"
                />
                <button className="btn-primary" onClick={handleStake} disabled={loading || !stakeAmount}>
                  {loading ? <span className="loading"></span> : 'Stake'}
                </button>
              </div>
              <div className="input-group">
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Amount to withdraw"
                  className="stake-input"
                />
                <button className="btn-secondary" onClick={handleWithdraw} disabled={loading || !withdrawAmount}>
                  {loading ? <span className="loading"></span> : 'Withdraw'}
                </button>
              </div>
            </div>
            <button className="btn-harvest" onClick={handleHarvest} disabled={loading}>
              {loading ? <span className="loading"></span> : 'Harvest Rewards'}
            </button>
          </div>
        </div>

        <div className="pool-card-dashboard hover-lift">
          <div className="pool-header-dashboard">
            <div className="pool-tokens">
              <span className="token-icon animate-float" style={{animationDelay: '2s'}}>🔥</span>
              <span className="token-icon animate-float" style={{animationDelay: '3s'}}>💎</span>
            </div>
            <div className="pool-info-header">
              <h4>YFT-ETH LP</h4>
              <span className="pool-category">High Yield</span>
            </div>
            <div className="pool-badge hot">Hot</div>
          </div>

          <div className="pool-metrics">
            <div className="metric-item">
              <span className="metric-label">APY</span>
              <span className="metric-value gradient-text">45.2%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">TVL</span>
              <span className="metric-value">$340K</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Your Stake</span>
              <span className="metric-value">1,200 LP</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Pending</span>
              <span className="metric-value">78.32 YFT</span>
            </div>
          </div>

          <div className="pool-actions">
            <div className="stake-section">
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Amount to stake"
                  className="stake-input"
                />
                <button className="btn-primary">Stake</button>
              </div>
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Amount to withdraw"
                  className="stake-input"
                />
                <button className="btn-secondary">Withdraw</button>
              </div>
            </div>
            <button className="btn-harvest">Harvest Rewards</button>
          </div>
        </div>

        <div className="pool-card-dashboard hover-lift">
          <div className="pool-header-dashboard">
            <div className="pool-tokens">
              <span className="token-icon animate-float" style={{animationDelay: '4s'}}>🌟</span>
              <span className="token-icon animate-float" style={{animationDelay: '5s'}}>💰</span>
            </div>
            <div className="pool-info-header">
              <h4>DAI-USDC LP</h4>
              <span className="pool-category">Conservative</span>
            </div>
            <div className="pool-badge stable">Stable</div>
          </div>

          <div className="pool-metrics">
            <div className="metric-item">
              <span className="metric-label">APY</span>
              <span className="metric-value gradient-text">12.8%</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">TVL</span>
              <span className="metric-value">$1.2M</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Your Stake</span>
              <span className="metric-value">5,000 LP</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Pending</span>
              <span className="metric-value">23.45 YFT</span>
            </div>
          </div>

          <div className="pool-actions">
            <div className="stake-section">
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Amount to stake"
                  className="stake-input"
                />
                <button className="btn-primary">Stake</button>
              </div>
              <div className="input-group">
                <input
                  type="number"
                  placeholder="Amount to withdraw"
                  className="stake-input"
                />
                <button className="btn-secondary">Withdraw</button>
              </div>
            </div>
            <button className="btn-harvest">Harvest Rewards</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboardPortfolio = () => (
    <div className="dashboard-portfolio-advanced">
      {/* Header with Market Overview */}
      <div className="market-header">
        <div className="market-stats-row">
          <div className="market-stat">
            <span className="stat-label">Market Cap</span>
            <span className="stat-value">$1.2T</span>
            <span className="stat-change positive">+2.4%</span>
          </div>
          <div className="market-stat">
            <span className="stat-label">24h Volume</span>
            <span className="stat-value">$42.8B</span>
            <span className="stat-change positive">+5.1%</span>
          </div>
          <div className="market-stat">
            <span className="stat-label">DeFi TVL</span>
            <span className="stat-value">$85.3B</span>
            <span className="stat-change negative">-1.2%</span>
          </div>
          <div className="market-stat">
            <span className="stat-label">Fear & Greed</span>
            <span className="stat-value">74</span>
            <span className="stat-badge greed">Greed</span>
          </div>
        </div>
      </div>

      {/* Advanced Trading Chart */}
      <div className="portfolio-content-grid">
        <div className="chart-section">
          <div className="chart-header">
            <div className="chart-title">Portfolio Performance</div>
            <div className="chart-timeframe">
              <button className="timeframe-btn active">1D</button>
              <button className="timeframe-btn">7D</button>
              <button className="timeframe-btn">1M</button>
              <button className="timeframe-btn">3M</button>
              <button className="timeframe-btn">1Y</button>
              <button className="timeframe-btn">ALL</button>
            </div>
          </div>

          <div className="chart-controls-advanced">
            <div className="portfolio-value-header">
              <div className="portfolio-main-value">
                <span className="portfolio-amount">$12,450.67</span>
                <span className="portfolio-change positive">+$1,234.56 (+11.0%)</span>
              </div>
              <div className="portfolio-stats">
                <div className="stat-item">
                  <span className="stat-label">24h High</span>
                  <span className="stat-value">$12,890.23</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h Low</span>
                  <span className="stat-value">$11,234.56</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">24h Volume</span>
                  <span className="stat-value">$234.5K</span>
                </div>
              </div>
            </div>

            <div className="chart-type-controls">
              <button className="chart-type-btn active" data-type="area">📈 Area</button>
              <button className="chart-type-btn" data-type="candlestick">📊 Candlestick</button>
              <button className="chart-type-btn" data-type="line">📉 Line</button>
            </div>
          </div>

          <div className="advanced-chart">
            <svg viewBox="0 0 800 300" className="trading-chart-svg">
              <defs>
                <linearGradient id="portfolioGradientAdvanced" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{stopColor: '#667eea', stopOpacity: 0.4}} />
                  <stop offset="50%" style={{stopColor: '#764ba2', stopOpacity: 0.2}} />
                  <stop offset="100%" style={{stopColor: '#667eea', stopOpacity: 0}} />
                </linearGradient>
                <linearGradient id="volumeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{stopColor: '#00ff88', stopOpacity: 0.3}} />
                  <stop offset="100%" style={{stopColor: '#00ff88', stopOpacity: 0.1}} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Grid Lines */}
              <g className="chart-grid" stroke="rgba(255,255,255,0.05)" strokeWidth="1">
                <line x1="0" y1="60" x2="800" y2="60" />
                <line x1="0" y1="120" x2="800" y2="120" />
                <line x1="0" y1="180" x2="800" y2="180" />
                <line x1="0" y1="240" x2="800" y2="240" />
                <line x1="160" y1="0" x2="160" y2="300" />
                <line x1="320" y1="0" x2="320" y2="300" />
                <line x1="480" y1="0" x2="480" y2="300" />
                <line x1="640" y1="0" x2="640" y2="300" />
              </g>

              {/* Volume Bars */}
              <g className="volume-bars">
                <rect x="40" y="270" width="8" height="20" fill="url(#volumeGradient)" />
                <rect x="80" y="260" width="8" height="30" fill="url(#volumeGradient)" />
                <rect x="120" y="250" width="8" height="40" fill="url(#volumeGradient)" />
                <rect x="160" y="265" width="8" height="25" fill="url(#volumeGradient)" />
                <rect x="200" y="240" width="8" height="50" fill="url(#volumeGradient)" />
                <rect x="240" y="255" width="8" height="35" fill="url(#volumeGradient)" />
                <rect x="280" y="245" width="8" height="45" fill="url(#volumeGradient)" />
                <rect x="320" y="235" width="8" height="55" fill="url(#volumeGradient)" />
                <rect x="360" y="250" width="8" height="40" fill="url(#volumeGradient)" />
                <rect x="400" y="245" width="8" height="45" fill="url(#volumeGradient)" />
                <rect x="440" y="240" width="8" height="50" fill="url(#volumeGradient)" />
                <rect x="480" y="260" width="8" height="30" fill="url(#volumeGradient)" />
                <rect x="520" y="255" width="8" height="35" fill="url(#volumeGradient)" />
                <rect x="560" y="235" width="8" height="55" fill="url(#volumeGradient)" />
                <rect x="600" y="245" width="8" height="45" fill="url(#volumeGradient)" />
                <rect x="640" y="250" width="8" height="40" fill="url(#volumeGradient)" />
                <rect x="680" y="260" width="8" height="30" fill="url(#volumeGradient)" />
                <rect x="720" y="265" width="8" height="25" fill="url(#volumeGradient)" />
                <rect x="760" y="255" width="8" height="35" fill="url(#volumeGradient)" />
              </g>

              {/* Main Price Line */}
              <path
                d="M0,250 L50,235 L100,220 L150,210 L200,180 L250,195 L300,170 L350,160 L400,150 L450,140 L500,120 L550,110 L600,100 L650,95 L700,80 L750,75 L800,60"
                stroke="#667eea"
                strokeWidth="3"
                fill="none"
                filter="url(#glow)"
                className="price-line"
              />

              {/* Area Fill */}
              <path
                d="M0,250 L50,235 L100,220 L150,210 L200,180 L250,195 L300,170 L350,160 L400,150 L450,140 L500,120 L550,110 L600,100 L650,95 L700,80 L750,75 L800,60 L800,300 L0,300 Z"
                fill="url(#portfolioGradientAdvanced)"
              />

              {/* Support/Resistance Lines */}
              <line x1="0" y1="120" x2="800" y2="120" stroke="#00ff88" strokeWidth="2" strokeDasharray="5,5" opacity="0.6" />
              <line x1="0" y1="200" x2="800" y2="200" stroke="#ff4444" strokeWidth="2" strokeDasharray="5,5" opacity="0.6" />

              {/* Data Points */}
              <g className="data-points">
                <circle cx="200" cy="180" r="4" fill="#667eea" className="data-point" />
                <circle cx="400" cy="150" r="4" fill="#667eea" className="data-point" />
                <circle cx="600" cy="100" r="4" fill="#667eea" className="data-point" />
                <circle cx="800" cy="60" r="6" fill="#667eea" className="current-point animate-pulse" />
              </g>

              {/* Tooltip */}
              <g className="price-tooltip" transform="translate(800, 60)">
                <rect x="-60" y="-30" width="120" height="25" rx="5" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.2)" />
                <text x="0" y="-12" textAnchor="middle" fill="white" fontSize="12" fontWeight="600">$12,450.67</text>
              </g>
            </svg>
          </div>

          <div className="chart-stats">
            <div className="chart-stat">
              <div className="chart-stat-label">Total Return</div>
              <div className="chart-stat-value">+11.0%</div>
            </div>
            <div className="chart-stat">
              <div className="chart-stat-label">Sharpe Ratio</div>
              <div className="chart-stat-value">1.43</div>
            </div>
            <div className="chart-stat">
              <div className="chart-stat-label">Max Drawdown</div>
              <div className="chart-stat-value">-8.2%</div>
            </div>
          </div>
        </div>

        <div className="performance-sidebar">
          <div className="performance-card">
            <div className="performance-header">
              <svg className="performance-icon" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="performance-title">Total Portfolio</span>
            </div>
            <div className="performance-value" style={{color: '#00ff88'}}>$12,450.67</div>
            <div className="performance-change" style={{color: '#00ff88'}}>+11.0% today</div>
          </div>

          <div className="performance-card">
            <div className="performance-header">
              <svg className="performance-icon" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="performance-title">Active Farms</span>
            </div>
            <div className="performance-value" style={{color: '#667eea'}}>7</div>
            <div className="performance-change" style={{color: '#667eea'}}>Generating yield</div>
          </div>

          <div className="performance-card">
            <div className="performance-header">
              <svg className="performance-icon" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="performance-title">Pending Rewards</span>
            </div>
            <div className="performance-value" style={{color: '#764ba2'}}>$234.56</div>
            <div className="performance-change" style={{color: '#764ba2'}}>Ready to harvest</div>
          </div>
        </div>
      </div>

      {/* Asset Holdings Table */}
      <div className="holdings-table">
        <div className="table-header">
          <h3>Your Holdings</h3>
          <div className="table-controls">
            <button className="control-btn">
              <span>📊</span> Analytics
            </button>
            <button className="control-btn">
              <span>⚡</span> Auto-Harvest
            </button>
            <button className="control-btn">
              <span>🔄</span> Rebalance
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="advanced-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Holdings</th>
                <th>Price</th>
                <th>24h %</th>
                <th>Value</th>
                <th>Allocation</th>
                <th>P&L</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="table-row">
                <td>
                  <div className="asset-info">
                    <div className="asset-icon">💎</div>
                    <div>
                      <div className="asset-name">ETH-USDC LP</div>
                      <div className="asset-pair">Uniswap V2</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="holdings-amount">
                    <div>2,500.00 LP</div>
                    <div className="holdings-usd">≈ $5,245</div>
                  </div>
                </td>
                <td>
                  <div className="price-info">
                    <div>$2.098</div>
                    <div className="price-change positive">+2.4%</div>
                  </div>
                </td>
                <td>
                  <span className="percentage positive">+5.2%</span>
                </td>
                <td>
                  <div className="value-info">
                    <div>$5,245.30</div>
                    <div className="value-change positive">+$245.30</div>
                  </div>
                </td>
                <td>
                  <div className="allocation-info">
                    <div>42.1%</div>
                    <div className="allocation-bar">
                      <div className="bar-fill" style={{width: '42.1%', background: '#667eea'}}></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="pnl positive">
                    <div>+$456.78</div>
                    <div>+9.5%</div>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn buy">Buy</button>
                    <button className="action-btn sell">Sell</button>
                  </div>
                </td>
              </tr>

              <tr className="table-row">
                <td>
                  <div className="asset-info">
                    <div className="asset-icon">🔥</div>
                    <div>
                      <div className="asset-name">YFT-ETH LP</div>
                      <div className="asset-pair">Uniswap V2</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="holdings-amount">
                    <div>1,200.00 LP</div>
                    <div className="holdings-usd">≈ $3,890</div>
                  </div>
                </td>
                <td>
                  <div className="price-info">
                    <div>$3.242</div>
                    <div className="price-change positive">+8.7%</div>
                  </div>
                </td>
                <td>
                  <span className="percentage positive">+12.4%</span>
                </td>
                <td>
                  <div className="value-info">
                    <div>$3,890.45</div>
                    <div className="value-change positive">+$390.45</div>
                  </div>
                </td>
                <td>
                  <div className="allocation-info">
                    <div>31.3%</div>
                    <div className="allocation-bar">
                      <div className="bar-fill" style={{width: '31.3%', background: '#764ba2'}}></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="pnl positive">
                    <div>+$623.12</div>
                    <div>+19.1%</div>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn buy">Buy</button>
                    <button className="action-btn sell">Sell</button>
                  </div>
                </td>
              </tr>

              <tr className="table-row">
                <td>
                  <div className="asset-info">
                    <div className="asset-icon">🌟</div>
                    <div>
                      <div className="asset-name">DAI-USDC LP</div>
                      <div className="asset-pair">Uniswap V2</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="holdings-amount">
                    <div>3,315.00 LP</div>
                    <div className="holdings-usd">≈ $3,315</div>
                  </div>
                </td>
                <td>
                  <div className="price-info">
                    <div>$1.001</div>
                    <div className="price-change positive">+0.1%</div>
                  </div>
                </td>
                <td>
                  <span className="percentage positive">+0.3%</span>
                </td>
                <td>
                  <div className="value-info">
                    <div>$3,314.92</div>
                    <div className="value-change positive">+$14.92</div>
                  </div>
                </td>
                <td>
                  <div className="allocation-info">
                    <div>26.6%</div>
                    <div className="allocation-bar">
                      <div className="bar-fill" style={{width: '26.6%', background: '#10b981'}}></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="pnl positive">
                    <div>+$154.88</div>
                    <div>+4.9%</div>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn buy">Buy</button>
                    <button className="action-btn sell">Sell</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Token Performance Analytics Dashboard */}
      <div className="token-performance-analytics">
        <div className="analytics-header">
          <h3>Token Performance Analytics</h3>
          <div className="analytics-period-selector">
            <button className="period-btn active">24H</button>
            <button className="period-btn">7D</button>
            <button className="period-btn">30D</button>
            <button className="period-btn">90D</button>
          </div>
        </div>

        <div className="performance-grid">
          <div className="performance-overview-card">
            <div className="card-header">
              <h4>Portfolio Performance Summary</h4>
              <div className="performance-indicator positive">
                <span className="indicator-icon">📈</span>
                <span className="indicator-text">Strong Performance</span>
              </div>
            </div>
            <div className="performance-summary-grid">
              <div className="summary-metric">
                <span className="metric-label">Total Gains</span>
                <span className="metric-value positive">+$1,234.35</span>
                <span className="metric-change">+11.2% overall</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">Best Performer</span>
                <span className="metric-value">YFT-ETH LP</span>
                <span className="metric-change positive">+19.3% ROI</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">Total Value</span>
                <span className="metric-value">$12,450.67</span>
                <span className="metric-change positive">+$583.45 today</span>
              </div>
              <div className="summary-metric">
                <span className="metric-label">Diversification</span>
                <span className="metric-value">4 pools</span>
                <span className="metric-change">Well balanced</span>
              </div>
            </div>
          </div>

          <div className="token-analysis-cards">
            <div className="analysis-card">
              <div className="card-header">
                <h4>Risk-Reward Analysis</h4>
                <div className="analysis-badge medium-risk">Medium Risk</div>
              </div>
              <div className="analysis-content">
                <div className="risk-metric">
                  <span className="metric-name">Portfolio Beta</span>
                  <span className="metric-value">1.23</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{width: '61.5%', backgroundColor: '#ffa500'}}></div>
                  </div>
                </div>
                <div className="risk-metric">
                  <span className="metric-name">Volatility (30d)</span>
                  <span className="metric-value">18.4%</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{width: '36.8%', backgroundColor: '#00ff88'}}></div>
                  </div>
                </div>
                <div className="risk-metric">
                  <span className="metric-name">Sharpe Ratio</span>
                  <span className="metric-value">2.15</span>
                  <div className="metric-bar">
                    <div className="metric-fill" style={{width: '86%', backgroundColor: '#00ff88'}}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="analysis-card">
              <div className="card-header">
                <h4>Yield Optimization</h4>
                <div className="analysis-badge high-yield">High Yield</div>
              </div>
              <div className="yield-recommendations">
                <div className="recommendation">
                  <div className="recommendation-header">
                    <span className="recommendation-icon">🔄</span>
                    <span className="recommendation-title">Rebalance Suggestion</span>
                  </div>
                  <p>Consider moving 5% from DAI-USDC to YFT-ETH for +2.1% APY increase</p>
                  <div className="recommendation-impact positive">+$45.67 annually</div>
                </div>
                <div className="recommendation">
                  <div className="recommendation-header">
                    <span className="recommendation-icon">⚡</span>
                    <span className="recommendation-title">Auto-Compound</span>
                  </div>
                  <p>Enable auto-compounding on YFT-ETH LP to maximize returns</p>
                  <div className="recommendation-impact positive">+3.2% APY boost</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Token Metrics */}
        <div className="detailed-token-metrics">
          <div className="metrics-section-header">
            <h4>Individual Token Analysis</h4>
            <div className="metrics-view-toggle">
              <button className="toggle-btn active">Performance</button>
              <button className="toggle-btn">Technical</button>
              <button className="toggle-btn">Fundamentals</button>
            </div>
          </div>

          <div className="token-metrics-grid">
            <div className="token-metric-card">
              <div className="token-header">
                <div className="token-info">
                  <div className="token-icon">E</div>
                  <div className="token-details">
                    <h5>ETH-USDC LP</h5>
                    <span className="token-protocol">Uniswap V3</span>
                  </div>
                </div>
                <div className="token-performance positive">+9.6%</div>
              </div>
              <div className="token-metrics">
                <div className="metric-row">
                  <span className="metric-label">7-day Performance</span>
                  <span className="metric-value positive">+14.2%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Current APY</span>
                  <span className="metric-value">45.3%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Impermanent Loss</span>
                  <span className="metric-value negative">-1.2%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Fee Rewards (24h)</span>
                  <span className="metric-value positive">+$12.45</span>
                </div>
              </div>
            </div>

            <div className="token-metric-card">
              <div className="token-header">
                <div className="token-info">
                  <div className="token-icon">Y</div>
                  <div className="token-details">
                    <h5>YFT-ETH LP</h5>
                    <span className="token-protocol">YieldFarm</span>
                  </div>
                </div>
                <div className="token-performance positive">+19.3%</div>
              </div>
              <div className="token-metrics">
                <div className="metric-row">
                  <span className="metric-label">7-day Performance</span>
                  <span className="metric-value positive">+23.7%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Current APY</span>
                  <span className="metric-value">67.8%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Reward Multiplier</span>
                  <span className="metric-value">2.3x</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Pending Rewards</span>
                  <span className="metric-value positive">+$78.90</span>
                </div>
              </div>
            </div>

            <div className="token-metric-card">
              <div className="token-header">
                <div className="token-info">
                  <div className="token-icon">D</div>
                  <div className="token-details">
                    <h5>DAI-USDC LP</h5>
                    <span className="token-protocol">Balancer</span>
                  </div>
                </div>
                <div className="token-performance positive">+3.7%</div>
              </div>
              <div className="token-metrics">
                <div className="metric-row">
                  <span className="metric-label">7-day Performance</span>
                  <span className="metric-value positive">+1.8%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Current APY</span>
                  <span className="metric-value">12.6%</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">Risk Level</span>
                  <span className="metric-value">Very Low</span>
                </div>
                <div className="metric-row">
                  <span className="metric-label">BAL Rewards</span>
                  <span className="metric-value positive">+$2.34</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-metrics">
        <div className="metrics-grid-advanced">
          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">📈</span>
              <span className="metric-title">Total Return</span>
            </div>
            <div className="metric-value positive">+$1,234.78</div>
            <div className="metric-subtitle">+11.0% since inception</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">💰</span>
              <span className="metric-title">Daily P&L</span>
            </div>
            <div className="metric-value positive">+$156.23</div>
            <div className="metric-subtitle">+1.3% today</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">⚡</span>
              <span className="metric-title">Best Performer</span>
            </div>
            <div className="metric-value">YFT-ETH LP</div>
            <div className="metric-subtitle positive">+19.1% return</div>
          </div>

          <div className="metric-card">
            <div className="metric-header">
              <span className="metric-icon">🎯</span>
              <span className="metric-title">Avg. APY</span>
            </div>
            <div className="metric-value">23.7%</div>
            <div className="metric-subtitle">Weighted average</div>
          </div>
        </div>
      </div>

      {/* Comprehensive Market Metrics & Protocol Statistics */}
      <div className="market-metrics-comprehensive">
        <div className="metrics-header">
          <h3>Market Analysis & Protocol Statistics</h3>
          <div className="metrics-controls">
            <button className="metric-filter-btn active">All Markets</button>
            <button className="metric-filter-btn">DeFi</button>
            <button className="metric-filter-btn">Yield</button>
            <button className="metric-filter-btn">Governance</button>
          </div>
        </div>

        {/* Market Overview Grid */}
        <div className="market-overview-grid">
          <div className="market-metric-card">
            <div className="metric-card-header">
              <div className="metric-icon-large">🌐</div>
              <div className="metric-card-title">
                <h4>Global DeFi Market</h4>
                <span className="metric-subtitle">Real-time data</span>
              </div>
            </div>
            <div className="metric-data-grid">
              <div className="metric-data-item">
                <span className="data-label">Total TVL</span>
                <span className="data-value">$48.7B</span>
                <span className="data-change positive">+3.2%</span>
              </div>
              <div className="metric-data-item">
                <span className="data-label">24h Volume</span>
                <span className="data-value">$3.2B</span>
                <span className="data-change negative">-1.8%</span>
              </div>
              <div className="metric-data-item">
                <span className="data-label">Active Protocols</span>
                <span className="data-value">2,847</span>
                <span className="data-change positive">+12</span>
              </div>
              <div className="metric-data-item">
                <span className="data-label">Avg APY</span>
                <span className="data-value">18.4%</span>
                <span className="data-change neutral">±0.0%</span>
              </div>
            </div>
          </div>

          <div className="market-metric-card">
            <div className="metric-card-header">
              <div className="metric-icon-large">⚡</div>
              <div className="metric-card-title">
                <h4>YieldFarm Protocol</h4>
                <span className="metric-subtitle">Protocol statistics</span>
              </div>
            </div>
            <div className="metric-data-grid">
              <div className="metric-data-item">
                <span className="data-label">Protocol TVL</span>
                <span className="data-value">$8.9M</span>
                <span className="data-change positive">+15.7%</span>
              </div>
              <div className="metric-data-item">
                <span className="data-label">Active Farmers</span>
                <span className="data-value">4,283</span>
                <span className="data-change positive">+8.1%</span>
              </div>
              <div className="metric-data-item">
                <span className="data-label">Total Rewards</span>
                <span className="data-value">$342K</span>
                <span className="data-change positive">+23.4%</span>
              </div>
              <div className="metric-data-item">
                <span className="data-label">Pools Active</span>
                <span className="data-value">12</span>
                <span className="data-change neutral">±0</span>
              </div>
            </div>
          </div>

          <div className="market-metric-card">
            <div className="metric-card-header">
              <div className="metric-icon-large">📊</div>
              <div className="metric-card-title">
                <h4>Pool Performance</h4>
                <span className="metric-subtitle">Top performing pools</span>
              </div>
            </div>
            <div className="pool-performance-list">
              <div className="pool-item">
                <div className="pool-info">
                  <span className="pool-name">ETH-USDC</span>
                  <span className="pool-protocol">Uniswap V3</span>
                </div>
                <div className="pool-metrics">
                  <span className="pool-apy">45.2% APY</span>
                  <span className="pool-change positive">+2.1%</span>
                </div>
              </div>
              <div className="pool-item">
                <div className="pool-info">
                  <span className="pool-name">YFT-ETH</span>
                  <span className="pool-protocol">YieldFarm</span>
                </div>
                <div className="pool-metrics">
                  <span className="pool-apy">38.7% APY</span>
                  <span className="pool-change positive">+5.8%</span>
                </div>
              </div>
              <div className="pool-item">
                <div className="pool-info">
                  <span className="pool-name">WBTC-USDT</span>
                  <span className="pool-protocol">Curve</span>
                </div>
                <div className="pool-metrics">
                  <span className="pool-apy">23.1% APY</span>
                  <span className="pool-change negative">-0.9%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Protocol Analytics */}
        <div className="protocol-analytics-section">
          <div className="analytics-row">
            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h4>TVL Growth Trend</h4>
                <div className="chart-period-selector">
                  <button className="period-btn active">7D</button>
                  <button className="period-btn">30D</button>
                  <button className="period-btn">90D</button>
                </div>
              </div>
              <div className="mini-chart">
                <svg viewBox="0 0 400 150" className="tvl-chart">
                  <defs>
                    <linearGradient id="tvlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{stopColor: '#00ff88', stopOpacity: 0.3}} />
                      <stop offset="100%" style={{stopColor: '#00ff88', stopOpacity: 0}} />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,120 L50,110 L100,95 L150,85 L200,75 L250,65 L300,55 L350,45 L400,35"
                    stroke="#00ff88"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    d="M0,120 L50,110 L100,95 L150,85 L200,75 L250,65 L300,55 L350,45 L400,35 L400,150 L0,150 Z"
                    fill="url(#tvlGradient)"
                  />
                </svg>
                <div className="chart-value">$8.9M TVL</div>
              </div>
            </div>

            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h4>User Activity</h4>
                <div className="activity-indicator">
                  <span className="activity-dot active"></span>
                  <span>Live</span>
                </div>
              </div>
              <div className="activity-stats">
                <div className="activity-metric">
                  <span className="activity-label">Daily Active Users</span>
                  <span className="activity-value">1,247</span>
                  <span className="activity-trend positive">↗ +12%</span>
                </div>
                <div className="activity-metric">
                  <span className="activity-label">New Farmers Today</span>
                  <span className="activity-value">89</span>
                  <span className="activity-trend positive">↗ +34%</span>
                </div>
                <div className="activity-metric">
                  <span className="activity-label">Transactions</span>
                  <span className="activity-value">3,421</span>
                  <span className="activity-trend neutral">→ +2%</span>
                </div>
              </div>
            </div>

            <div className="analytics-chart-card">
              <div className="chart-card-header">
                <h4>Risk Assessment</h4>
                <div className="risk-score">
                  <span className="score-value">7.2</span>
                  <span className="score-label">/10</span>
                </div>
              </div>
              <div className="risk-breakdown">
                <div className="risk-item">
                  <span className="risk-category">Smart Contract</span>
                  <div className="risk-bar">
                    <div className="risk-fill" style={{width: '85%', backgroundColor: '#00ff88'}}></div>
                  </div>
                  <span className="risk-rating">Low</span>
                </div>
                <div className="risk-item">
                  <span className="risk-category">Liquidity</span>
                  <div className="risk-bar">
                    <div className="risk-fill" style={{width: '70%', backgroundColor: '#ffa500'}}></div>
                  </div>
                  <span className="risk-rating">Medium</span>
                </div>
                <div className="risk-item">
                  <span className="risk-category">Market</span>
                  <div className="risk-bar">
                    <div className="risk-fill" style={{width: '60%', backgroundColor: '#ff4444'}}></div>
                  </div>
                  <span className="risk-rating">High</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Market Comparison Table */}
        <div className="market-comparison-section">
          <div className="comparison-header">
            <h4>Protocol Comparison</h4>
            <div className="comparison-filters">
              <button className="comparison-filter active">All</button>
              <button className="comparison-filter">Yield Farming</button>
              <button className="comparison-filter">DEX</button>
              <button className="comparison-filter">Lending</button>
            </div>
          </div>
          <div className="comparison-table-container">
            <table className="market-comparison-table">
              <thead>
                <tr>
                  <th>Protocol</th>
                  <th>TVL</th>
                  <th>24h Change</th>
                  <th>APY Range</th>
                  <th>Users</th>
                  <th>Risk Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="protocol-row">
                  <td>
                    <div className="protocol-info">
                      <div className="protocol-icon">🌾</div>
                      <div>
                        <div className="protocol-name">YieldFarm</div>
                        <div className="protocol-category">Yield Farming</div>
                      </div>
                    </div>
                  </td>
                  <td><strong>$8.9M</strong></td>
                  <td><span className="change-badge positive">+15.7%</span></td>
                  <td>12.5% - 45.2%</td>
                  <td>4,283</td>
                  <td>
                    <div className="risk-indicator low">7.2</div>
                  </td>
                  <td><span className="status-badge active">Active</span></td>
                </tr>
                <tr className="protocol-row">
                  <td>
                    <div className="protocol-info">
                      <div className="protocol-icon">🦄</div>
                      <div>
                        <div className="protocol-name">Uniswap V3</div>
                        <div className="protocol-category">DEX</div>
                      </div>
                    </div>
                  </td>
                  <td><strong>$4.2B</strong></td>
                  <td><span className="change-badge positive">+3.2%</span></td>
                  <td>5.1% - 89.4%</td>
                  <td>287K</td>
                  <td>
                    <div className="risk-indicator low">8.9</div>
                  </td>
                  <td><span className="status-badge active">Active</span></td>
                </tr>
                <tr className="protocol-row">
                  <td>
                    <div className="protocol-info">
                      <div className="protocol-icon">🏪</div>
                      <div>
                        <div className="protocol-name">Curve Finance</div>
                        <div className="protocol-category">DEX</div>
                      </div>
                    </div>
                  </td>
                  <td><strong>$2.1B</strong></td>
                  <td><span className="change-badge negative">-2.1%</span></td>
                  <td>2.3% - 34.7%</td>
                  <td>45K</td>
                  <td>
                    <div className="risk-indicator medium">6.8</div>
                  </td>
                  <td><span className="status-badge active">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboardAnalytics = () => (
    <div className="dashboard-analytics">
      <div className="analytics-header">
        <h3>Protocol Analytics</h3>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h4>Protocol Metrics</h4>
          <div className="metrics-list">
            <div className="metric-row">
              <span className="metric-name">Total Value Locked</span>
              <span className="metric-amount">$2.4M</span>
              <span className="metric-change positive">+12.5%</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">24h Volume</span>
              <span className="metric-amount">$890K</span>
              <span className="metric-change positive">+8.2%</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">Active Users</span>
              <span className="metric-amount">1,247</span>
              <span className="metric-change positive">+89</span>
            </div>
            <div className="metric-row">
              <span className="metric-name">Total Pools</span>
              <span className="metric-amount">3</span>
              <span className="metric-change neutral">Active</span>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h4>Top Performing Pools</h4>
          <div className="performance-list">
            <div className="performance-item">
              <div className="pool-identity">
                <span className="pool-icon">🔥💎</span>
                <span className="pool-name">YFT-ETH LP</span>
              </div>
              <span className="pool-apy">45.2%</span>
            </div>
            <div className="performance-item">
              <div className="pool-identity">
                <span className="pool-icon">💎💰</span>
                <span className="pool-name">ETH-USDC LP</span>
              </div>
              <span className="pool-apy">24.5%</span>
            </div>
            <div className="performance-item">
              <div className="pool-identity">
                <span className="pool-icon">🌟💰</span>
                <span className="pool-name">DAI-USDC LP</span>
              </div>
              <span className="pool-apy">12.8%</span>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h4>Yield Distribution</h4>
          <div className="distribution-chart">
            <div className="distribution-item">
              <div className="distribution-bar">
                <div className="bar-fill" style={{width: '60%'}}></div>
              </div>
              <span className="distribution-label">Staking Rewards</span>
              <span className="distribution-value">60%</span>
            </div>
            <div className="distribution-item">
              <div className="distribution-bar">
                <div className="bar-fill" style={{width: '25%'}}></div>
              </div>
              <span className="distribution-label">LP Fees</span>
              <span className="distribution-value">25%</span>
            </div>
            <div className="distribution-item">
              <div className="distribution-bar">
                <div className="bar-fill" style={{width: '15%'}}></div>
              </div>
              <span className="distribution-label">Bonus Rewards</span>
              <span className="distribution-value">15%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboardContent = () => {
    switch (activeDashboardPage) {
      case 'overview':
        return renderDashboardOverview();
      case 'pools':
        return renderDashboardPools();
      case 'portfolio':
        return renderDashboardPortfolio();
      case 'analytics':
        return renderDashboardAnalytics();
      default:
        return renderDashboardOverview();
    }
  };

  const renderApp = () => (
    <div className="app-section">
      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {!account ? (
        <div className="connect-prompt">
          <div className="connect-card hover-lift animate-scale-in">
            <div className="connect-icon">🔗</div>
            <h2>Connect Your Wallet</h2>
            <p>Connect your MetaMask wallet to start farming and earning rewards</p>
            <button className="connect-button hover-shimmer" onClick={connectWallet}>
              <span>Connect Wallet</span>
              <span className="connect-arrow">→</span>
            </button>
            <div className="connect-features">
              <span>✓ Secure Connection</span>
              <span>✓ Non-Custodial</span>
              <span>✓ Web3 Native</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard">
          {/* Dashboard Header */}
          <div className="dashboard-header-new">
            <div className="dashboard-title">
              <h2>Farming Dashboard</h2>
              <span className="dashboard-subtitle">Welcome back, farmer! 🌾</span>
            </div>
            <div className="dashboard-user">
              <div className="user-info">
                <span className="user-address">{account.slice(0, 6)}...{account.slice(-4)}</span>
                <span className="user-status">Connected</span>
              </div>
              <div className="user-avatar">👤</div>
            </div>
          </div>

          {/* Dashboard Navigation */}
          <div className="dashboard-nav">
            <button
              className={`nav-tab ${activeDashboardPage === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveDashboardPage('overview')}
            >
              <span className="tab-icon">🏠</span>
              <span>Overview</span>
            </button>
            <button
              className={`nav-tab ${activeDashboardPage === 'pools' ? 'active' : ''}`}
              onClick={() => setActiveDashboardPage('pools')}
            >
              <span className="tab-icon">🌊</span>
              <span>Pools</span>
            </button>
            <button
              className={`nav-tab ${activeDashboardPage === 'portfolio' ? 'active' : ''}`}
              onClick={() => setActiveDashboardPage('portfolio')}
            >
              <span className="tab-icon">📊</span>
              <span>Portfolio</span>
            </button>
            <button
              className={`nav-tab ${activeDashboardPage === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveDashboardPage('analytics')}
            >
              <span className="tab-icon">📈</span>
              <span>Analytics</span>
            </button>
          </div>

          {/* Dashboard Content */}
          <div className="dashboard-content">
            {renderDashboardContent()}
          </div>

          {CONTRACT_ADDRESSES.yieldFarm === '0x...' && (
            <div className="dashboard-warning">
              <div className="warning-content">
                <span className="warning-icon">⚠️</span>
                <div>
                  <strong>Development Mode</strong>
                  <p>Contract addresses are not set. Deploy contracts and update addresses for full functionality.</p>
                </div>
              </div>
            </div>
          )}
        </div>
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