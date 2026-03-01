"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    }
    setOpen(true);
  };

  return (
    <span
      ref={ref}
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className="ml-1 inline-flex items-center text-gray-500 hover:text-gray-300 transition-colors cursor-help"
        aria-label="More info"
      >
        <Info className="h-3 w-3" />
      </span>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="fixed w-60 rounded-xl border border-white/[0.12] bg-[#0c1220]/95 backdrop-blur-2xl px-3 py-2 text-xs text-gray-300 shadow-2xl shadow-black/60 text-left font-normal normal-case tracking-normal leading-relaxed pointer-events-none"
                style={{
                  left: coords.x,
                  top: coords.y,
                  transform: "translateX(-50%)",
                  zIndex: 99999,
                }}
              >
                {text}
                <span
                  className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#0c1220]"
                />
              </motion.span>
            )}
          </AnimatePresence>,
          document.body
        )}
    </span>
  );
}
