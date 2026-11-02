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
import { NotificationModal, type NotificationModalData } from './components/NotificationModal';

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
  const [notificationModal, setNotificationModal] = useState<NotificationModalData | null>(null);
  const [recordInitialWord, setRecordInitialWord] = useState('');

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

  // Xử lý tạo âm thanh (Chuyển văn bản)
  const handleConvert = async () => {
    if (!inputText.trim()) {
      setNotificationModal({
        type: 'warning',
        title: 'Chưa nhập văn bản',
        message: 'Vui lòng nhập văn bản tiếng Việt bạn muốn chuyển thành âm thanh.',
        confirmText: 'Đã hiểu',
      });
      return;
    }

    setIsConverting(true);

    try {
      const res = await performSynthesis(inputText, selectedVoice, realEntries);

      if (!res.success || !res.result) {
        const isMissing = Boolean(res.missingTokens && res.missingTokens.length > 0 && !res.suggestedVoice);
        setNotificationModal({
          type: 'warning',
          title: res.suggestedVoice
            ? 'Ràng buộc giọng đọc'
            : isMissing
            ? 'Từ chưa có bản ghi âm'
            : 'Chưa thể chuyển đổi',
          message:
            res.error ||
            'Không thể tổng hợp từ văn bản này do chưa có file âm thanh trong ngữ liệu.',
          action: res.suggestedVoice
            ? {
                label: `Chọn Giọng ${res.suggestedVoice} ngay`,
                onClick: () => {
                  setSelectedVoice(res.suggestedVoice!);
                },
              }
            : isMissing && res.missingTokens && res.missingTokens.length > 0
            ? {
                label: `Thu âm từ "${res.missingTokens[0]}" ngay`,
                onClick: () => {
                  setRecordInitialWord(res.missingTokens![0]);
                  setIsRecordModalOpen(true);
                },
              }
            : undefined,
          confirmText: 'Đóng',
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

        setNotificationModal({
          type: 'success',
          title: 'Chuyển đổi thành công!',
          message: `Đã tạo âm thanh thành công (${res.result.durationSec.toFixed(2)} giây) bằng Giọng ${selectedVoice}!\nBạn có thể nghe thử bằng trình phát âm thanh hoặc tải file WAV về máy bên dưới.`,
          confirmText: 'Tuyệt vời',
        });
      }
    } catch (err: any) {
      setNotificationModal({
        type: 'error',
        title: 'Lỗi tổng hợp âm thanh',
        message: err?.message || 'Có lỗi xảy ra trong quá trình tổng hợp.',
        confirmText: 'Đóng',
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

  // Xóa mục lịch sử với popup xác nhận
  const handleDeleteHistory = (id: string) => {
    setNotificationModal({
      type: 'confirm',
      title: 'Xóa lịch sử chuyển đổi',
      message: 'Bạn có chắc chắn muốn xóa mục này khỏi danh sách lịch sử chuyển đổi không?',
      confirmText: 'Xóa ngay',
      cancelText: 'Hủy bỏ',
      onConfirm: () => {
        const updated = removeHistoryEntry(id);
        setHistoryItems(updated);
      },
    });
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
      setNotificationModal({
        type: 'warning',
        title: 'Chưa có bản thu âm',
        message: `Chưa có bản thu âm cho Giọng ${voice}. Bạn có thể vào mục "Ngữ liệu" để thu âm thêm.`,
        confirmText: 'Đã hiểu',
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

        {/* Global Notification Modal Popup */}
        <NotificationModal
          data={notificationModal}
          onClose={() => setNotificationModal(null)}
        />

        {/* Workspace Body */}
        <main className="p-6 md:p-8 max-w-[1400px] w-full mx-auto">
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
                onOpenRecordModal={(word) => {
                  setRecordInitialWord(word || '');
                  setIsRecordModalOpen(true);
                }}
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
                onShowNotification={setNotificationModal}
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
              onOpenRecordModal={() => {
                setRecordInitialWord('');
                setIsRecordModalOpen(true);
              }}
              onRefresh={loadCorpus}
              onShowNotification={setNotificationModal}
            />
          )}

          {currentTab === 'about' && <AboutView />}
        </main>
      </div>

      {/* 3. Studio Record Modal */}
      <RecordModal
        isOpen={isRecordModalOpen}
        initialWord={recordInitialWord}
        onClose={() => setIsRecordModalOpen(false)}
        onSaved={() => {
          loadCorpus();
          setNotificationModal({
            type: 'success',
            title: 'Lưu ngữ liệu thành công!',
            message: 'Đã lưu bản thu âm mới vào ngữ liệu thành công. Giờ đây bạn có thể sử dụng từ này trong chuyển văn bản thành âm thanh.',
            confirmText: 'Đã hiểu',
          });
        }}
        defaultSpeaker={selectedVoice}
      />
    </div>
  );
};

export default App;
