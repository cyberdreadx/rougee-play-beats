import { useState, useEffect, useRef } from 'react';
import { getIPFSGatewayUrls } from '@/lib/ipfs';

interface IPFSImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  cid: string;
  alt: string;
  fallback?: string;
  maxRetries?: number;
}

/**
 * IPFSImage component with automatic gateway fallback
 * 
 * Automatically tries multiple IPFS gateways if the primary one fails,
 * ensuring images load reliably even if some gateways are down.
 */
export const IPFSImage = ({ 
  cid, 
  alt, 
  fallback = '/placeholder-cover.png',
  maxRetries = 5,
  onError,
  onLoad,
  ...props 
}: IPFSImageProps) => {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const attemptedUrls = useRef<Set<string>>(new Set());
  const gatewayUrls = useRef<string[]>([]);
  const currentAttempt = useRef(0);
  const fallbackSet = useRef(false); // Track if fallback has been set to prevent re-requests

  // Reset state when CID changes
  useEffect(() => {
    if (!cid) {
      if (!fallbackSet.current) {
        setCurrentSrc(fallback);
        setIsLoading(false);
        setHasError(true);
        fallbackSet.current = true;
      }
      return;
    }

    // Get all gateway URLs for this CID
    // Use proxy for images to avoid CORS issues
    gatewayUrls.current = getIPFSGatewayUrls(cid, maxRetries, true); // Use proxy = true
    attemptedUrls.current.clear();
    currentAttempt.current = 0;
    fallbackSet.current = false; // Reset fallback flag for new CID
    setHasError(false);
    setIsLoading(true);

    // Try first gateway
    if (gatewayUrls.current.length > 0) {
      const firstUrl = gatewayUrls.current[0];
      attemptedUrls.current.add(firstUrl);
      setCurrentSrc(firstUrl);
    } else {
      setCurrentSrc(fallback);
      setIsLoading(false);
      setHasError(true);
      fallbackSet.current = true;
    }
  }, [cid, fallback, maxRetries]);

  const tryNextGateway = () => {
    currentAttempt.current += 1;

    // If we've tried all gateways, show fallback
    if (currentAttempt.current >= gatewayUrls.current.length) {
      console.warn(`[IPFSImage] All gateways failed for CID: ${cid}`);
      // Only set fallback if not already set to prevent re-requests
      if (!fallbackSet.current) {
        setCurrentSrc(fallback);
        setIsLoading(false);
        setHasError(true);
        fallbackSet.current = true;
      }
      return;
    }

    // Try next gateway
    const nextUrl = gatewayUrls.current[currentAttempt.current];
    if (!attemptedUrls.current.has(nextUrl)) {
      console.log(`[IPFSImage] Trying gateway ${currentAttempt.current + 1}/${gatewayUrls.current.length} for CID: ${cid}`);
      attemptedUrls.current.add(nextUrl);
      setCurrentSrc(nextUrl);
    } else {
      // Skip already attempted URL
      tryNextGateway();
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.warn(`[IPFSImage] Gateway failed (attempt ${currentAttempt.current + 1}/${gatewayUrls.current.length}):`, currentSrc);
    
    // Call parent's onError if provided
    if (onError) {
      onError(e);
    }

    // Try next gateway
    tryNextGateway();
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoading(false);
    setHasError(false);
    
    // Call parent's onLoad if provided
    if (onLoad) {
      onLoad(e);
    }

    console.log(`[IPFSImage] Successfully loaded from gateway ${currentAttempt.current + 1}:`, currentSrc);
  };

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      onError={handleError}
      onLoad={handleLoad}
      loading="lazy"
    />
  );
};

