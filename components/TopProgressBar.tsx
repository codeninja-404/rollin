'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    // Finish navigation
    setNavigating(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleBeforeUnload = () => setNavigating(true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <>
      {navigating && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 99999,
            background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899)',
            boxShadow: '0 0 12px rgba(168, 85, 247, 0.7)',
            animation: 'topProgressSlide 1.2s infinite linear',
          }}
        />
      )}
      <style jsx global>{`
        @keyframes topProgressSlide {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>
  );
}
