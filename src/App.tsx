import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { MainEditor } from './components/MainEditor';
import { AudioOutput } from './components/AudioOutput';
import { ConversionHistory } from './components/ConversionHistory';
import { CorpusView } from './components/CorpusView';
import { AboutView } from './components/AboutView';
import { RecordModal } from './components/RecordModal';
import { getAllEntries } from './lib/store';
import { loadManifest } from './lib/tts';
import { playSamples, decodeBlob } from './lib/dsp';
import type { CorpusEntry, SynthResult } from './lib/types';
import {
  getStoredHistory,
  addHistoryEntry,
  removeHistoryEntry,
  performSynthesis,
  mapSpeakerToCore,
} from './services/ttsService';
import type { ConversionHistoryItem } from './data/mockCorpus';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('tts');
  const [inputText, setInputText] = useState('Xin chào Việt Nam');
  const [selectedVoice, setSelectedVoice] = useState<'Nam' | 'Nữ'>('Nam');
  const [isConverting, setIsConverting] = useState(false);
  const [activeResult, setActiveResult] = useState<SynthResult | null>(null);
  const [historyItems, setHistoryItems] = useState<ConversionHistoryItem[]>([]);
  const [realEntries, setRealEntries] = useState<CorpusEntry[]>([]);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<'Nam' | 'Nữ' | null>(null);
  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  } | null>(null);

  // Tải danh sách ngữ liệu từ IndexedDB và manifest ban đầu
  const loadCorpus = useCallback(async () => {
    try {
      const initial = await getAllEntries();
      const existingIds = new Set(initial.map((e) => e.id));
      await loadManifest(existingIds).catch(() => []);
      const entries = await getAllEntries();
      setRealEntries(entries);
    } catch (err) {
      console.error('Lỗi khi nạp ngữ liệu:', err);
    }
  }, []);

  // Tải lịch sử chuyển đổi từ LocalStorage
  const loadHistory = useCallback(() => {
    const list = getStoredHistory();
    setHistoryItems(list);
  }, []);

  useEffect(() => {
    loadCorpus();
    loadHistory();
  }, [loadCorpus, loadHistory]);

  // Xóa thông báo sau 6 giây
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 6000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Xử lý tạo âm thanh (Chuyển văn bản)
  const handleConvert = async () => {
    if (!inputText.trim()) {
      setNotification({
        type: 'warning',
        message: 'Vui lòng nhập văn bản tiếng Việt để chuyển đổi.',
      });
      return;
    }

    setIsConverting(true);
    setNotification(null);

    try {
      const res = await performSynthesis(inputText, selectedVoice, realEntries);

      if (!res.success || !res.result) {
        setNotification({
          type: 'warning',
          message:
            res.error ||
            'Không thể tổng hợp từ văn bản này do chưa có file âm thanh trong ngữ liệu.',
          action: res.suggestedVoice
            ? {
                label: `Chọn Giọng ${res.suggestedVoice}`,
                onClick: () => {
                  setSelectedVoice(res.suggestedVoice!);
                  setNotification(null);
                },
              }
            : undefined,
        });
        setActiveResult(null);
      } else {
        setActiveResult(res.result);
        // Lưu vào lịch sử chuyển đổi
        const newHist = addHistoryEntry(
          inputText,
          selectedVoice,
          res.result.durationSec,
          res.result.wav
        );
        setHistoryItems((prev) => [newHist, ...prev]);

        setNotification({
          type: 'success',
          message: `Đã tạo âm thanh thành công (${res.result.durationSec.toFixed(2)}s)!`,
        });
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Có lỗi xảy ra trong quá trình tổng hợp.',
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Tải file WAV của kết quả hiện tại
  const handleDownloadActiveResult = () => {
    if (!activeResult) return;
    const url = URL.createObjectURL(activeResult.wav);
    const a = document.createElement('a');
    a.href = url;
    const clean = activeResult.text.slice(0, 15).replace(/\s+/g, '_').toLowerCase();
    a.download = `vietvoice_${selectedVoice === 'Nam' ? 'nam' : 'nu'}_${clean || 'audio'}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Xóa mục lịch sử
  const handleDeleteHistory = (id: string) => {
    const updated = removeHistoryEntry(id);
    setHistoryItems(updated);
  };

  // Nghe thử giọng đọc
  const handlePlayPreviewVoice = async (voice: 'Nam' | 'Nữ') => {
    if (isPlayingPreview === voice) {
      setIsPlayingPreview(null);
      return;
    }

    const speakerCore = mapSpeakerToCore(voice);
    const sample = realEntries.find(
      (e) => e.speaker.toLowerCase() === speakerCore.toLowerCase()
    );

    if (sample) {
      try {
        const samples = await decodeBlob(sample.blob);
        setIsPlayingPreview(voice);
        playSamples(samples, 22050, () => setIsPlayingPreview(null));
      } catch {
        setIsPlayingPreview(null);
      }
    } else {
      setIsPlayingPreview(voice);
      setTimeout(() => setIsPlayingPreview(null), 1000);
      setNotification({
        type: 'warning',
        message: `Chưa có bản thu âm cho ${voice}. Bạn có thể vào mục "Ngữ liệu" để thu âm thêm.`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex text-[#20213A]">
      {/* 1. Left Fixed Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        corpusCount={realEntries.length}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 ml-[240px] flex flex-col min-w-0">
        {/* Top Header */}
        <Header currentTab={currentTab} />

        {/* Global Toast Notification */}
        {notification && (
          <div className="fixed top-20 right-8 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
            <div
              className={`p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 max-w-md ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : notification.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              )}
              <span className="flex-1 leading-relaxed">{notification.message}</span>
              {notification.action && (
                <button
                  type="button"
                  onClick={notification.action.onClick}
                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-semibold text-xs whitespace-nowrap transition shadow-xs"
                >
                  {notification.action.label}
                </button>
              )}
              <button
                onClick={() => setNotification(null)}
                className="text-[#85879A] hover:text-[#20213A] p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Workspace Body */}
        <main className="p-8 max-w-6xl w-full mx-auto">
          {currentTab === 'tts' && (
            <div>
              {/* Main Editor Card */}
              <MainEditor
                text={inputText}
                onChangeText={setInputText}
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoice}
                onConvert={handleConvert}
                isConverting={isConverting}
                entries={realEntries}
                onPlayPreviewVoice={handlePlayPreviewVoice}
                isPlayingPreview={isPlayingPreview}
              />

              {/* Audio Result Section */}
              <AudioOutput
                result={activeResult}
                selectedVoice={selectedVoice}
                onDownload={handleDownloadActiveResult}
              />

              {/* Conversion History Section */}
              <ConversionHistory
                items={historyItems}
                onDelete={handleDeleteHistory}
                onRefresh={loadHistory}
                onSelectSampleText={(txt) => {
                  setInputText(txt);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}

          {currentTab === 'corpus' && (
            <CorpusView
              realEntries={realEntries}
              onOpenRecordModal={() => setIsRecordModalOpen(true)}
              onRefresh={loadCorpus}
            />
          )}

          {currentTab === 'about' && <AboutView />}
        </main>
      </div>

      {/* 3. Studio Record Modal */}
      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSaved={() => {
          loadCorpus();
          setNotification({
            type: 'success',
            message: 'Đã lưu bản thu âm mới vào ngữ liệu thành công!',
          });
        }}
        defaultSpeaker={selectedVoice}
      />
    </div>
  );
};

export default App;
