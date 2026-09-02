import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ScanLine,
  Zap
} from 'lucide-react';

export default function LiveCameraScanner({ onCapture, ocrData, busy }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const busyRef = useRef(busy);
  const lastFrameRef = useRef(null);

  const [active, setActive] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [error, setError] = useState('');

  const stop = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
    setContinuous(false);
  };

  useEffect(() => stop, []);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560, min: 1280 },
          height: { ideal: 1440, min: 720 },
        },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() || {};
      const advanced = {};
      if (capabilities.focusMode?.includes('continuous')) advanced.focusMode = 'continuous';
      if (capabilities.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous';
      if (Object.keys(advanced).length) {
        await track.applyConstraints({ advanced: [advanced] }).catch(() => {});
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch {
      setError('Camera permission was denied or a high-resolution camera is unavailable. You can still upload photographs.');
    }
  };

  const capture = async (automatic = false) => {
    if (!videoRef.current?.videoWidth || busyRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);

    if (automatic) {
      const sample = document.createElement('canvas');
      sample.width = 48;
      sample.height = 27;
      const sampleContext = sample.getContext('2d', { willReadFrequently: true });
      sampleContext.drawImage(video, 0, 0, 48, 27);
      const pixels = sampleContext.getImageData(0, 0, 48, 27).data;
      const signature = [];
      let edges = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        signature.push((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
      }
      for (let i = 1; i < signature.length; i += 1) {
        edges += Math.abs(signature[i] - signature[i - 1]);
      }
      const previous = lastFrameRef.current;
      const difference = previous
        ? signature.reduce((sum, value, index) => sum + Math.abs(value - previous[index]), 0) / signature.length
        : 99;
      if (edges / signature.length < 6 || difference < 5) return;
      lastFrameRef.current = signature;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (blob) {
      await onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }), automatic);
    }
  };

  const toggleContinuous = () => {
    if (continuous) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setContinuous(false);
    } else {
      setContinuous(true);
      capture(true);
      intervalRef.current = setInterval(() => capture(true), 2500);
    }
  };

  const progress = [
    ['Product', ['product_name', 'commodity_name']],
    ['Manufacturer', ['responsible_party_name']],
    ['Net quantity', ['net_quantity']],
    ['MRP', ['mrp']],
    ['Manufacture date', ['manufacture_pack_import_date']],
    ['Best before / use by', ['best_before_or_use_by']],
    ['Consumer care', ['consumer_care', 'consumer_phone', 'consumer_email']],
    ['Country of origin', ['country_of_origin']],
    ['Batch / lot', ['batch_number']],
    ['Barcode / GTIN', ['barcode']],
  ].map(([label, fields]) => ({
    label,
    evidence: fields.map((field) => ocrData?.fields?.[field]).find(Boolean),
  }));

  const detectedCount = progress.filter((p) => Boolean(p.evidence)).length;

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-stretch">
      {/* LEFT COLUMN: Camera Viewport with Full Aspect-Ratio Fit */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800/80 shadow-lg flex flex-col justify-between min-h-[460px] sm:min-h-[520px]">
        {/* Video Element: Fills 100% of the camera container gracefully without black voids */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 z-10 ${
            active ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* INACTIVE STATE: Clean Inspection Camera Launcher */}
        {!active && (
          <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
            {/* Subtle background technical grid */}
            <div className="absolute inset-0 bg-sidebar-pattern opacity-40 pointer-events-none" />

            <div className="relative z-10 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-sky-400 shadow-inner">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="text-white font-extrabold text-base tracking-tight">
                Live Package Inspection Camera
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Connect your device camera to scan commodity declaration panels, extract statutory text in real-time, and verify compliance.
              </p>
              <button
                onClick={start}
                className="mt-6 inline-flex items-center gap-2 bg-[#0284C7] hover:bg-[#0369A1] active:scale-[0.98] text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-md transition-all duration-200"
              >
                <Camera className="w-4 h-4" />
                <span>Enable Camera Feed</span>
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE STATE: HUD Overlay & Scanning Guides */}
        {active && (
          <>
            {/* Top Status HUD Bar */}
            <div className="relative z-20 p-3.5 sm:p-4 flex items-center justify-between bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent pointer-events-none">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    continuous ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
                  }`}
                />
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-white">
                  {continuous ? 'LIVE OCR • STREAMING SENSOR' : 'LIVE CAMERA FEED'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-300 bg-slate-900/80 border border-slate-700/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
                  {detectedCount}/10 DECLARATIONS
                </span>
              </div>
            </div>

            {/* Central Inspection Reticle / Target Alignment Guide */}
            <div className="relative z-20 flex-1 flex items-center justify-center p-6 pointer-events-none">
              <div className="relative w-full max-w-[340px] aspect-[4/3] rounded-2xl border border-sky-400/40 bg-sky-950/5 shadow-[0_0_24px_rgba(2,132,199,0.15)] flex flex-col justify-between p-3">
                {/* 4 Technical Corner Brackets */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-sky-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-sky-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-sky-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-sky-400" />

                {/* Animated Vertical Laser Sweep Line */}
                <div className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_12px_#38bdf8] animate-vertical-sweep" />

                {/* Central Alignment Tip */}
                <div className="m-auto text-center">
                  <span className="text-[10px] font-mono font-medium tracking-widest text-sky-200/70 bg-slate-950/60 border border-sky-400/30 px-3 py-1 rounded-full backdrop-blur-xs uppercase">
                    [ Align Declaration Panel ]
                  </span>
                </div>
              </div>
            </div>

            {/* Anchored Bottom Control Dock */}
            <div className="relative z-30 p-3.5 sm:p-4 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent flex items-center gap-2.5">
              {/* Primary Capture Button */}
              <button
                onClick={() => capture(false)}
                disabled={busy}
                className="flex-1 bg-white hover:bg-slate-100 active:scale-[0.98] text-slate-950 font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Extracting Declarations…</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-sky-600" />
                    <span>Capture Evidence</span>
                  </>
                )}
              </button>

              {/* Live OCR Mode Toggle */}
              <button
                onClick={toggleContinuous}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-md ${
                  continuous
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                    : 'bg-[#0284C7] hover:bg-[#0369A1] text-white'
                }`}
              >
                {continuous ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
                    <span>Stop Live OCR</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-sky-200" />
                    <span>Live OCR</span>
                  </>
                )}
              </button>

              {/* Turn Off Camera Button */}
              <button
                onClick={stop}
                title="Stop camera"
                className="p-2.5 bg-slate-900/80 hover:bg-rose-900/60 text-slate-300 hover:text-white border border-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <CameraOff className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: Real-Time Declaration Progress Dashboard */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-5 text-slate-200 flex flex-col justify-between min-h-[460px] sm:min-h-[520px] shadow-lg">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
              <ScanLine className="w-4 h-4" />
              <span>LIVE DECLARATION PROGRESS</span>
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />}
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {detectedCount}/10 Verified
            </span>
          </div>

          {/* 10 Declaration Progress Rows */}
          <div className="mt-3.5 space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {progress.map(({ label, evidence }) => (
              <div
                key={label}
                className={`rounded-xl border px-3 py-2 transition-all duration-200 ${
                  evidence
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : 'border-slate-800/80 bg-slate-900/50'
                }`}
              >
                <div className="flex gap-2 items-center">
                  {evidence ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <CircleDashed className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className={`text-xs font-bold ${evidence ? 'text-white' : 'text-slate-400'}`}>
                    {label} {evidence ? 'detected' : 'not yet detected'}
                  </span>
                  {evidence && (
                    <span className="ml-auto text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                      {Math.round(evidence.confidence * 100)}%
                    </span>
                  )}
                </div>
                {evidence && (
                  <p className="text-xs font-mono text-emerald-200/90 mt-1 ml-6 truncate">
                    {evidence.value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer Guidance */}
        <div className="pt-3 border-t border-slate-800/80 mt-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Frame declaration panel and choose Live OCR.</span>
          <span className="font-mono text-slate-400">Rule 6 &middot; LM(PC)</span>
        </div>
      </div>

      {/* Hidden processing canvas for raw frames */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Error Banner */}
      {error && (
        <p className="lg:col-span-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
