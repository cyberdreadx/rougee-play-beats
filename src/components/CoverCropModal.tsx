import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CoverCropModalProps {
  imageUrl: string;
  onComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set canvas size to desired output size (1920x480 for cover)
  canvas.width = 1920;
  canvas.height = 480;

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    1920,
    480
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Canvas is empty'));
      }
    }, 'image/jpeg', 0.95);
  });
}

export const CoverCropModal = ({ imageUrl, onComplete, onCancel }: CoverCropModalProps) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;

    try {
      setProcessing(true);
      const croppedImage = await getCroppedImg(imageUrl, croppedAreaPixels);
      onComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => !processing && onCancel()}>
      <DialogContent className="max-w-full md:max-w-4xl h-[95vh] md:h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 md:p-6 pb-2">
          <DialogTitle className="font-mono text-lg md:text-xl">Crop Your Cover Photo</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Drag to move • Pinch to zoom • Tap buttons for quick adjustments
          </p>
        </DialogHeader>
        
        {/* Fixed size container for better control - 4:1 aspect ratio */}
        <div className="relative w-full bg-black/5 rounded-lg overflow-hidden mx-4 md:mx-6" 
             style={{ height: '300px' }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={4} // 4:1 aspect ratio for cover photos
            cropShape="rect"
            showGrid={true}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            style={{
              containerStyle: {
                height: '100%',
                width: '100%',
                position: 'relative',
              },
              mediaStyle: {
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
              },
              cropAreaStyle: {
                border: '3px solid hsl(var(--primary))',
                boxShadow: '0 0 25px hsl(var(--primary) / 0.6)',
                borderRadius: '8px',
              }
            }}
          />
        </div>

        <div className="space-y-4 p-4 md:p-6 pt-4">
          {/* Zoom Controls */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                Zoom
              </label>
              <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            
            {/* Mobile-optimized zoom controls */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 md:h-10 md:w-10 flex-shrink-0 touch-manipulation"
                onClick={() => setZoom(Math.max(1, zoom - 0.3))}
                disabled={zoom <= 1}
              >
                <ZoomOut className="h-6 w-6 md:h-5 md:w-5" />
              </Button>
              
              <div className="flex-1">
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(values) => setZoom(values[0])}
                  className="w-full cursor-pointer touch-none"
                />
              </div>
              
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 md:h-10 md:w-10 flex-shrink-0 touch-manipulation"
                onClick={() => setZoom(Math.min(3, zoom + 0.3))}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-6 w-6 md:h-5 md:w-5" />
              </Button>
            </div>
          </div>

          {/* Quick Zoom Presets - Mobile optimized */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-12 md:h-10 text-sm font-medium"
              onClick={() => setZoom(1)}
            >
              Fit Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-12 md:h-10 text-sm font-medium"
              onClick={() => setZoom(1.5)}
            >
              1.5x Zoom
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-12 md:h-10 text-sm font-medium"
              onClick={() => setZoom(2)}
            >
              2x Zoom
            </Button>
          </div>

          {/* Position Controls */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Move className="h-4 w-4" />
              Position
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm"
                onClick={() => setCrop({ x: 0, y: 0 })}
              >
                Top Left
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm"
                onClick={() => setCrop({ x: 0, y: 0 })}
              >
                Top Right
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm"
                onClick={() => setCrop({ x: 0, y: 0 })}
              >
                Center
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 text-sm"
                onClick={() => setCrop({ x: 0, y: 0 })}
              >
                Bottom
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 md:p-6 pt-0 flex-row gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={processing}
            className="flex-1 h-12 md:h-10 text-base font-medium"
          >
            Cancel
          </Button>
          <Button
            variant="neon"
            onClick={handleCrop}
            disabled={processing}
            className="flex-1 h-12 md:h-10 text-base font-medium"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Apply Crop'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
