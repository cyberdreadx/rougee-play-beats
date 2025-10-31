import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Delete, Lock } from "lucide-react";

interface LockCodeKeypadProps {
  onComplete: (code: string) => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  showCancel?: boolean;
  errorMessage?: string;
  resetKey?: string | number; // Key to trigger reset when changed
}

export const LockCodeKeypad = ({
  onComplete,
  onCancel,
  title = "Enter Lock Code",
  subtitle = "Enter your 4-digit code",
  showCancel = false,
  errorMessage,
  resetKey,
}: LockCodeKeypadProps) => {
  const [code, setCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset code when resetKey changes (for confirm step)
  useEffect(() => {
    if (resetKey !== undefined) {
      setCode("");
      setIsProcessing(false);
    }
  }, [resetKey]);

  const handleNumberPress = (num: string) => {
    // Prevent rapid input - if already processing, ignore
    if (isProcessing || code.length >= 4) {
      return;
    }

    // Set processing flag to prevent rapid clicks
    setIsProcessing(true);
    
    const newCode = code + num;
    setCode(newCode);
    
    // Auto-submit when 4 digits entered
    if (newCode.length === 4) {
      setTimeout(() => {
        onComplete(newCode);
        setIsProcessing(false);
      }, 100);
    } else {
      // Release processing flag after a short delay to prevent rapid input
      setTimeout(() => {
        setIsProcessing(false);
      }, 150);
    }
  };

  const handleDelete = () => {
    setCode((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setCode("");
  };

  // Reset code when error message changes
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setCode("");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-neon-green/20 flex items-center justify-center border-2 border-neon-green/50">
            <Lock className="h-8 w-8 text-neon-green" />
          </div>
        </div>
        <h2 className="text-2xl font-bold font-mono text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground font-mono">{subtitle}</p>
        {errorMessage && (
          <p className="text-sm text-destructive font-mono mt-2">{errorMessage}</p>
        )}
      </div>

      {/* Code Display */}
      <div className="flex items-center justify-center gap-3">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center font-mono text-2xl font-bold transition-all ${
              index < code.length
                ? "border-neon-green bg-neon-green/20 text-neon-green"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            {index < code.length ? "●" : ""}
          </div>
        ))}
      </div>

      {/* Keypad */}
      <Card className="p-6 bg-white/5 backdrop-blur-xl border border-white/10">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Button
              key={num}
              variant="outline"
              size="lg"
              className="h-16 text-xl font-mono font-bold hover:bg-neon-green/20 hover:text-neon-green hover:border-neon-green/50 active:bg-neon-green/30 transition-all"
              onClick={() => handleNumberPress(num.toString())}
              disabled={isProcessing || code.length >= 4}
            >
              {num}
            </Button>
          ))}
          
          {/* Bottom row: Cancel, 0, Delete */}
          {showCancel ? (
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-sm font-mono hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : (
            <div /> // Empty space
          )}
          
          <Button
            variant="outline"
            size="lg"
            className="h-16 text-xl font-mono font-bold hover:bg-neon-green/20 hover:text-neon-green hover:border-neon-green/50 active:bg-neon-green/30 transition-all"
            onClick={() => handleNumberPress("0")}
            disabled={isProcessing || code.length >= 4}
          >
            0
          </Button>
          
          <Button
            variant="outline"
            size="lg"
            className="h-16 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/50 active:bg-destructive/30 transition-all"
            onClick={handleDelete}
            disabled={code.length === 0}
          >
            <Delete className="h-5 w-5" />
          </Button>
        </div>
      </Card>

      {/* Clear button (optional, if code is partially entered) */}
      {code.length > 0 && (
        <div className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground font-mono"
            onClick={handleClear}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};

