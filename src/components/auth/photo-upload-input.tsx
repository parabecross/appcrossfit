"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const handleChange = (file: File | null) => {
    if (isBlob && preview) URL.revokeObjectURL(preview);

    if (!file) {
      setPreview(initialPreview);
      setFileName(null);
      setIsBlob(false);
      onChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    setFileName(file.name);
    setIsBlob(true);
    onChange(file);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-secondary/50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Camera className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handleChange(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {t("selectPhoto")}
            </Button>
            {(fileName || (preview && preview !== initialPreview)) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleChange(null)}
              >
                <X className="h-4 w-4" />
                {t("removePhoto")}
              </Button>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {fileName ?? t("noPhotoSelected")}
          </p>
        </div>
      </div>
    </div>
  );
}
