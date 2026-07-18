'use client';

import { useEffect, useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { absoluteShareUrl, shareCapability, shareLink, type ShareLinkData } from '@/lib/native/share';

interface ShareButtonProps extends ShareLinkData {
  /** 'header' matches SaveButton's scale; 'toolbar' matches PineExportButton's. */
  variant?: 'header' | 'toolbar';
}

/**
 * Share a page via the system share sheet. Renders ONLY where navigator.share
 * exists (iOS Safari, the native shell, Android Chrome, desktop Safari/Chrome/
 * Edge) - hidden everywhere else per the brief, so clipboard-only browsers see
 * no new affordance. Detection happens client-side after mount, so server and
 * client HTML always match. If the sheet errors mid-share, shareLink falls back
 * to clipboard ('Copied' beat, same as PineExportButton) and, failing even
 * that, a copyable prompt - never a silent no-op.
 */
export function ShareButton({ title, text, url, variant = 'header' }: ShareButtonProps) {
  const [supported, setSupported] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shareCapability() === 'share') setSupported(true);
  }, []);

  if (!supported) return null;

  const onClick = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const outcome = await shareLink({ title, text, url });
    if (outcome === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } else if (outcome === 'failed') {
      window.prompt('Copy the link:', absoluteShareUrl(url));
    }
  };

  const scale =
    variant === 'header'
      ? 'gap-1.5 rounded-md px-2 py-1 text-[11px] tracking-[0.1em]'
      : 'gap-1 rounded px-1.5 py-1 text-[10px] font-semibold tracking-[0.08em]';
  const iconSize = variant === 'header' ? 13 : 12;

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Share ${title}`}
      className={`inline-flex items-center border font-mono uppercase transition ${scale} ${
        copied
          ? 'border-[#2f8f5b] bg-[#0c1f15] text-[#43d18b]'
          : 'border-[#263241] bg-[#0d141c] text-[#8190a0] hover:border-[#3a4754] hover:text-[#eef3f8]'
      }`}
    >
      {copied ? <Check size={iconSize} /> : <Share2 size={iconSize} />}
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}
