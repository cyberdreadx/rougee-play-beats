import { useState } from "react";
import { LockCodeKeypad } from "./LockCodeKeypad";
import { useLockCode } from "@/hooks/useLockCode";
import { Loader2 } from "lucide-react";

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
      
      // Small delay to ensure sessionStorage write is complete and App component can read it
      // sessionStorage is synchronous, but we want to give React time to propagate state changes
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Call onUnlock callback to notify parent that unlock succeeded
      // This ensures the App component re-renders and hides the lock screen
      onUnlock();
    } else {
      setIsVerifying(false);
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

