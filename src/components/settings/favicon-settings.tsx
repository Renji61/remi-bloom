"use client";

import { useState, useEffect, useRef } from "react";
import { Image, Upload, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { useAppStore } from "@/stores/app-store";
import { SafeImage } from "@/components/ui/safe-image";
import { uploadImage, getImageUrl, deleteUploadedImage, getUserSetting, setUserSetting } from "@/lib/db";

const FAVICON_KEY = "faviconUrl";

export function FaviconSettings() {
  const faviconUrl = useAppStore((s) => s.faviconUrl);
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setFaviconUrl = useAppStore((s) => s.setFaviconUrl);

  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Load saved favicon
  useEffect(() => {
    async function load() {
      if (!currentUserId) {
        setLoading(false);
        return;
      }

      const saved = await getUserSetting(currentUserId, FAVICON_KEY);
      if (saved) {
        setFaviconUrl(saved);
        if (saved.startsWith("upload:")) {
          const imageId = saved.slice(7);
          setUploadedImageId(imageId);
          const blobUrl = await getImageUrl(imageId);
          if (blobUrl) setUploadedImageUrl(blobUrl);
        } else if (saved.startsWith("/uploads/")) {
          setUploadedImageId(saved);
          setUploadedImageUrl(saved);
        }
      }
      setLoading(false);
    }
    load();
  }, [currentUserId, setFaviconUrl]);

  const applyFavicon = async (url: string) => {
    if (!currentUserId) return;
    setFaviconUrl(url);
    await setUserSetting(currentUserId, FAVICON_KEY, url);
    updateFaviconLink(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      // Remove old uploaded favicon
      if (uploadedImageId) {
        await deleteUploadedImage(uploadedImageId);
        if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      }
      const imageUrl = await uploadImage(file);
      setUploadedImageId(imageUrl);
      setUploadedImageUrl(imageUrl);
      await applyFavicon(imageUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = async () => {
    const url = urlInputRef.current?.value.trim();
    if (!url) return;
    // Validate URL — only allow https:// and blob: protocols
    try {
      const parsed = new URL(url);
      if (!["https:", "blob:"].includes(parsed.protocol)) {
        setUploadError("Only HTTPS and uploaded image URLs are allowed.");
        return;
      }
    } catch {
      setUploadError("Invalid URL. Please enter a valid URL starting with https://");
      return;
    }
    // Remove uploaded image if switching to URL
    if (uploadedImageId) {
      await deleteUploadedImage(uploadedImageId);
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
      setUploadedImageId(null);
      setUploadedImageUrl(null);
    }
    await applyFavicon(url);
  };

  const handleReset = async () => {
    if (uploadedImageId) {
      await deleteUploadedImage(uploadedImageId);
      if (uploadedImageUrl) URL.revokeObjectURL(uploadedImageUrl);
    }
    setUploadedImageId(null);
    setUploadedImageUrl(null);
    setFaviconUrl("");
    if (currentUserId) {
      await setUserSetting(currentUserId, FAVICON_KEY, "");
    }
    updateFaviconLink("/icons/icon-192.png");
  };

  const currentDisplayUrl =
    faviconUrl
      ? faviconUrl.startsWith("upload:")
        ? uploadedImageUrl
        : faviconUrl
      : null;

  if (loading) return null;

  return (
    <div className="rounded-xl border border-outline/10 bg-surface-container/20 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-primary)]/10">
          <Image size={18} className="text-[var(--theme-primary)]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-on-surface">Favicon</h3>
          <p className="text-[10px] text-on-surface-variant/60">
            Customize the browser tab icon
          </p>
        </div>
      </div>

      {/* Current favicon preview */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-container-high ring-1 ring-white/10">
          {currentDisplayUrl ? (
            <SafeImage
              src={currentDisplayUrl}
              alt="Favicon preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <Image size={20} className="text-on-surface-variant/40" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-on-surface-variant/70 truncate">
            {faviconUrl
              ? faviconUrl.startsWith("upload:")
                ? "Uploaded image"
                : faviconUrl
              : "Default icon"}
          </p>
          <button
            onClick={handleReset}
            className="mt-1 flex items-center gap-1 text-[10px] text-on-surface-variant/50 hover:text-red-400 transition-colors"
          >
            <RotateCcw size={10} />
            Reset to default
          </button>
        </div>
      </div>

      {/* Upload file */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
          Upload Image
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/x-icon,image/jpeg"
          className="hidden"
          onChange={handleFileUpload}
          aria-label="Upload favicon"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl border border-dashed border-outline/30 bg-surface-container/30 px-3 py-2 text-[10px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container/60 hover:border-[var(--theme-primary)]/30"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <Upload size={12} />
                Choose Image
              </>
            )}
          </button>
          <span className="text-[9px] text-on-surface-variant/40">
            PNG, ICO, JPEG
          </span>
        </div>
        {uploadError && (
          <p className="mt-1 text-[10px] text-red-400">{uploadError}</p>
        )}
      </div>

      {/* URL input */}
      <div>
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant/60">
          Or Image URL
        </label>
        <div className="flex gap-2">
          <input
            ref={urlInputRef}
            type="url"
            defaultValue={faviconUrl && !faviconUrl.startsWith("upload:") ? faviconUrl : ""}
            placeholder="https://example.com/favicon.png"
            className="min-w-0 flex-1 rounded-xl border border-outline/30 bg-surface-container/60 px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-all focus:border-[var(--theme-primary)]/50 focus:ring-2 focus:ring-[var(--theme-primary)]/20"
          />
          <Button onClick={handleUrlSubmit} size="sm" className="shrink-0">
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}

function updateFaviconLink(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}
