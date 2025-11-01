import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Upload, X } from "lucide-react";
import { usePrivyToken } from "@/hooks/usePrivyToken";

interface StoryUploadProps {
  onUploaded?: () => void;
}

const StoryUpload = ({ onUploaded }: StoryUploadProps) => {
  const { fullAddress } = useWallet();
  const { getAuthHeaders } = usePrivyToken();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 50MB",
        variant: "destructive",
      });
      return;
    }

    // Determine media type
    const type = selectedFile.type.startsWith("image/") ? "image" : "video";
    setMediaType(type);
    setFile(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file || !fullAddress || !mediaType) {
      toast({
        title: "Missing information",
        description: "Please select a file and connect your wallet",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const headers = await getAuthHeaders();
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", caption);
      formData.append("mediaType", mediaType);
      formData.append("walletAddress", fullAddress);

      const { data, error } = await supabase.functions.invoke("upload-story", {
        headers,
        body: formData,
      });

      if (error) throw error;

      toast({
        title: "Story uploaded!",
        description: "Your story is now live for 24 hours",
      });

      // Reset form
      setFile(null);
      setPreview(null);
      setCaption("");
      setMediaType(null);
      setOpen(false);

      // Immediate refresh fallback if realtime is not available
      try { onUploaded && onUploaded(); } catch {}
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload story",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!fullAddress) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Story
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Story</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!preview ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
                id="story-file"
              />
              <label htmlFor="story-file" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload image or video (max 50MB)
                </p>
              </label>
            </div>
          ) : (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setMediaType(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
              {mediaType === "image" ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <video
                  src={preview}
                  controls
                  className="w-full h-64 object-cover rounded-lg"
                  playsInline
                  crossOrigin="anonymous"
                  preload="metadata"
                />
              )}
            </div>
          )}

          <Textarea
            placeholder="Add a caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
          />

          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? "Uploading..." : "Upload Story"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StoryUpload;