import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { MainEditor } from './components/MainEditor';
import { ConversionHistory } from './components/ConversionHistory';
import { CorpusView } from './components/CorpusView';
import { AboutView } from './components/AboutView';
import { RecordModal } from './components/RecordModal';
import { BottomAudioPlayer, type PlayerTrack } from './components/BottomAudioPlayer';
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
  const [inputText, setInputText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<'Nam' | 'Nữ'>('Nam');
  const [isConverting, setIsConverting] = useState(false);
  const [activeResult, setActiveResult] = useState<SynthResult | null>(null);
  const [historyItems, setHistoryItems] = useState<ConversionHistoryItem[]>([]);
  const [realEntries, setRealEntries] = useState<CorpusEntry[]>([]);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<'Nam' | 'Nữ' | null>(null);
  const [notificationModal, setNotificationModal] = useState<NotificationModalData | null>(null);
  const [recordInitialWord, setRecordInitialWord] = useState('');

  // Track âm thanh đang phát ở thanh player cố định cuối trang
  const [playerTrack, setPlayerTrack] = useState<PlayerTrack | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

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
    if (list && list.length > 0) {
      setPlayerTrack({
        id: list[0].id,
        text: list[0].text,
        speaker: list[0].speaker,
        durationSec: list[0].duration || 1.85,
        audioBlob: list[0].audioBlob,
        filename: list[0].filename,
      });
      setIsPlayerOpen(true);
    } else {
      setPlayerTrack(null);
      setIsPlayerOpen(false);
    }
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

        // Cập nhật và phát ngay ở thanh player cố định cuối trang
        setPlayerTrack({
          id: newHist.id,
          text: inputText,
          speaker: selectedVoice,
          durationSec: res.result.durationSec,
          audioBlob: res.result.wav,
          filename: newHist.filename,
        });
        setIsPlayerOpen(true);

        setNotificationModal({
          type: 'success',
          title: 'Chuyển đổi thành công!',
          message: `Đã tạo âm thanh thành công (${res.result.durationSec.toFixed(2)} giây) bằng Giọng ${selectedVoice}!\nBạn có thể nghe phát âm thanh tại thanh điều khiển cố định bên dưới.`,
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

  // Tải file WAV từ player track
  const handleDownloadPlayerTrack = (trk: PlayerTrack) => {
    if (trk.audioBlob) {
      const url = URL.createObjectURL(trk.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = trk.filename || `vietvoice_${trk.speaker === 'Nam' ? 'nam' : 'nu'}_audio.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const dummy = new Blob(['RIFF....WAVEfmt '], { type: 'audio/wav' });
      const url = URL.createObjectURL(dummy);
      const a = document.createElement('a');
      a.href = url;
      a.download = trk.filename || `vietvoice_${trk.speaker === 'Nam' ? 'nam' : 'nu'}_audio.wav`;
      a.click();
      URL.revokeObjectURL(url);
    }
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
        if (playerTrack?.id === id) {
          if (updated.length > 0) {
            setPlayerTrack({
              id: updated[0].id,
              text: updated[0].text,
              speaker: updated[0].speaker,
              durationSec: updated[0].duration,
              audioBlob: updated[0].audioBlob,
              filename: updated[0].filename,
            });
          } else {
            setPlayerTrack(null);
          }
        }
      },
    });
  };

  // Nghe thử giọng mẫu của Nam hoặc Nữ
  const handlePlayPreviewVoice = async (voice: 'Nam' | 'Nữ') => {
    if (isPlayingPreview) return;
    setIsPlayingPreview(voice);

    const targetCore = mapSpeakerToCore(voice);
    const sampleEntry = realEntries.find(
      (e) => e.speaker === targetCore && e.blob
    );

    if (sampleEntry && sampleEntry.blob) {
      try {
        const samples = await decodeBlob(sampleEntry.blob);
        playSamples(samples, 22050, () => {
          setIsPlayingPreview(null);
        });
      } catch {
        setIsPlayingPreview(null);
      }
    } else {
      setIsPlayingPreview(null);
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
        <main className="p-6 md:p-8 max-w-[1400px] w-full mx-auto pb-28">
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

              {/* Conversion History Section */}
              <ConversionHistory
                items={historyItems}
                onDelete={handleDeleteHistory}
                onRefresh={loadHistory}
                onShowNotification={setNotificationModal}
                onPlayTrack={(track) => {
                  setPlayerTrack(track);
                  setIsPlayerOpen(true);
                }}
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

      {/* 3. Sticky Bottom Audio Player (Cố định ở chân trang, ngang hàng với mục thông tin ở sidebar) */}
      <BottomAudioPlayer
        track={playerTrack}
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        onDownload={handleDownloadPlayerTrack}
      />

      {/* 4. Studio Record Modal */}
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
