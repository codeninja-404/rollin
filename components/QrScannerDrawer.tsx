'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Drawer, Button, Typography, Spin, Space, Slider } from 'antd';
import {
  CameraOutlined,
  CloseOutlined,
  SwapOutlined,
  CheckCircleFilled,
  WarningOutlined,
  EditOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Html5Qrcode, CameraDevice, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const { Text, Title } = Typography;

export interface ScannedData {
  sessionId?: string;
  otp: string;
}

export function parseScannedQr(decodedText: string): ScannedData | null {
  if (!decodedText) return null;
  let text = decodedText.trim();

  // Strip leading/trailing wrapping quotes if present
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  // 1. Try JSON: {"session_id": "...", "otp": "..."} or {"s": "...", "o": "..."}
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const otp = parsed.otp || parsed.code || parsed.OTP || parsed.o;
      const sessionId = parsed.session_id || parsed.sessionId || parsed.s;
      if (otp) {
        return {
          sessionId: sessionId ? String(sessionId) : undefined,
          otp: String(otp).trim(),
        };
      }
    }
  } catch {
    // Not valid JSON
  }

  // 2. Try URL query params: ?session_id=...&otp=... or ?code=...
  try {
    if (text.includes('?') || text.startsWith('http://') || text.startsWith('https://')) {
      const url = new URL(text, 'http://localhost');
      const otp =
        url.searchParams.get('otp') ||
        url.searchParams.get('code') ||
        url.searchParams.get('o');
      const sessionId =
        url.searchParams.get('session_id') ||
        url.searchParams.get('sessionId') ||
        url.searchParams.get('s');
      if (otp) {
        return {
          sessionId: sessionId || undefined,
          otp: otp.trim(),
        };
      }
    }
  } catch {
    // Not valid URL
  }

  // 3. Raw 6-digit numeric OTP match
  const numericMatch = text.match(/\b\d{6}\b/);
  if (numericMatch) {
    return { otp: numericMatch[0] };
  }

  return null;
}

interface QrScannerDrawerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: ScannedData) => void;
  onSwitchToManual?: () => void;
}

export default function QrScannerDrawer({
  open,
  onClose,
  onScan,
  onSwitchToManual,
}: QrScannerDrawerProps) {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedData | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(5);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const containerId = 'rollin-qr-drawer-reader';

  // Pinch-to-zoom refs
  const touchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1);

  const playSuccessFeedback = () => {
    // Web Audio API feedback beep
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {
      // Audio context unsupported or blocked
    }

    // Haptic feedback for mobile devices
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch {
        // ignore
      }
    }
  };

  const applyZoom = useCallback(async (targetZoom: number) => {
    const clamped = Math.max(1, Math.min(maxZoom, Number(targetZoom.toFixed(1))));
    setZoomLevel(clamped);

    // 1. Try hardware camera zoom if supported by the media track
    try {
      const videoEl = document.querySelector<HTMLVideoElement>(`#${containerId} video`);
      if (videoEl && videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        const [track] = stream.getVideoTracks();
        if (track) {
          const caps = (track as any).getCapabilities?.();
          if (caps && 'zoom' in caps) {
            const trackMin = caps.zoom.min || 1;
            const trackMax = caps.zoom.max || 5;
            const actualHwZoom = Math.max(trackMin, Math.min(trackMax, clamped));
            await (track as any).applyConstraints({
              advanced: [{ zoom: actualHwZoom }],
            });
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Hardware zoom constraint not applied, using CSS scale:', err);
    }

    // 2. Optical/digital zoom fallback via CSS transform
    const videoEl = document.querySelector<HTMLVideoElement>(`#${containerId} video`);
    if (videoEl) {
      videoEl.style.transform = `scale(${clamped})`;
      videoEl.style.transformOrigin = 'center center';
      videoEl.style.transition = 'transform 0.15s ease-out';
    }
  }, [maxZoom]);

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      }
    } catch {
      // ignore stop errors
    } finally {
      scannerRef.current = null;
      isStoppingRef.current = false;
    }
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      const parsed = parseScannedQr(decodedText);
      if (!parsed) return;

      playSuccessFeedback();
      setScannedResult(parsed);

      await stopScanner();

      // Brief delay to display verified checkmark before triggering callback
      setTimeout(() => {
        onScan(parsed);
      }, 400);
    },
    [onScan, stopScanner]
  );

  const startScanner = useCallback(
    async (cameraId?: string) => {
      setCameraLoading(true);
      setCameraError(null);
      await stopScanner();

      const element = document.getElementById(containerId);
      if (!element) {
        setCameraLoading(false);
        return;
      }

      try {
        // Instantiate Html5Qrcode with hardware BarcodeDetector and QR only support
        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        scannerRef.current = scanner;

        // Optimized camera configuration with ideal resolution
        const cameraConfig = cameraId
          ? { deviceId: { exact: cameraId } }
          : {
            facingMode: 'environment',
          };

        // Start scanning full frame at 24 FPS for fast, accurate capture
        await scanner.start(
          cameraConfig,
          {
            fps: 24,
            disableFlip: false,
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {
            // normal frame hunt ignore
          }
        );

        setCameraLoading(false);

        // Check hardware zoom limits if available
        setTimeout(() => {
          try {
            const videoEl = document.querySelector<HTMLVideoElement>(`#${containerId} video`);
            if (videoEl && videoEl.srcObject) {
              const stream = videoEl.srcObject as MediaStream;
              const [track] = stream.getVideoTracks();
              if (track) {
                const caps = (track as any).getCapabilities?.();
                if (caps && 'zoom' in caps) {
                  setMaxZoom(Math.min(caps.zoom.max || 5, 8));
                }
              }
            }
          } catch {
            // ignore
          }
        }, 300);
      } catch (err: unknown) {
        console.error('Camera start error:', err);
        setCameraLoading(false);
        const errMsg =
          err instanceof Error
            ? err.message
            : 'Unable to access camera. Please check camera permissions in your browser.';
        setCameraError(errMsg);
      }
    },
    [handleScanSuccess, stopScanner]
  );

  const handleAfterOpenChange = useCallback(
    async (isOpen: boolean) => {
      if (!isOpen) {
        setScannedResult(null);
        setCameraError(null);
        setZoomLevel(1);
        await stopScanner();
        return;
      }

      // Start camera after drawer slide-in is complete
      try {
        setCameraLoading(true);
        const devices = await Html5Qrcode.getCameras();
        setCameras(devices || []);
        if (devices && devices.length > 0) {
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          const selected = backCam || devices[0];
          setCurrentCameraId(selected.id);
          startScanner(selected.id);
        } else {
          startScanner();
        }
      } catch (err) {
        console.warn('Could not enumerate cameras, trying default:', err);
        startScanner();
      }
    },
    [startScanner, stopScanner]
  );

  useEffect(() => {
    if (!open) {
      stopScanner();
    }
  }, [open, stopScanner]);

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setCurrentCameraId(nextCam.id);
    setZoomLevel(1);
    startScanner(nextCam.id);
  };

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleManualClick = async () => {
    await stopScanner();
    onClose();
    if (onSwitchToManual) {
      onSwitchToManual();
    }
  };

  // Touch handlers for native mobile pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
      initialZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchDistanceRef.current;
      const target = Math.max(1, Math.min(maxZoom, initialZoomRef.current * factor));
      applyZoom(target);
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      placement="bottom"
      size="100vh"
      afterOpenChange={handleAfterOpenChange}
      destroyOnClose
      closable={false}
      styles={{
        wrapper: {
          height: '100dvh',
          maxHeight: '100dvh',
        },
        content: {
          height: '100dvh',
          maxHeight: '100dvh',
          borderRadius: 0,
          border: 'none',
          background: '#FFFFFF',
          overflow: 'hidden',
        },
        body: {
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          background: '#FFFFFF',
        },
      }}
    >
      {/* Clean Light Fullscreen Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E4E4E4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFFFFF',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CameraOutlined style={{ color: '#FFFFFF', fontSize: 18 }} />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, color: '#111111', fontSize: 16, fontWeight: 700 }}>
              Scan Attendance QR
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Point camera at the rotating QR code on screen
            </Text>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cameras.length > 1 && (
            <Button
              size="middle"
              icon={<SwapOutlined />}
              onClick={handleSwitchCamera}
              style={{
                borderRadius: 0,
                background: '#FAFAFA',
                borderColor: '#E4E4E4',
                color: '#111111',
              }}
              title="Flip Camera"
            />
          )}
          <Button
            type="text"
            icon={<CloseOutlined style={{ fontSize: 18, color: '#111111' }} />}
            onClick={handleClose}
            style={{
              background: '#FAFAFA',
              border: '1px solid #E4E4E4',
              borderRadius: 0,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        </div>
      </div>

      {/* Live Fullscreen Camera Viewport with Touch Gestures */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          background: '#18181B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        {/* html5-qrcode video element container */}
        <div
          id={containerId}
          style={{
            width: '100%',
            height: '100%',
          }}
        />

        {/* Viewfinder Reticle & Target Corner Guides */}
        {!cameraError && !scannedResult && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Dark Mask Vignette + Target Box */}
            <div
              style={{
                position: 'relative',
                width: 'min(78vw, 290px)',
                height: 'min(78vw, 290px)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
              }}
            >
              {/* Target Corner Guides */}
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  width: 28,
                  height: 28,
                  borderTop: '3px solid #2563EB',
                  borderLeft: '3px solid #2563EB',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 28,
                  height: 28,
                  borderTop: '3px solid #2563EB',
                  borderRight: '3px solid #2563EB',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  left: -2,
                  width: 28,
                  height: 28,
                  borderBottom: '3px solid #2563EB',
                  borderLeft: '3px solid #2563EB',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 28,
                  height: 28,
                  borderBottom: '3px solid #2563EB',
                  borderRight: '3px solid #2563EB',
                }}
              />

              {/* Scanning Laser Beam */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: 2,
                  background: 'linear-gradient(90deg, transparent, #2563EB 50%, transparent)',
                  boxShadow: '0 0 12px #2563EB',
                  animation: 'drawerScanLaser 2.2s ease-in-out infinite',
                }}
              />
            </div>
          </div>
        )}

        {/* Floating Zoom Controls (Pills + Stepper) */}
        {!cameraError && !scannedResult && !cameraLoading && (
          <div
            style={{
              position: 'absolute',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(8px)',
              padding: '6px 14px',
              border: '1px solid #E4E4E4',
              borderRadius: 24,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<ZoomOutOutlined />}
              disabled={zoomLevel <= 1}
              onClick={() => applyZoom(Math.max(1, zoomLevel - 0.5))}
              style={{ color: '#111111' }}
              title="Zoom Out"
            />

            {/* Quick preset buttons: 1x, 2x, 3x */}
            {[1, 2, 3].map((level) => {
              const isActive = Math.abs(zoomLevel - level) < 0.25;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => applyZoom(level)}
                  style={{
                    border: 'none',
                    background: isActive ? '#2563EB' : 'transparent',
                    color: isActive ? '#FFFFFF' : '#111111',
                    borderRadius: 16,
                    padding: '3px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {level}x
                </button>
              );
            })}

            <Button
              type="text"
              size="small"
              icon={<ZoomInOutlined />}
              disabled={zoomLevel >= maxZoom}
              onClick={() => applyZoom(Math.min(maxZoom, zoomLevel + 0.5))}
              style={{ color: '#111111' }}
              title="Zoom In"
            />
          </div>
        )}

        {/* Loading Spinner */}
        {cameraLoading && !cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Spin size="large" />
            <Text style={{ color: '#111111', marginTop: 16, fontSize: 14, fontWeight: 500 }}>
              Connecting camera feed…
            </Text>
          </div>
        )}

        {/* Verified Overlay in Clean Light Theme */}
        {scannedResult && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 40,
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <CheckCircleFilled style={{ color: '#16A34A', fontSize: 40 }} />
            </div>
            <Title level={3} style={{ color: '#111111', margin: '0 0 6px', fontWeight: 700 }}>
              QR Code Detected!
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Verifying and recording attendance…
            </Text>
          </div>
        )}

        {/* Camera Permission / Error Overlay */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#FFFFFF',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              zIndex: 40,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <WarningOutlined style={{ color: '#DC2626', fontSize: 30 }} />
            </div>
            <Title level={4} style={{ color: '#111111', margin: '0 0 8px', fontWeight: 700 }}>
              Camera Access Required
            </Title>
            <Text type="secondary" style={{ fontSize: 13, marginBottom: 24, maxWidth: 320, lineHeight: 1.5 }}>
              {cameraError}
            </Text>
            <Space size={12}>
              <Button
                type="primary"
                onClick={() => startScanner(currentCameraId || undefined)}
                style={{
                  background: '#2563EB',
                  borderColor: '#2563EB',
                  borderRadius: 0,
                  fontWeight: 600,
                  height: 40,
                }}
              >
                Retry Camera
              </Button>
              {onSwitchToManual && (
                <Button
                  onClick={handleManualClick}
                  style={{
                    borderRadius: 0,
                    background: '#FFFFFF',
                    borderColor: '#E4E4E4',
                    color: '#111111',
                    height: 40,
                  }}
                >
                  Enter Code Manually
                </Button>
              )}
            </Space>
          </div>
        )}
      </div>

      {/* Clean Light Bottom Control Bar */}
      <div
        style={{
          padding: '16px 20px',
          background: '#FFFFFF',
          borderTop: '1px solid #E4E4E4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
        }}
      >
        <Text type="secondary" style={{ fontSize: 13 }}>
          Hold camera steady facing the screen
        </Text>

        {onSwitchToManual && (
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={handleManualClick}
            style={{ color: '#2563EB', fontSize: 13, padding: 0, fontWeight: 600 }}
          >
            Enter Code Manually
          </Button>
        )}
      </div>

      <style jsx global>{`
        @keyframes drawerScanLaser {
          0% {
            top: 4px;
            opacity: 0.9;
          }
          50% {
            top: calc(100% - 6px);
            opacity: 1;
          }
          100% {
            top: 4px;
            opacity: 0.9;
          }
        }
        #${containerId} {
          width: 100% !important;
          height: 100% !important;
          position: relative !important;
        }
        #${containerId} video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        #${containerId}__scan_region {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
      `}</style>
    </Drawer>
  );
}
