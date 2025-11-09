import { useState } from "react";
import { LockCodeKeypad } from "./LockCodeKeypad";
import { useLockCode } from "@/hooks/useLockCode";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface LockCodeScreenProps {
  onUnlock: () => void;
}

export const LockCodeScreen = ({ onUnlock }: LockCodeScreenProps) => {
  const { verifyLockCode } = useLockCode();
  const [errorMessage, setErrorMessage] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleCodeEntered = async (code: string) => {
    setIsVerifying(true);
    setErrorMessage("");
    
    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('🔐 LockCodeScreen: Verifying code...');
    const isValid = verifyLockCode(code);
    console.log('🔐 LockCodeScreen: Verification result:', isValid);
    
    if (isValid) {
      setIsVerifying(false);
      console.log('🔐 LockCodeScreen: Code valid, calling onUnlock');
      
      // Fun success messages
      const successMessages = [
        "🎉 Access granted! Welcome back, legend!",
        "✅ Unlocked! You're in like Flynn!",
        "🔓 Success! The vault is yours!",
        "🎊 Code accepted! Time to make some beats!",
        "🚀 Unlocked! Let's get this party started!",
        "💚 Perfect! You're officially unlocked!",
        "🎵 Access granted! Time to drop some fire!",
        "🔥 Unlocked! You're on fire today!",
        "✨ Success! The matrix has you!",
        "🎯 Bullseye! Welcome to the future!",
        "🌟 Unlocked! You're a star!",
        "💫 Access granted! The force is strong with you!",
        "🎪 Unlocked! Welcome to the show!",
        "🏆 Success! You're a champion!",
        "🎮 Unlocked! Game on!",
      ];
      
      const randomMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
      toast.success(randomMessage, {
        duration: 3000,
      });
      
      // Verify sessionStorage was set before calling onUnlock
      // Wait and check sessionStorage multiple times to ensure it persists
      let verified = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check all sessionStorage keys to find the verification key
        for (let j = 0; j < sessionStorage.length; j++) {
          const key = sessionStorage.key(j);
          if (key && key.startsWith('lock_code_verified_')) {
            const value = sessionStorage.getItem(key);
            console.log(`🔐 LockCodeScreen: Check ${i + 1}/5 - Found key:`, key, 'value:', value);
            if (value === "true") {
              verified = true;
              break;
            }
          }
        }
        
        if (verified) {
          console.log('✅ LockCodeScreen: SessionStorage verified, proceeding with unlock');
          break;
        } else if (i === 4) {
          console.warn('⚠️ LockCodeScreen: SessionStorage not found after 5 checks, proceeding anyway');
        }
      }
      
      // Call onUnlock callback to notify parent that unlock succeeded
      // This ensures the App component re-renders and hides the lock screen
      onUnlock();
    } else {
      setIsVerifying(false);
      
      // Fun error messages
      const errorMessages = [
        "❌ Wrong code! Try again, detective!",
        "🚫 Nope! That's not it, chief!",
        "💥 Access denied! The code says no!",
        "😅 Close, but no cigar! Try again!",
        "🤔 Not quite right! Give it another shot!",
        "🎲 Wrong number! Roll again!",
        "🔒 Locked out! But don't give up!",
        "🚪 That door stays closed! Try another code!",
        "🎯 Missed the target! Aim again!",
        "💀 Wrong code! The vault remains sealed!",
        "🦄 That's not the magic number!",
        "🎪 Wrong code! The show must wait!",
        "🌊 Wrong wave! Catch another one!",
        "🎸 Wrong chord! Try a different tune!",
        "🎨 Wrong color! Paint it again!",
        "🍕 Wrong slice! Try another piece!",
        "🎮 Game over! Insert code to continue!",
        "🚀 Wrong launch code! Abort and retry!",
        "🎭 Wrong script! Try a different scene!",
        "🎪 Wrong ticket! Try another code!",
      ];
      
      const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
      toast.error(randomMessage, {
        duration: 3000,
      });
      
      setErrorMessage("Incorrect code. Please try again.");
      console.log('🔐 LockCodeScreen: Code invalid');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LockCodeKeypad
          onComplete={handleCodeEntered}
          title="Enter Lock Code"
          subtitle="Enter your 4-digit code to continue"
          errorMessage={errorMessage}
        />
        {isVerifying && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground font-mono">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </div>
        )}
      </div>
    </div>
  );
};

