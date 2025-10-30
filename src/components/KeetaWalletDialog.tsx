import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, Eye, EyeOff, Download, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useKeetaWallet } from '@/hooks/useKeetaWallet';
import { lib } from '@keetanetwork/keetanet-client';

const { Account } = lib;

interface KeetaWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (address: string) => void;
}

export const KeetaWalletDialog: React.FC<KeetaWalletDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { createWallet, importWallet, isConnecting, isConnected, address } = useKeetaWallet();
  const [mode, setMode] = useState<'create' | 'import'>('create');
  const [mnemonic, setMnemonic] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'input' | 'confirm' | 'success'>('input');
  const [generatedMnemonic, setGeneratedMnemonic] = useState('');
  const [confirmedMnemonic, setConfirmedMnemonic] = useState('');

  // No automatic onSuccess call - only call manually when user completes wallet creation

  const handleCreateWallet = async () => {
    try {
      const result = await createWallet();
      setGeneratedMnemonic(result.mnemonic);
      setStep('confirm');
      
      toast({
        title: "Keeta Wallet Created!",
        description: "Please save your private key securely.",
      });
    } catch (error) {
      toast({
        title: "Failed to create wallet",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleImportWallet = async () => {
    if (!mnemonic.trim()) {
      toast({
        title: "Mnemonic required",
        description: "Please enter your private key",
        variant: "destructive",
      });
      return;
    }

    try {
      // Validate mnemonic using real Keeta SDK
      const seed = Account.seedFromPassphrase(mnemonic.trim());
      Account.fromSeed(seed, 0, Account.AccountKeyAlgorithm.ED25519);
      
      const result = await importWallet(mnemonic.trim(), { type: 'mnemonic' });
      setStep('success');
      toast({
        title: "Keeta Wallet Imported!",
        description: "Your wallet has been successfully imported.",
      });
      // Call onSuccess after successful import
      if (onSuccess && result.address) {
        onSuccess(result.address);
      }
    } catch (error) {
      toast({
        title: "Failed to import wallet",
        description: error instanceof Error ? error.message : "Invalid private key",
        variant: "destructive",
      });
    }
  };

  const handleConfirmMnemonic = () => {
    if (confirmedMnemonic === generatedMnemonic) {
      setStep('success');
      toast({
        title: "Wallet Confirmed!",
        description: "Your Keeta wallet is ready to use.",
      });
      // Call onSuccess after successful confirmation
      if (onSuccess && address) {
        onSuccess(address);
      }
    } else {
      toast({
        title: "Mnemonic mismatch",
        description: "The private keys don't match. Please try again.",
        variant: "destructive",
      });
    }
  };

  const copyMnemonic = async () => {
    try {
      await navigator.clipboard.writeText(generatedMnemonic);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Mnemonic phrase copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy private key",
        variant: "destructive",
      });
    }
  };

  const downloadMnemonic = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedMnemonic], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'keeta-wallet-mnemonic.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const resetDialog = () => {
    setMode('create');
    setMnemonic('');
    setShowMnemonic(false);
    setCopied(false);
    setStep('input');
    setGeneratedMnemonic('');
    setConfirmedMnemonic('');
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
              K
            </div>
            Keeta Wallet
          </DialogTitle>
          <DialogDescription className="font-mono">
            {mode === 'create' 
              ? 'Create a new Keeta wallet or import an existing one'
              : 'Import your existing Keeta wallet using a private key'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4 mt-4">
            {/* Mode Selection */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={mode === 'create' ? 'neon' : 'outline'}
                onClick={() => setMode('create')}
                className="font-mono"
              >
                Create New
              </Button>
              <Button
                variant={mode === 'import' ? 'neon' : 'outline'}
                onClick={() => setMode('import')}
                className="font-mono"
              >
                Import
              </Button>
            </div>

            {mode === 'create' ? (
              <div className="space-y-4">
                <Card className="p-4 bg-yellow-50 border-yellow-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-yellow-800">Important Security Notice</p>
                      <p className="text-yellow-700 mt-1">
                        You'll receive a private key. Store it securely - it's the only way to recover your wallet.
                      </p>
                    </div>
                  </div>
                </Card>

                <Button
                  onClick={handleCreateWallet}
                  disabled={isConnecting}
                  className="w-full font-mono"
                  variant="neon"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Wallet...
                    </>
                  ) : (
                    'Create Keeta Wallet'
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mnemonic" className="font-mono text-sm">
                    Private Key
                  </Label>
                  <Textarea
                    id="mnemonic"
                    placeholder="Enter your private key..."
                    value={mnemonic}
                    onChange={(e) => setMnemonic(e.target.value)}
                    className="font-mono mt-1 min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the 24 words separated by spaces
                  </p>
                </div>

                <Button
                  onClick={handleImportWallet}
                  disabled={isConnecting || !mnemonic.trim()}
                  className="w-full font-mono"
                  variant="neon"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Import Wallet'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4 mt-4">
            <Card className="p-4 bg-red-50 border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-red-800">Save This Mnemonic!</p>
                  <p className="text-red-700 mt-1">
                    Write down these 24 words in order and store them safely. Anyone with this phrase can access your wallet.
                  </p>
                </div>
              </div>
            </Card>

            <div>
              <Label className="font-mono text-sm mb-2">Your Mnemonic Phrase</Label>
              <div className="relative">
                <Textarea
                  value={generatedMnemonic}
                  readOnly
                  className="font-mono min-h-[100px] pr-20"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowMnemonic(!showMnemonic)}
                    className="h-8 w-8 p-0"
                  >
                    {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyMnemonic}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={downloadMnemonic}
                variant="outline"
                className="flex-1 font-mono"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                onClick={copyMnemonic}
                variant="outline"
                className="flex-1 font-mono"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-sm">Confirm Private Key</Label>
              <Textarea
                placeholder="Type the private key again to confirm..."
                value={confirmedMnemonic}
                onChange={(e) => setConfirmedMnemonic(e.target.value)}
                className="font-mono min-h-[100px]"
              />
            </div>

            <Button
              onClick={handleConfirmMnemonic}
              disabled={confirmedMnemonic !== generatedMnemonic}
              className="w-full font-mono"
              variant="neon"
            >
              Confirm & Continue
            </Button>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-4 mt-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold font-mono">Wallet Ready!</h3>
              <p className="text-sm text-muted-foreground font-mono">
                Your Keeta wallet has been successfully created and is ready to use.
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="w-full font-mono"
              variant="neon"
            >
              Continue to Wallet
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
