"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  profilePhotoFrameClass,
  profilePhotoImageClass,
} from "@/components/ui/profile-photo-frame";
import { prepareProfilePhoto } from "@/lib/avatars/crop-avatar";
import { cn } from "@/lib/utils";

interface PhotoUploadInputProps {
  id: string;
  onChange: (file: File | null) => void;
  initialPreview?: string | null;
  className?: string;
}

export function PhotoUploadInput({
  id,
  onChange,
  initialPreview = null,
  className,
}: PhotoUploadInputProps) {
  const t = useTranslations("auth");
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialPreview);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isBlob, setIsBlob] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(initialPreview);
    setIsBlob(false);
    setFileName(null);
  }, [initialPreview]);

  useEffect(() => {
    return () => {
      if (isBlob && preview) URL.revokeObjectURL(preview);
    };
  }, [isBlob, preview]);

  const handleChange = async (file: File | null) => {
    if (isBlob && preview) URL.revokeObjectURL(preview);

    if (!file) {
      setPreview(initialPreview);
      setFileName(null);
      setIsBlob(false);
      setCropError(null);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setProcessing(true);
    setCropError(null);

    try {
      const prepared = await prepareProfilePhoto(file);
      const url = URL.createObjectURL(prepared);
      setPreview(url);
      setFileName(prepared.name);
      setIsBlob(true);
      onChange(prepared);
    } catch {
      setCropError(t("photoCropFailed"));
      setPreview(initialPreview);
      setFileName(null);
      setIsBlob(false);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          profilePhotoFrameClass,
          "mx-auto aspect-[4/5] w-full max-w-[140px]"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className={profilePhotoImageClass} />
        ) : processing ? (
          <div className="flex h-full min-h-[175px] items-center justify-center">
            <Loader2 className="h-9 w-9 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="flex h-full min-h-[175px] flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
            <Camera className="h-9 w-9 opacity-70" />
            <span className="text-xs leading-snug">{t("photoPlaceholder")}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void handleChange(e.target.files?.[0] ?? null)}
          disabled={processing}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-white/15 bg-white/[0.03]"
            onClick={() => inputRef.current?.click()}
            disabled={processing}
          >
            {processing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {processing ? t("photoProcessing") : t("selectPhoto")}
          </Button>
          {(fileName || (preview && preview !== initialPreview)) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => void handleChange(null)}
              disabled={processing}
            >
              <X className="h-4 w-4" />
              {t("removePhoto")}
            </Button>
          )}
        </div>
        <p className="truncate text-center text-sm text-muted-foreground">
          {fileName ?? t("noPhotoSelected")}
        </p>
        {cropError && (
          <p className="text-center text-sm text-red-400">{cropError}</p>
        )}
        {!cropError && !fileName && !processing && (
          <p className="text-center text-xs text-muted-foreground">
            {t("photoCropHint")}
          </p>
        )}
      </div>
    </div>
  );
}
