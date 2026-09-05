'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useI18n } from '@/components/providers/i18n-provider';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, api } from '@/lib/client/api';
import { cn } from '@/lib/utils';

export type UploadedImage = { url: string; key: string } | null;

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Image picker.
 *
 * Client-side checks are for instant feedback only; the server re-detects the
 * real file type from its magic bytes and re-encodes the image, so a crafted
 * upload cannot get past by lying about its extension or MIME type.
 */
export function ImageUpload({
  value,
  onChange,
  kind = 'duel',
  label,
  className,
}: {
  value: UploadedImage;
  onChange: (image: UploadedImage) => void;
  kind?: 'duel' | 'avatar';
  label: string;
  className?: string;
}) {
  const { t, errorMessage } = useI18n();
  const { show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      show(errorMessage('FILE_TOO_LARGE'), 'error');
      return;
    }
    if (!ACCEPT.split(',').includes(file.type)) {
      show(errorMessage('UNSUPPORTED_FILE_TYPE'), 'error');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);

      const { upload } = await api<{ upload: { url: string; key: string } }>('/api/uploads', {
        method: 'POST',
        body: form,
      });
      onChange(upload);
    } catch (error) {
      show(
        error instanceof ApiClientError ? errorMessage(error.code, error.message) : errorMessage(undefined),
        'error',
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {value ? (
        <div className="border-border relative aspect-square overflow-hidden rounded-xl border">
          <Image src={value.url} alt={label} fill sizes="200px" className="object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t.create.remove}
            className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'border-border text-fg-subtle hover:border-accent hover:text-accent flex aspect-square w-full',
            'flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed',
            'transition-colors disabled:cursor-wait',
          )}
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          <span className="px-2 text-center text-xs font-semibold">
            {uploading ? t.create.uploading : label}
          </span>
        </button>
      )}
    </div>
  );
}
