import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, QrCode, Loader2 } from 'lucide-react';
import keetaLogo from '@/assets/tokens/kta.png';
import { toast } from '@/hooks/use-toast';
import QRCodeLib from 'qrcode';

interface KeetaQRCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address: string;
}

export const KeetaQRCode: React.FC<KeetaQRCodeProps> = ({
  open,
  onOpenChange,
  address,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open && address) {
      generateQRCode();
    }
  }, [open, address]);

  const generateQRCode = async () => {
    if (!address) return;
    
    setIsGenerating(true);
    try {
      const qrCode = await QRCodeLib.toDataURL(address, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrCode);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      toast({
        title: "QR Code Error",
        description: "Failed to generate QR code for the address.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address Copied!",
      description: "Keeta wallet address copied to clipboard.",
    });
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    link.href = qrCodeDataUrl;
    link.download = `keeta-wallet-${address.slice(-8)}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "QR Code Downloaded!",
      description: "QR code saved to your downloads folder.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={keetaLogo} alt="Keeta" className="h-5 w-5" />
            <QrCode className="h-5 w-5" />
            Keeta Wallet QR Code
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Address Display */}
          <Card className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  Keeta Address
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm font-mono break-all text-muted-foreground">
                {address}
              </p>
            </div>
          </Card>

          {/* QR Code */}
          <Card className="p-6">
            <div className="flex flex-col items-center space-y-4">
              {isGenerating ? (
                <div className="flex flex-col items-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating QR code...</p>
                </div>
              ) : qrCodeDataUrl ? (
                <div className="space-y-4">
                  <img
                    src={qrCodeDataUrl}
                    alt="Keeta Wallet QR Code"
                    className="w-64 h-64 mx-auto border rounded-lg"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadQRCode}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateQRCode}
                      className="flex-1"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Regenerate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <p>Failed to generate QR code</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateQRCode}
                    className="mt-2"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Instructions */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Scan this QR code with a Keeta wallet to send tokens</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
