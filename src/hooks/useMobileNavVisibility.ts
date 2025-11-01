import { useState, useEffect } from 'react';

export function useMobileNavVisibility() {
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only apply scroll behavior on mobile
      if (window.innerWidth >= 768) {
        setIsMobileNavVisible(true);
        return;
      }
      
      // Show nav when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY) {
        setIsMobileNavVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsMobileNavVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return isMobileNavVisible;
}

