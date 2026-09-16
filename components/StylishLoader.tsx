'use client';

import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

export function OrbitalSpinner({ size = 44 }: { size?: number }) {
  const strokeWidth = size <= 32 ? 2.5 : 3.5;
  return (
    <div
      className="orbital-spinner"
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
      }}
    >
      {/* Ambient background glow */}
      <div
        className="orbital-ring"
        style={{
          position: 'absolute',
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, rgba(139, 92, 246, 0.1) 50%, transparent 70%)',
          filter: 'blur(8px)',
          animation: 'loaderAmbientPulse 2.5s ease-in-out infinite alternate',
        }}
      />

      {/* Outer subtle track ring */}
      <div
        className="orbital-ring"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `${strokeWidth}px solid rgba(0, 0, 0, 0.08)`,
        }}
      />

      {/* Spinning Gradient Arc */}
      <div
        className="orbital-ring"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `${strokeWidth}px solid transparent`,
          borderTopColor: '#6366f1',
          borderRightColor: '#a855f7',
          animation: 'loaderSmoothSpin 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
          boxShadow: '0 0 16px rgba(99, 102, 241, 0.45)',
        }}
      />

      {/* Counter-spinning inner accent */}
      {size > 28 && (
        <div
          className="orbital-ring"
          style={{
            position: 'absolute',
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: '50%',
            border: '2px solid transparent',
            borderBottomColor: '#38bdf8',
            borderLeftColor: '#818cf8',
            opacity: 0.85,
            animation: 'loaderSmoothSpinReverse 1.4s linear infinite',
          }}
        />
      )}

      {/* Center glowing core dot */}
      <div
        className="orbital-ring"
        style={{
          width: size <= 32 ? 6 : 8,
          height: size <= 32 ? 6 : 8,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
          boxShadow: '0 0 10px rgba(129, 140, 248, 0.9)',
          animation: 'loaderCorePulse 1.8s ease-in-out infinite',
        }}
      />
    </div>
  );
}

interface StylishLoaderProps {
  message?: string;
  submessage?: string;
  fullScreen?: boolean;
  minHeight?: number | string;
  size?: 'small' | 'default' | 'large';
}

export default function StylishLoader({
  message = 'Loading...',
  submessage,
  fullScreen = false,
  minHeight,
  size = 'default',
}: StylishLoaderProps) {
  const ringSize = size === 'small' ? 32 : size === 'large' ? 60 : 44;
  const defaultMinHeight = fullScreen ? '100vh' : (minHeight ?? 'calc(70vh - 40px)');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: defaultMinHeight,
        width: '100%',
        padding: size === 'small' ? '20px 12px' : '48px 24px',
        margin: '0 auto',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <div style={{ marginBottom: size === 'small' ? 12 : 18 }}>
        <OrbitalSpinner size={ringSize} />
      </div>

      {message && (
        <Text
          style={{
            color: '#111111',
            fontWeight: 600,
            fontSize: size === 'small' ? 13 : 14,
            letterSpacing: '0.015em',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {message}
        </Text>
      )}

      {submessage && (
        <Text
          type="secondary"
          style={{
            fontSize: 12,
            marginTop: 6,
            color: '#6B6B6B',
            textAlign: 'center',
            maxWidth: 340,
            lineHeight: 1.4,
          }}
        >
          {submessage}
        </Text>
      )}

      <style jsx global>{`
        @keyframes loaderSmoothSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes loaderSmoothSpinReverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }
        @keyframes loaderAmbientPulse {
          0% {
            opacity: 0.4;
            transform: scale(0.9);
          }
          100% {
            opacity: 0.85;
            transform: scale(1.15);
          }
        }
        @keyframes loaderCorePulse {
          0%, 100% {
            transform: scale(0.85);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
