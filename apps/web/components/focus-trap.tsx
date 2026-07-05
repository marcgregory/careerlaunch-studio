"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface FocusTrapProps {
  children: ReactNode;
  onClose: () => void;
  /** Optional aria-label for the dialog */
  ariaLabel?: string;
}

/**
 * A focus-trapping dialog wrapper.
 *
 * - Traps Tab/Shift+Tab within the container
 * - Closes on Escape
 * - Restores focus to the previously-focused element on unmount
 */
export function FocusTrap({ children, onClose, ariaLabel }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the trap
    const focusableSelector = "button, a, input, textarea, select, [tabindex]:not([tabindex='-1'])";
    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#123c3a]/55 px-4 py-8 backdrop-blur-sm"
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
