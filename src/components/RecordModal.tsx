import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Mic, Square, Play, Save, AlertCircle, CheckCircle2, Volume2, Sparkles } from 'lucide-react';
import { encodeVnFilename, decodeVnWord } from '../lib/vniCodec';
import { addToCorpus } from '../lib/tts';
import { playSamples, decodeBlob, encodeWav, SR } from '../lib/dsp';
import type { CorpusEntry } from '../lib/types';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultSpeaker?: 'Nam' | 'Nữ';
  initialWord?: string;
}

export const RecordModal: React.FC<RecordModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  defaultSpeaker = 'Nam',
  initialWord = '',
}) => {
  const [wordInput, setWordInput] = useState(initialWord);
  const [speaker, setSpeaker] = useState<'Nam' | 'Nữ'>(defaultSpeaker);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopRecordingCleanup = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setWordInput(initialWord || '');
      setSpeaker(defaultSpeaker);
      setAudioBlob(null);
      setAudioUrl(null);
      setErrorMsg('');
      setIsRecording(false);
    }
  }, [isOpen, initialWord, defaultSpeaker]);

  // Clean up
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl, stopRecordingCleanup]);

  if (!isOpen) return null;

  // Real-time VNI filename preview
  const encodedName = wordInput.trim() ? encodeVnFilename(wordInput.trim()) : '';

  const startRecording = async () => {
    if (!wordInput.trim()) {
      setErrorMsg('Bắt buộc phải nhập từ tiếng Việt cần thu âm trước khi bắt đầu ghi âm!');
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // Audio Level Visualizer (VU meter)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const rawBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          stopRecordingCleanup();

          // Chuyển đổi âm thanh sang chuẩn WAV 44.1 kHz PCM Lossless thật 100%
          const samples = await decodeBlob(rawBlob);
          const wavBlob = encodeWav(samples, SR);
          setAudioBlob(wavBlob);
          const url = URL.createObjectURL(wavBlob);
          setAudioUrl(url);
        } catch (convErr) {
          console.warn('Lỗi chuyển đổi sang WAV:', convErr);
          const fallbackBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          stopRecordingCleanup();
          setAudioBlob(fallbackBlob);
          setAudioUrl(URL.createObjectURL(fallbackBlob));
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Không thể truy cập Microphone. Vui lòng cấp quyền ghi âm cho trình duyệt.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.warn('Lỗi khi dừng recorder:', e);
      }
    }
  };

  const handlePlayPreview = () => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play();
  };

  const handleSaveToCorpus = async () => {
    if (!wordInput.trim()) {
      setErrorMsg('Vui lòng nhập từ tiếng Việt cần thu âm.');
      return;
    }
    if (!audioBlob) {
      setErrorMsg('Vui lòng ghi âm từ trước khi lưu vào ngữ liệu.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      const cleanWord = wordInput.trim().toLowerCase();
      const coreSpeaker = speaker === 'Nam' ? 'nam' : 'nu';

      // 1. Lưu vào IndexedDB trình duyệt
      await addToCorpus(audioBlob, cleanWord, coreSpeaker, 'record');

      // 2. Tự động đồng bộ lên Database MongoDB Atlas & Cloudinary
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        const audioBase64 = await base64Promise;

        const res = await fetch('/api/audio/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: cleanWord,
            speaker,
            code: encodeVnFilename(cleanWord).replace(/\.wav$/, ''),
            audioBase64,
            duration: audioBlob.size > 0 ? audioBlob.size / (SR * 2) : 0.45,
          }),
        });
        if (res.ok) {
          console.log(`[VietVoice] Đã lưu thành công từ "${cleanWord}" lên MongoDB Atlas & Cloudinary!`);
        } else {
          console.warn('Backend upload response status:', res.status);
        }
      } catch (syncErr) {
        console.warn('Không thể đồng bộ lên MongoDB Atlas server:', syncErr);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu từ vào ngữ liệu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E8E8F0] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-[#E8E8F0] flex items-center justify-center bg-[#FAFAFD]">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#6255CF]/10 text-[#6255CF] flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#20213A]">Phòng thu âm từ mới</h3>
            </div>
            <p className="text-[11px] text-[#85879A] mt-0.5">Ghi âm và đặt tên chuẩn mã hóa VNI</p>
          </div>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#85879A] hover:text-[#20213A] hover:bg-[#F0F2F9] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Voice selection */}
          <div>
            <label className="block text-xs font-bold text-[#555870] mb-2 uppercase tracking-wider">
              1. Chọn giọng người thu
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSpeaker('Nam')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${speaker === 'Nam'
                  ? 'border-[#5578D8] bg-[#5578D8]/5 text-[#5578D8] font-bold shadow-xs'
                  : 'border-[#E8E8F0] text-[#555870] hover:bg-[#FAFBFD]'
                  }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#5578D8]" />
                <span className="text-xs">Nam (Giọng nam)</span>
              </button>

              <button
                type="button"
                onClick={() => setSpeaker('Nữ')}
                className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 ${speaker === 'Nữ'
                  ? 'border-[#B16BC1] bg-[#B16BC1]/5 text-[#B16BC1] font-bold shadow-xs'
                  : 'border-[#E8E8F0] text-[#555870] hover:bg-[#FAFBFD]'
                  }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#B16BC1]" />
                <span className="text-xs">Nữ (Giọng nữ)</span>
              </button>
            </div>
          </div>

          {/* Word Input & VNI Code Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#555870] uppercase tracking-wider">
                2. Từ tiếng Việt cần thu âm <span className="text-red-500">*</span>
              </label>
              {!wordInput.trim() && (
                <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                  (Bắt buộc nhập trước khi thu âm)
                </span>
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={wordInput}
              disabled={isRecording}
              onChange={(e) => {
                setWordInput(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Ví dụ: mừng, xin chào, bác, cảng, việt nam..."
              className={`w-full px-4 py-2.5 text-sm rounded-xl border focus:outline-none transition ${!wordInput.trim() && errorMsg
                ? 'border-red-400 bg-red-50/20 focus:border-red-500'
                : 'border-[#E8E8F0] focus:border-[#6255CF] text-[#20213A]'
                } ${isRecording ? 'bg-slate-100 cursor-not-allowed opacity-75' : ''}`}
            />

            {/* VNI Filename Preview */}
            {encodedName && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#F7F8FD] border border-[#E4E6F5] text-xs flex items-center justify-between">
                <span className="text-[#686B84]">Tên file theo quy ước VNI:</span>
                <span className="font-mono font-bold text-[#6255CF] bg-white px-2 py-0.5 rounded border border-[#DCDFF2]">
                  {encodedName}
                </span>
              </div>
            )}
          </div>

          {/* Recording Controls */}
          <div>
            <label className="block text-xs font-bold text-[#555870] mb-2 uppercase tracking-wider">
              3. Thu âm micro
            </label>

            {/* VU Meter */}
            <div className="h-2 rounded-full bg-[#EAEBF4] overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 transition-all duration-75"
                style={{ width: `${isRecording ? audioLevel : 0}%` }}
              />
            </div>

            <div className="flex flex-col items-center justify-center gap-2 py-2">
              <div className="flex items-center gap-4">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={!wordInput.trim()}
                    className={`px-5 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${!wordInput.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                      : 'bg-[#6255CF] hover:bg-[#5144BD] text-white shadow-md shadow-[#6255CF]/20 active:scale-95 cursor-pointer'
                      }`}
                    title={!wordInput.trim() ? 'Vui lòng nhập từ tiếng Việt cần thu âm ở mục 2 trước' : 'Bắt đầu thu âm'}
                  >
                    <Mic className="w-4 h-4" />
                    <span>Bắt đầu thu âm</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-2 animate-pulse shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Dừng thu âm</span>
                  </button>
                )}

                {audioBlob && !isRecording && (
                  <button
                    type="button"
                    onClick={handlePlayPreview}
                    className="px-4 py-3 rounded-xl border border-[#E8E8F0] hover:bg-[#F7F8FC] text-xs font-semibold text-[#20213A] flex items-center gap-2 transition cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>Nghe lại ({audioBlob.size > 0 ? (audioBlob.size / 1024).toFixed(1) + ' KB' : ''})</span>
                  </button>
                )}
              </div>

              {!wordInput.trim() && !isRecording && (
                <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1 text-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Vui lòng nhập từ tiếng Việt cần thu âm ở mục 2 trước để mở khóa micro.</span>
                </p>
              )}
            </div>

            {audioBlob && !isRecording && (
              <p className="text-center text-[11px] text-emerald-600 font-medium mt-1">
                ✓ Đã thu xong âm thanh. Nhấn "Lưu vào ngữ liệu" để đưa vào hệ thống.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E8E8F0] bg-[#FAFAFD] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#555870] hover:text-[#20213A] transition"
          >
            Hủy bỏ
          </button>

          <button
            onClick={handleSaveToCorpus}
            disabled={isSaving || !audioBlob || !wordInput.trim()}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition ${isSaving || !audioBlob || !wordInput.trim()
              ? 'bg-[#B0B2C5] cursor-not-allowed opacity-75'
              : 'bg-[#6255CF] hover:bg-[#5144BD] shadow-sm'
              }`}
          >
            {isSaving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Lưu vào ngữ liệu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
