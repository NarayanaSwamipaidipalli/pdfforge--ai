'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  busy?: boolean;
  trapFocus?: boolean;
}

export function Modal({ isOpen, onClose, title, description, children, busy = false, trapFocus = true }: ModalProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const stateRef = useRef({ busy, trapFocus });
  closeRef.current = onClose;
  stateRef.current = { busy, trapFocus };
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (!stateRef.current.trapFocus) return;
      if (event.key === 'Escape' && !stateRef.current.busy) { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);
  if (!isOpen || typeof document === 'undefined') return null;
  return createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-ink-950/60 p-3 backdrop-blur-sm sm:p-6" onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={dialogRef} role="dialog" aria-modal={trapFocus || undefined} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} tabIndex={-1} className="surface relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 text-[var(--foreground)] shadow-2xl outline-none sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id={`${id}-title`} className="text-xl font-semibold tracking-tight">{title}</h2>{description && <p id={`${id}-description`} className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>}</div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog" className="focus-ring -mr-2 -mt-2 rounded-full p-2 text-[var(--muted)] transition-colors hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"><X className="h-5 w-5" aria-hidden /></button>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  </div>, document.body);
}
