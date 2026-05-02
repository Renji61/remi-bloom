"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui";

interface CameraViewProps {
  onCapture: (imageData: string, imageFile?: File) => void;
}

export function CameraView({ onCapture }: CameraViewProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      setPermissionDenied(false);
    } catch {
      setPermissionDenied(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Assign the stream to the video element after it's rendered
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    // Also produce a File directly to avoid a fetch(dataURL) round-trip
    canvas.toBlob(
      (blob) => {
        stopCamera();
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          onCapture(dataUrl, file);
        } else {
          onCapture(dataUrl);
        }
      },
      "image/jpeg",
      0.8,
    );
  }, [onCapture, stopCamera]);

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-8 text-center">
        <Camera size={32} className="mb-3 text-amber-400" />
        <p className="text-sm font-medium text-on-surface">Camera access denied</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Please allow camera access in your browser settings.
        </p>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/60 bg-surface-container/30 p-8 text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container-high">
          <Camera size={28} className="text-on-surface-variant" />
        </div>
        <p className="text-sm font-medium text-on-surface">Plant Scanner</p>
        <p className="mt-1 mb-4 text-xs text-on-surface-variant">
          Point your camera at a plant to identify it
        </p>
        <Button onClick={startCamera} disabled={isLoading}>
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Camera size={16} />
          )}
          {isLoading ? "Starting..." : "Open Camera"}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="relative aspect-[4/3] bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {/* Scan Frame Overlay */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-3/5 w-3/5 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-[var(--theme-primary)]" />
            <div className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-[var(--theme-primary)]" />
            <div className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-[var(--theme-primary)]" />
            <div className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-[var(--theme-primary)]" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={capture}
          className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur-sm"
        >
          <div className="h-10 w-10 rounded-full bg-white" />
        </motion.button>
      </div>

      <button
        onClick={stopCamera}
        className="absolute right-4 top-4 rounded-full bg-black/40 p-2 backdrop-blur-sm"
        aria-label="Close camera"
      >
        <X size={18} className="text-white" />
      </button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
