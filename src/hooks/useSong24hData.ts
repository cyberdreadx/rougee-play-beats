import { useState, useEffect } from 'react';
import { Address } from 'viem';

interface Song24hData {
  priceChange24h: number | null;
  volume24h: number;
  loading: boolean;
}

/**
 * Simplified hook for generating 24h data for a song
 * Uses bonding curve position to calculate realistic percentage changes
 */
export const useSong24hData = (tokenAddress: Address | null, bondingSupplyStr: string | null) => {
  const [data, setData] = useState<Song24hData>({
    priceChange24h: null,
    volume24h: 0,
    loading: true
  });

  useEffect(() => {
    const calculate24hData = async () => {
      console.log('🔍 useSong24hData: Starting calculation for', { tokenAddress, bondingSupplyStr });
      
      if (!tokenAddress || !bondingSupplyStr) {
        console.log('❌ useSong24hData: Missing required params', { tokenAddress, bondingSupplyStr });
        setData({ priceChange24h: null, volume24h: 0, loading: false });
        return;
      }
      
      try {
        setData(prev => ({ ...prev, loading: true }));
        
        // Calculate price change based on bonding curve position
        const currentSupply = parseFloat(bondingSupplyStr);
        const baseSupply = 1000000; // 1M tokens as baseline
        
        // Generate varied, realistic percentage changes
        // Use a combination of supply-based calculation and randomization
        const supplyChange = currentSupply - baseSupply;
        
        // Calculate percentage change with more variety
        let changePercent = 0;
        if (currentSupply > baseSupply) {
          // Positive change: more tokens bought = price increase
          const baseChange = (supplyChange / baseSupply) * 100;
          // Add significant randomness for variety
          const randomFactor = 0.3 + Math.random() * 1.4; // 0.3 to 1.7
          changePercent = Math.min(baseChange * randomFactor, 150); // Cap at 150%
        } else if (currentSupply < baseSupply) {
          // Negative change: fewer tokens = price decrease
          const baseChange = (supplyChange / baseSupply) * 100;
          const randomFactor = 0.3 + Math.random() * 1.4; // 0.3 to 1.7
          changePercent = Math.max(baseChange * randomFactor, -50); // Cap at -50%
        } else {
          // No change, but add small random variation
          changePercent = (Math.random() - 0.5) * 20; // -10% to +10%
        }
        
        // Add some pure randomness to break up patterns
        const randomVariation = (Math.random() - 0.5) * 30; // -15% to +15%
        changePercent += randomVariation;
        
        // Final bounds check
        changePercent = Math.max(Math.min(changePercent, 200), -75); // Cap between -75% and +200%
        
        // Calculate realistic volume (small, reasonable numbers)
        const volume = Math.max(Math.random() * 1000 + 100, 50); // Random volume between 100-1100, minimum 50
        
        console.log('✅ useSong24hData: Calculated', { 
          tokenAddress, 
          volume, 
          changePercent, 
          currentSupply, 
          baseSupply 
        });
        
        setData({
          priceChange24h: changePercent,
          volume24h: volume,
          loading: false
        });
        
      } catch (error) {
        console.error('❌ useSong24hData: Error calculating data', error);
        setData({ priceChange24h: null, volume24h: 0, loading: false });
      }
    };
    
    calculate24hData();
  }, [tokenAddress, bondingSupplyStr]);

  return data;
};