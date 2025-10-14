import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from 'wagmi';
import { Address, parseEther, formatEther } from 'viem';
import { toast } from 'sonner';

// Contract addresses on Base mainnet
export const SONG_FACTORY_ADDRESS = '0xA69ab1E008Fb6003D5B73b7b1b6887C0aC86d1ec' as Address;
export const BONDING_CURVE_ADDRESS = '0xCeE9c18C448487a1deAac3E14974C826142C50b5' as Address;
export const XRGE_TOKEN_ADDRESS = '0x147120faec9277ec02d957584cfcd92b56a24317' as Address;

// Contract ABIs
const SONG_FACTORY_ABI = [
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'ipfsHash', type: 'string' }
    ],
    name: 'createSong',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'songToken', type: 'address' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
      { indexed: false, name: 'ipfsHash', type: 'string' }
    ],
    name: 'SongCreated',
    type: 'event'
  }
] as const;

const BONDING_CURVE_ABI = [
  {
    inputs: [
      { name: 'songToken', type: 'address' },
      { name: 'minTokens', type: 'uint256' },
      { name: 'slippageBps', type: 'uint256' }
    ],
    name: 'buyWithETH',
    outputs: [{ name: 'tokensBought', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'songToken', type: 'address' },
      { name: 'xrgeAmount', type: 'uint256' },
      { name: 'minTokens', type: 'uint256' }
    ],
    name: 'buyWithXRGE',
    outputs: [{ name: 'tokensBought', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'songToken', type: 'address' },
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'minXRGE', type: 'uint256' }
    ],
    name: 'sell',
    outputs: [{ name: 'xrgeReceived', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'songToken', type: 'address' }],
    name: 'getCurrentPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'currentSupply', type: 'uint256' },
      { name: 'xrgeAmount', type: 'uint256' }
    ],
    name: 'calculateTokensForXRGE',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function'
  },
  {
    inputs: [
      { name: 'currentSupply', type: 'uint256' },
      { name: 'tokenAmount', type: 'uint256' }
    ],
    name: 'calculateXRGEForTokens',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'buyer', type: 'address' },
      { indexed: true, name: 'songToken', type: 'address' },
      { indexed: false, name: 'xrgeSpent', type: 'uint256' },
      { indexed: false, name: 'tokensBought', type: 'uint256' }
    ],
    name: 'SongTokenBought',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: true, name: 'songToken', type: 'address' },
      { indexed: false, name: 'tokensSold', type: 'uint256' },
      { indexed: false, name: 'xrgeReceived', type: 'uint256' }
    ],
    name: 'SongTokenSold',
    type: 'event'
  }
] as const;

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const SONG_TOKEN_ABI = [
  {
    inputs: [],
    name: 'getMetadata',
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'ipfsHash', type: 'string' },
      { name: 'creator', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'xrgeRaised', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'bondingCurveSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalXRGERaised',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  ...ERC20_ABI
] as const;

// Hook for creating songs
export const useCreateSong = () => {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  const createSong = (name: string, symbol: string, ipfsHash: string) => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      writeContract({
        address: SONG_FACTORY_ADDRESS,
        abi: SONG_FACTORY_ABI,
        functionName: 'createSong',
        args: [name, symbol, ipfsHash],
      } as any);
    } catch (err) {
      console.error('Error creating song:', err);
      toast.error('Failed to create song');
    }
  };

  return {
    createSong,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
    receipt,
  };
};

// Hook for buying song tokens
export const useBuySongTokens = () => {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buyWithETH = async (songTokenAddress: Address, ethAmount: string, slippageBps: number = 500) => {
    if (!address) {
      toast.error('Please connect your wallet');
      throw new Error('Wallet not connected');
    }

    try {
      const txHash = await writeContractAsync({
        address: BONDING_CURVE_ADDRESS,
        abi: BONDING_CURVE_ABI,
        functionName: 'buyWithETH',
        args: [songTokenAddress, 0n, BigInt(slippageBps)],
        value: parseEther(ethAmount),
      } as any);
      return txHash;
    } catch (err) {
      console.error('Error buying tokens:', err);
      toast.error('Failed to buy tokens');
      throw err;
    }
  };

  const buyWithXRGE = async (songTokenAddress: Address, xrgeAmount: string, minTokens: string = '0') => {
    if (!address) {
      toast.error('Please connect your wallet');
      throw new Error('Wallet not connected');
    }

    try {
      const txHash = await writeContractAsync({
        address: BONDING_CURVE_ADDRESS,
        abi: BONDING_CURVE_ABI,
        functionName: 'buyWithXRGE',
        args: [songTokenAddress, parseEther(xrgeAmount), parseEther(minTokens)],
      } as any);
      return txHash;
    } catch (err) {
      console.error('Error buying with XRGE:', err);
      toast.error('Failed to buy with XRGE');
      throw err;
    }
  };

  return {
    buyWithETH,
    buyWithXRGE,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
};

// Hook for selling song tokens
export const useSellSongTokens = () => {
  const { address } = useAccount();
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const sell = async (songTokenAddress: Address, tokenAmount: string, minXRGE: string = '0') => {
    if (!address) {
      toast.error('Please connect your wallet');
      throw new Error('Wallet not connected');
    }

    try {
      const txHash = await writeContractAsync({
        address: BONDING_CURVE_ADDRESS,
        abi: BONDING_CURVE_ABI,
        functionName: 'sell',
        args: [songTokenAddress, parseEther(tokenAmount), parseEther(minXRGE)],
      } as any);
      return txHash;
    } catch (err) {
      console.error('Error selling tokens:', err);
      toast.error('Failed to sell tokens');
      throw err;
    }
  };

  return {
    sell,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
};

// Hook for approving tokens
export const useApproveToken = () => {
  const { writeContractAsync, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = async (tokenAddress: Address, amount: string) => {
    try {
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [BONDING_CURVE_ADDRESS, parseEther(amount)],
      } as any);
      return txHash;
    } catch (err) {
      console.error('Error approving token:', err);
      toast.error('Failed to approve token');
      throw err;
    }
  };

  return {
    approve,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
};

// Hook for getting current price
export const useSongPrice = (songTokenAddress: Address | undefined) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_ABI,
    functionName: 'getCurrentPrice',
    args: songTokenAddress ? [songTokenAddress] : undefined,
    query: {
      enabled: !!songTokenAddress,
    },
  });

  return {
    price: data ? formatEther(data) : '0',
    rawPrice: data,
    isLoading,
    error,
    refetch,
  };
};

// Hook for getting song metadata
export const useSongMetadata = (songTokenAddress: Address | undefined) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: songTokenAddress,
    abi: SONG_TOKEN_ABI,
    functionName: 'getMetadata',
    query: {
      enabled: !!songTokenAddress,
    },
  });

  if (!data) {
    return { metadata: null, isLoading, error, refetch };
  }

  return {
    metadata: {
      name: data[0],
      symbol: data[1],
      ipfsHash: data[2],
      creator: data[3],
      createdAt: new Date(Number(data[4]) * 1000),
      totalSupply: formatEther(data[5]),
      xrgeRaised: formatEther(data[6]),
    },
    isLoading,
    error,
    refetch,
  };
};

// Hook for getting token balance
export const useSongTokenBalance = (songTokenAddress: Address | undefined, userAddress: Address | undefined) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: songTokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!(songTokenAddress && userAddress),
    },
  });

  return {
    balance: data ? formatEther(data) : '0',
    isLoading,
    error,
    refetch,
  };
};

// Hook for checking token approval
export const useSongTokenApproval = (
  songTokenAddress: Address | undefined,
  userAddress: Address | undefined,
  amount: string
) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: songTokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, BONDING_CURVE_ADDRESS] : undefined,
    query: {
      enabled: !!(songTokenAddress && userAddress),
    },
  });

  const isApproved = data ? data >= parseEther(amount || '0') : false;

  return {
    allowance: data ? formatEther(data) : '0',
    isApproved,
    isLoading,
    error,
    refetch,
  };
};

// Hook for getting bonding curve supply (the actual supply used in calculations)
export const useBondingCurveSupply = (songTokenAddress: Address | undefined) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: songTokenAddress,
    abi: SONG_TOKEN_ABI,
    functionName: 'bondingCurveSupply',
    query: {
      enabled: !!songTokenAddress,
    },
  });

  return {
    supply: data ? formatEther(data) : '0',
    isLoading,
    error,
    refetch,
  };
};

// Hook for calculating tokens you'll receive for XRGE amount (buy quote)
export const useBuyQuote = (
  songTokenAddress: Address | undefined,
  xrgeAmount: string
) => {
  // Use bondingCurveSupply - contract expects remaining supply, not circulating
  const { supply: bondingSupply, isLoading: supplyLoading } = useBondingCurveSupply(songTokenAddress);
  const currentSupply = bondingSupply && parseFloat(bondingSupply) > 0 ? parseEther(bondingSupply) : 0n;
  const amount = xrgeAmount && parseFloat(xrgeAmount) > 0 ? parseEther(xrgeAmount) : 0n;

  const { data, isLoading, error, refetch } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_ABI,
    functionName: 'calculateTokensForXRGE',
    args: [currentSupply, amount],
    query: {
      enabled: !!(songTokenAddress && xrgeAmount && parseFloat(xrgeAmount) > 0 && !supplyLoading),
    },
  });

  return {
    tokensOut: data ? formatEther(data) : '0',
    isLoading: isLoading || supplyLoading,
    error,
    refetch,
  };
};

// Hook for calculating XRGE you'll receive for token amount (sell quote)
export const useSellQuote = (
  songTokenAddress: Address | undefined,
  tokenAmount: string
) => {
  // Use bondingCurveSupply - contract expects remaining supply, not circulating
  const { supply: bondingSupply, isLoading: supplyLoading } = useBondingCurveSupply(songTokenAddress);
  const currentSupply = bondingSupply && parseFloat(bondingSupply) > 0 ? parseEther(bondingSupply) : 0n;
  const amount = tokenAmount && parseFloat(tokenAmount) > 0 ? parseEther(tokenAmount) : 0n;

  const { data, isLoading, error, refetch } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BONDING_CURVE_ABI,
    functionName: 'calculateXRGEForTokens',
    args: [currentSupply, amount],
    query: {
      enabled: !!(songTokenAddress && tokenAmount && parseFloat(tokenAmount) > 0 && !supplyLoading),
    },
  });

  return {
    xrgeOut: data ? formatEther(data) : '0',
    isLoading: isLoading || supplyLoading,
    error,
    refetch,
  };
};

// Hook to fetch trade events for chart data
export const useSongTradeEvents = (songTokenAddress: Address | undefined) => {
  const [events, setEvents] = useState<Array<{
    timestamp: number;
    price: number;
    type: 'buy' | 'sell';
    xrgeAmount: number;
    tokenAmount: number;
    trader: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = usePublicClient();

  useEffect(() => {
    if (!songTokenAddress || !publicClient) return;

    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        // Get current block number
        const currentBlock = await publicClient.getBlockNumber();
        
        // Fetch recent history - 2,000 blocks (~1 hour on Base with 2s block time)
        // This works reliably with Alchemy free tier
        const blocksToFetch = 2000n;
        const fromBlock = currentBlock > blocksToFetch ? currentBlock - blocksToFetch : 0n;
        
        console.log(`📊 Fetching trade events for ${songTokenAddress}`);
        console.log(`📊 From block ${fromBlock} to ${currentBlock} (~1 hour of history)`);

        // Fetch buy events
        const buyLogs = await publicClient.getLogs({
          address: BONDING_CURVE_ADDRESS,
          event: {
            type: 'event',
            name: 'SongTokenBought',
            inputs: [
              { indexed: true, name: 'buyer', type: 'address' },
              { indexed: true, name: 'songToken', type: 'address' },
              { indexed: false, name: 'xrgeSpent', type: 'uint256' },
              { indexed: false, name: 'tokensBought', type: 'uint256' }
            ]
          },
          args: {
            songToken: songTokenAddress
          },
          fromBlock,
          toBlock: 'latest',
        });
        
        console.log(`📊 Found ${buyLogs.length} buy events`);

        // Fetch sell events
        const sellLogs = await publicClient.getLogs({
          address: BONDING_CURVE_ADDRESS,
          event: {
            type: 'event',
            name: 'SongTokenSold',
            inputs: [
              { indexed: true, name: 'seller', type: 'address' },
              { indexed: true, name: 'songToken', type: 'address' },
              { indexed: false, name: 'tokensSold', type: 'uint256' },
              { indexed: false, name: 'xrgeReceived', type: 'uint256' }
            ]
          },
          args: {
            songToken: songTokenAddress
          },
          fromBlock,
          toBlock: 'latest',
        });
        
        console.log(`📊 Found ${sellLogs.length} sell events`);

        // Get block details for timestamps
        const allLogs = [...buyLogs, ...sellLogs];
        
        if (allLogs.length === 0) {
          console.log('📊 No trade events found');
          setEvents([]);
          setIsLoading(false);
          return;
        }

        // Get unique block numbers and fetch timestamps
        const blockNumbers = [...new Set(allLogs.map(log => log.blockNumber))];
        const blocks = await Promise.all(
          blockNumbers.map(blockNumber => publicClient.getBlock({ blockNumber }))
        );
        const blockTimestamps = new Map(
          blocks.map(block => [block.number, Number(block.timestamp)])
        );

        // Process buy events (viem gives us typed args)
        const buyEvents = buyLogs.map(log => {
          const xrgeSpent = formatEther(log.args.xrgeSpent as bigint);
          const tokensBought = formatEther(log.args.tokensBought as bigint);
          const price = parseFloat(xrgeSpent) / parseFloat(tokensBought);
          
          return {
            timestamp: blockTimestamps.get(log.blockNumber) || 0,
            price,
            type: 'buy' as const,
            xrgeAmount: parseFloat(xrgeSpent),
            tokenAmount: parseFloat(tokensBought),
            trader: log.args.buyer as string,
          };
        });

        // Process sell events
        const sellEvents = sellLogs.map(log => {
          const tokensSold = formatEther(log.args.tokensSold as bigint);
          const xrgeReceived = formatEther(log.args.xrgeReceived as bigint);
          const price = parseFloat(xrgeReceived) / parseFloat(tokensSold);
          
          return {
            timestamp: blockTimestamps.get(log.blockNumber) || 0,
            price,
            type: 'sell' as const,
            xrgeAmount: parseFloat(xrgeReceived),
            tokenAmount: parseFloat(tokensSold),
            trader: log.args.seller as string,
          };
        });

        // Combine and sort by timestamp
        const allEvents = [...buyEvents, ...sellEvents].sort((a, b) => a.timestamp - b.timestamp);
        setEvents(allEvents);
        console.log(`✅ Fetched ${allEvents.length} total trade events`);
      } catch (error: any) {
        console.error('❌ Error fetching trade events:', error);
        console.error('Error details:', error?.message);
        
        // Check if it's the Alchemy 10-block limit error
        if (error?.message?.includes('block range')) {
          console.log('⚠️ Hit RPC block range limit. Fetching last 100 blocks only...');
          
          try {
            const currentBlock = await publicClient.getBlockNumber();
            const fromBlock = currentBlock - 100n; // Last 100 blocks (~3 minutes)
            
            // Retry with smaller range
            const buyLogs = await publicClient.getLogs({
              address: BONDING_CURVE_ADDRESS,
              event: {
                type: 'event',
                name: 'SongTokenBought',
                inputs: [
                  { indexed: true, name: 'buyer', type: 'address' },
                  { indexed: true, name: 'songToken', type: 'address' },
                  { indexed: false, name: 'xrgeSpent', type: 'uint256' },
                  { indexed: false, name: 'tokensBought', type: 'uint256' }
                ]
              },
              args: { songToken: songTokenAddress },
              fromBlock,
              toBlock: 'latest',
            });
            
            const sellLogs = await publicClient.getLogs({
              address: BONDING_CURVE_ADDRESS,
              event: {
                type: 'event',
                name: 'SongTokenSold',
                inputs: [
                  { indexed: true, name: 'seller', type: 'address' },
                  { indexed: true, name: 'songToken', type: 'address' },
                  { indexed: false, name: 'tokensSold', type: 'uint256' },
                  { indexed: false, name: 'xrgeReceived', type: 'uint256' }
                ]
              },
              args: { songToken: songTokenAddress },
              fromBlock,
              toBlock: 'latest',
            });
            
            if (buyLogs.length === 0 && sellLogs.length === 0) {
              setEvents([]);
              return;
            }
            
            // Process events
            const allLogs = [...buyLogs, ...sellLogs];
            const blockNumbers = [...new Set(allLogs.map(log => log.blockNumber))];
            const blocks = await Promise.all(
              blockNumbers.map(blockNumber => publicClient.getBlock({ blockNumber }))
            );
            const blockTimestamps = new Map(
              blocks.map(block => [block.number, Number(block.timestamp)])
            );
            
            const buyEvents = buyLogs.map(log => {
              const xrgeSpent = formatEther(log.args.xrgeSpent as bigint);
              const tokensBought = formatEther(log.args.tokensBought as bigint);
              const price = parseFloat(xrgeSpent) / parseFloat(tokensBought);
              return {
                timestamp: blockTimestamps.get(log.blockNumber) || 0,
                price,
                type: 'buy' as const,
                xrgeAmount: parseFloat(xrgeSpent),
                tokenAmount: parseFloat(tokensBought),
                trader: log.args.buyer as string,
              };
            });
            
            const sellEvents = sellLogs.map(log => {
              const tokensSold = formatEther(log.args.tokensSold as bigint);
              const xrgeReceived = formatEther(log.args.xrgeReceived as bigint);
              const price = parseFloat(xrgeReceived) / parseFloat(tokensSold);
              return {
                timestamp: blockTimestamps.get(log.blockNumber) || 0,
                price,
                type: 'sell' as const,
                xrgeAmount: parseFloat(xrgeReceived),
                tokenAmount: parseFloat(tokensSold),
                trader: log.args.seller as string,
              };
            });
            
            const allEvents = [...buyEvents, ...sellEvents].sort((a, b) => a.timestamp - b.timestamp);
            setEvents(allEvents);
            console.log(`✅ Fetched ${allEvents.length} recent trade events (last 100 blocks)`);
          } catch (retryError) {
            console.error('❌ Retry also failed:', retryError);
            setEvents([]);
          }
        } else {
          // Other error, just set empty
          setEvents([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [songTokenAddress, publicClient]);

  return {
    events,
    isLoading,
    refetch: () => {
      // Re-trigger the effect by updating state
      if (songTokenAddress) {
        setIsLoading(true);
        setEvents([]);
      }
    },
  };
};
