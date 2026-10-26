"use client";
import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import {
  ACCEPTED_IMAGE_TYPES,
  PHOTO_BUCKET,
  resizeImageToJpeg,
  storageObjectPath,
  storagePathFromPublicUrl,
  validateImageFile,
  type UploadKind,
} from "@/lib/upload";

interface ImageUploadProps {
  /** Owner of the photo. Also the storage folder — see storageObjectPath. */
  userId: string;
  kind: UploadKind;
  /** Current public URL, or null when there is no photo yet. */
  value: string | null;
  /** Called with the new public URL, or null when the photo is removed. */
  onChange: (url: string | null) => void;
  /** Rendered in the frame when `value` is null. */
  fallback: React.ReactNode;
  shape?: "circle" | "square";
  /** Size classes for the frame, e.g. "w-20 h-20". */
  className?: string;
  disabled?: boolean;
  /** "chrome" when it sits on the deep band (.pb-band): light labels, a ring in the band's colour. */
  tone?: "default" | "chrome";
}

/**
 * Click-to-change photo control shared by the profile avatar and the pet form.
 *
 * Uploads to the public `photos` bucket and reports the resulting URL upward;
 * it never writes to a table itself, so each caller decides when the new URL
 * is persisted. Replacing or removing a photo deletes the object it replaced,
 * but only when that object is one of ours (see storagePathFromPublicUrl) —
 * seed rows point at Unsplash and must be left alone.
 */
export default function ImageUpload({
  userId,
  kind,
  value,
  onChange,
  fallback,
  shape = "circle",
  className,
  disabled = false,
  tone = "default",
}: ImageUploadProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radius = shape === "circle" ? "rounded-full" : "rounded-2xl";
  const onChrome = tone === "chrome";

  /** Deletes a previous object, ignoring failures: an orphan is not worth an error. */
  const removeStoredObject = async (url: string | null) => {
    const path = storagePathFromPublicUrl(url);
    if (!path) return;
    await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  };

  const handleFile = async (file: File) => {
    setError(null);

    const check = validateImageFile(file);
    if (!check.ok) {
      setError(t(check.errorKey));
      return;
    }

    setBusy(true);
    const previous = value;
    try {
      const resized = await resizeImageToJpeg(file);
      const path = storageObjectPath(userId, kind);

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, resized, { contentType: "image/jpeg", upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
      await removeStoredObject(previous);
    } catch {
      // Thrown rather than returned: a corrupt file that createImageBitmap
      // refuses to decode, or a canvas that is unavailable.
      setError(t("appPages.imageUpload.errorFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    const previous = value;
    onChange(null);
    try {
      await removeStoredObject(previous);
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => {
    if (!disabled && !busy) inputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || busy}
          aria-label={value ? t("appPages.imageUpload.changePhoto") : t("appPages.imageUpload.addPhoto")}
          className={cn(
            "group relative block overflow-hidden ring-1 ring-black/5 transition",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand",
            "disabled:cursor-not-allowed disabled:opacity-70",
            radius,
            className,
          )}
        >
          {value ? (
            <img
              src={value}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className={cn("w-full h-full object-cover bg-surface-2", radius)}
            />
          ) : (
            fallback
          )}

          {/* Hover/focus scrim. Hidden from AT: the button already has a label. */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 flex items-center justify-center bg-black/45 text-white",
              "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity",
              radius,
            )}
          >
            <Camera className="w-5 h-5" />
          </span>

          <AnimatePresence>
            {busy && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn("absolute inset-0 flex items-center justify-center bg-black/50 text-white", radius)}
              >
                <Loader2 className="w-5 h-5 animate-spin" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Camera badge: the affordance on touch, where there is no hover. */}
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full flex items-center justify-center ring-2 pointer-events-none",
            onChrome ? "bg-[var(--hero-accent)] text-brand-deep ring-[var(--hero-from)]" : "bg-brand text-on-brand ring-surface",
          )}
        >
          <Camera className="w-3.5 h-3.5" />
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || busy}
          className={cn(
            "text-sm font-medium transition-colors disabled:opacity-60",
            onChrome ? "text-[var(--hero-accent)] hover:text-chrome-ink" : "text-brand hover:text-brand-strong",
          )}
        >
          {value ? t("appPages.imageUpload.changePhoto") : t("appPages.imageUpload.addPhoto")}
        </button>
        {value && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || busy}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm transition-colors disabled:opacity-60",
              onChrome ? "text-chrome-ink-soft hover:text-chrome-ink" : "text-ink-soft hover:text-danger",
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("appPages.imageUpload.removePhoto")}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className={cn("text-sm text-danger", onChrome && "rounded-[var(--radius-control)] bg-danger-soft px-2.5 py-1")}>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset first: picking the same file twice must fire change again.
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
