import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, CircleDashed, Loader2, ScanLine } from 'lucide-react';

export default function LiveCameraScanner({ onCapture, ocrData, busy }) {
  const videoRef = useRef(null); const canvasRef = useRef(null); const streamRef = useRef(null); const intervalRef = useRef(null); const busyRef = useRef(busy); const lastFrameRef = useRef(null);
  const [active, setActive] = useState(false); const [continuous, setContinuous] = useState(false); const [error, setError] = useState('');
  const stop = () => { clearInterval(intervalRef.current); intervalRef.current = null; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setActive(false); setContinuous(false); };
  useEffect(() => stop, []);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  const start = async () => { setError(''); try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560, min: 1280 }, height: { ideal: 1440, min: 720 } }, audio: false }); const track = stream.getVideoTracks()[0]; const capabilities = track?.getCapabilities?.() || {}; const advanced = {}; if (capabilities.focusMode?.includes('continuous')) advanced.focusMode = 'continuous'; if (capabilities.exposureMode?.includes('continuous')) advanced.exposureMode = 'continuous'; if (Object.keys(advanced).length) await track.applyConstraints({ advanced: [advanced] }).catch(() => {}); streamRef.current = stream; videoRef.current.srcObject = stream; await videoRef.current.play(); setActive(true); } catch { setError('Camera permission was denied or a high-resolution camera is unavailable. You can still upload photographs.'); } };
  const capture = async (automatic = false) => {
    if (!videoRef.current?.videoWidth || busyRef.current) return;
    const video = videoRef.current, canvas = canvasRef.current; canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext('2d'); context.drawImage(video, 0, 0);
    if (automatic) {
      const sample = document.createElement('canvas'); sample.width = 48; sample.height = 27;
      const sampleContext = sample.getContext('2d', { willReadFrequently: true }); sampleContext.drawImage(video, 0, 0, 48, 27);
      const pixels = sampleContext.getImageData(0, 0, 48, 27).data; const signature = []; let edges = 0;
      for (let i = 0; i < pixels.length; i += 16) signature.push((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
      for (let i = 1; i < signature.length; i += 1) edges += Math.abs(signature[i] - signature[i - 1]);
      const previous = lastFrameRef.current; const difference = previous ? signature.reduce((sum, value, index) => sum + Math.abs(value - previous[index]), 0) / signature.length : 99;
      if (edges / signature.length < 6 || difference < 5) return;
      lastFrameRef.current = signature;
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .88));
    if (blob) await onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }), automatic);
  };
  const toggleContinuous = () => { if (continuous) { clearInterval(intervalRef.current); intervalRef.current = null; setContinuous(false); } else { setContinuous(true); capture(true); intervalRef.current = setInterval(() => capture(true), 2500); } };
  const progress = [
    ['Product', ['product_name', 'commodity_name']], ['Manufacturer', ['responsible_party_name']], ['Net quantity', ['net_quantity']], ['MRP', ['mrp']],
    ['Manufacture date', ['manufacture_pack_import_date']], ['Best before / use by', ['best_before_or_use_by']], ['Consumer care', ['consumer_care', 'consumer_phone', 'consumer_email']],
    ['Country of origin', ['country_of_origin']], ['Batch / lot', ['batch_number']], ['Barcode / GTIN', ['barcode']],
  ].map(([label, fields]) => ({ label, evidence: fields.map((field) => ocrData?.fields?.[field]).find(Boolean) }));
  return <div className="grid lg:grid-cols-2 gap-4"><div className="relative rounded-2xl overflow-hidden bg-slate-950 min-h-72"><video ref={videoRef} playsInline muted className={`w-full h-72 object-cover ${active ? '' : 'hidden'}`} />{!active && <div className="h-72 grid place-items-center text-center p-8"><div><Camera className="w-10 h-10 text-slate-500 mx-auto" /><p className="text-white font-bold mt-3">Live package camera</p><p className="text-xs text-slate-400 mt-2">Use the rear camera and keep the declaration panel steady.</p><button onClick={start} className="mt-5 bg-sky-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold">Enable camera</button></div></div>}{active && <><div className="pointer-events-none absolute inset-5 border border-sky-400/60 rounded-xl"><div className="absolute left-0 right-0 h-px bg-sky-300 shadow-[0_0_12px_#38bdf8] animate-vertical-sweep" /></div><div className="absolute bottom-3 left-3 right-3 flex gap-2"><button onClick={() => capture(false)} disabled={busy} className="flex-1 bg-white text-slate-950 rounded-xl py-2.5 text-sm font-bold">{busy ? 'Extracting…' : 'Capture evidence'}</button><button onClick={toggleContinuous} className={`px-3 rounded-xl text-sm font-bold ${continuous ? 'bg-amber-400 text-slate-950' : 'bg-sky-600 text-white'}`}>{continuous ? 'Stop live OCR' : 'Live OCR'}</button><button onClick={stop} className="p-3 bg-slate-900/80 text-white rounded-xl"><CameraOff className="w-4 h-4" /></button></div></>}</div><div className="rounded-2xl bg-slate-950 p-5 text-slate-200 min-h-72"><div className="flex items-center gap-2 text-xs font-bold text-sky-400"><ScanLine className="w-4 h-4" />LIVE DECLARATION PROGRESS {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}</div><div className="mt-4 space-y-3">{progress.map(({ label, evidence }) => <div key={label} className={`rounded-xl border px-3 py-2.5 ${evidence ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/60'}`}><div className="flex gap-2 items-center">{evidence ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <CircleDashed className="w-4 h-4 text-slate-600" />}<span className="text-xs font-bold">{label} {evidence ? 'detected' : 'not yet detected'}</span>{evidence && <span className="ml-auto text-[10px] text-emerald-400">{Math.round(evidence.confidence * 100)}%</span>}</div>{evidence && <p className="text-xs text-slate-400 mt-1 ml-6 truncate">{evidence.value}</p>}</div>)}</div>{!ocrData && <p className="text-xs text-slate-500 mt-4">Frame a declaration panel and choose Live OCR. Structured fields update after each stable frame.</p>}</div><canvas ref={canvasRef} className="hidden" />{error && <p className="lg:col-span-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}</div>;
}
