import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
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
  const onCaptureRef = useRef(onCapture);
  const previousSampleRef = useRef(null);
  const acceptedFramesRef = useRef([]);
  const captureInFlightRef = useRef(false);
  const candidateSinceRef = useRef(0);

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

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

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
    if (!videoRef.current?.videoWidth || busyRef.current || captureInFlightRef.current) return;
    const video = videoRef.current;
    let acceptedCandidate = null;

    if (automatic) {
      const sample = document.createElement('canvas');
      sample.width = 48;
      sample.height = 27;
      const sampleContext = sample.getContext('2d', { willReadFrequently: true });
      // Judge the declaration guide rather than the whole camera view. Faces,
      // hands and background edges previously made a blurred label look usable.
      sampleContext.drawImage(
        video,
        video.videoWidth * .18,
        video.videoHeight * .16,
        video.videoWidth * .64,
        video.videoHeight * .68,
        0,
        0,
        48,
        27,
      );
      const pixels = sampleContext.getImageData(0, 0, 48, 27).data;
      const signature = [];
      let edges = 0;
      let clipped = 0;
      for (let i = 0; i < pixels.length; i += 16) {
        const luminance = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        signature.push(luminance);
        if (luminance < 18 || luminance > 242) clipped += 1;
      }
      for (let i = 1; i < signature.length; i += 1) {
        edges += Math.abs(signature[i] - signature[i - 1]);
      }
      const previous = previousSampleRef.current;
      const motion = previous
        ? signature.reduce((sum, value, index) => sum + Math.abs(value - previous[index]), 0) / signature.length
        : 99;
      previousSampleRef.current = signature;
      const now = performance.now();
      if (!candidateSinceRef.current || motion > 24) candidateSinceRef.current = now;
      const candidateAge = now - candidateSinceRef.current;
      const detail = edges / signature.length;
      const clippedRatio = clipped / signature.length;
      const matches = acceptedFramesRef.current.map((accepted) => ({
        accepted,
        difference: signature.reduce((sum, value, index) => sum + Math.abs(value - accepted.signature[index]), 0) / signature.length,
      }));
      const closest = matches.sort((a, b) => a.difference - b.difference)[0];
      // Wait for a steady, detailed frame and ignore a side that was already
      // processed. Rotation produces a novel signature and is accepted once it
      // settles, so declarations accumulate without OCR on every video frame.
      const stable = motion <= 12;
      const steadyHandFallback = candidateAge >= 1200 && motion <= 20 && detail >= 8;
      if (detail < 5.5 || clippedRatio > .55 || (!stable && !steadyHandFallback)) return;
      // A matching side is accepted again only if its image detail improved
      // materially; otherwise it would repeat the same expensive OCR request.
      if (closest?.difference < 5 && detail < closest.accepted.detail * 1.18) return;
      acceptedCandidate = { signature, detail };
      candidateSinceRef.current = now;
      console.debug('[Live OCR] frame selected', { detail: detail.toFixed(2), motion: motion.toFixed(2), clippedRatio: clippedRatio.toFixed(2) });
    }

    // Only render/encode the high-resolution crop after the cheap sample has
    // passed. Previously this work ran on every rejected sample.
    const canvas = canvasRef.current;
    const source = automatic
      ? { x: video.videoWidth * .12, y: video.videoHeight * .10, width: video.videoWidth * .76, height: video.videoHeight * .80 }
      : { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight };
    const maxDimension = automatic ? 1400 : 1800;
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    canvas.width = Math.round(source.width * scale);
    canvas.height = Math.round(source.height * scale);
    const context = canvas.getContext('2d');
    context.drawImage(video, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);

    captureInFlightRef.current = true;
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
      if (blob) {
        console.debug('[Live OCR] image captured', { bytes: blob.size, width: canvas.width, height: canvas.height });
        const succeeded = await onCaptureRef.current(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }), automatic);
        if (automatic && succeeded !== false && acceptedCandidate) {
          acceptedFramesRef.current = [
            ...acceptedFramesRef.current.filter((accepted) => {
              const difference = acceptedCandidate.signature.reduce((sum, value, index) => sum + Math.abs(value - accepted.signature[index]), 0) / acceptedCandidate.signature.length;
              return difference >= 5;
            }),
            acceptedCandidate,
          ].slice(-6);
        }
      }
    } finally {
      captureInFlightRef.current = false;
    }
  };

  const toggleContinuous = () => {
    if (continuous) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setContinuous(false);
    } else {
      setContinuous(true);
      previousSampleRef.current = null;
      candidateSinceRef.current = performance.now();
      capture(true);
      intervalRef.current = setInterval(() => capture(true), 300);
    }
  };

  const extractedFields = [
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
  })).filter((item) => item.evidence);

  const detectedCount = extractedFields.length;

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
              <span className="text-[10px] font-mono text-slate-300 bg-slate-900/80 border border-slate-700/60 px-2 py-0.5 rounded-md backdrop-blur-xs">STRUCTURED EXTRACTION</span>
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

      {/* RIGHT COLUMN: Actual extracted package information */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-5 text-slate-200 flex flex-col justify-between min-h-[460px] sm:min-h-[520px] shadow-lg">
        <div>
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
              <ScanLine className="w-4 h-4" />
              <span>EXTRACTED PACKAGE INFORMATION</span>
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />}
            </div>
            {detectedCount > 0 && <span className="text-[11px] font-mono text-slate-400">{detectedCount} fields</span>}
          </div>

          <div className="mt-3.5 space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {!extractedFields.length && <p className="text-sm text-slate-400 leading-relaxed p-3">Point the camera at a declaration panel and choose Live OCR. Detected package values will appear here as each side is scanned.</p>}
            {extractedFields.map(({ label, evidence }) => (
              <div
                key={label}
                className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="text-sm text-white mt-1 break-words">{evidence.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800/80 mt-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Previously extracted values are retained while scanning another side.</span>
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
