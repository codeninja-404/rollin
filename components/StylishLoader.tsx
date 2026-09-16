'use client';

import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

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
  // Dimensions based on size
  const ringSize = size === 'small' ? 36 : size === 'large' ? 64 : 48;
  const strokeWidth = size === 'small' ? 3 : 3.5;
  const defaultMinHeight = fullScreen ? '100vh' : (minHeight ?? 'calc(75vh - 80px)');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: defaultMinHeight,
        width: '100%',
        padding: size === 'small' ? '20px 12px' : '40px 16px',
        margin: '0 auto',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {/* Central Spinner Container */}
      <div
        style={{
          position: 'relative',
          width: ringSize,
          height: ringSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: size === 'small' ? 12 : 18,
        }}
      >
        {/* Ambient background glow */}
        <div
          style={{
            position: 'absolute',
            width: ringSize * 1.5,
            height: ringSize * 1.5,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%)',
            filter: 'blur(10px)',
            animation: 'loaderAmbientPulse 2.5s ease-in-out infinite alternate',
          }}
        />

        {/* Outer subtle track ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${strokeWidth}px solid rgba(255, 255, 255, 0.08)`,
          }}
        />

        {/* Spinning Gradient Arc */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${strokeWidth}px solid transparent`,
            borderTopColor: '#6366f1',
            borderRightColor: '#a855f7',
            animation: 'loaderSmoothSpin 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
            boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
          }}
        />

        {/* Counter-spinning inner accent */}
        {size !== 'small' && (
          <div
            style={{
              position: 'absolute',
              width: ringSize * 0.55,
              height: ringSize * 0.55,
              borderRadius: '50%',
              border: `2px solid transparent`,
              borderBottomColor: '#38bdf8',
              borderLeftColor: '#818cf8',
              opacity: 0.8,
              animation: 'loaderSmoothSpinReverse 1.4s linear infinite',
            }}
          />
        )}

        {/* Center glowing core dot */}
        <div
          style={{
            width: size === 'small' ? 6 : 8,
            height: size === 'small' ? 6 : 8,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
            boxShadow: '0 0 10px rgba(129, 140, 248, 0.9)',
            animation: 'loaderCorePulse 1.8s ease-in-out infinite',
          }}
        />
      </div>

      {/* Message Label */}
      {message && (
        <Text
          style={{
            color: 'rgba(255, 255, 255, 0.92)',
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

      {/* Optional Submessage */}
      {submessage && (
        <Text
          type="secondary"
          style={{
            fontSize: 12,
            marginTop: 6,
            color: 'rgba(255, 255, 255, 0.45)',
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
