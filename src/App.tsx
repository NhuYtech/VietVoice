import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { MainEditor } from './components/MainEditor';
import { ConcatenationInspector } from './components/ConcatenationInspector';
import { ConversionHistory } from './components/ConversionHistory';
import { CorpusView } from './components/CorpusView';
import { AboutView } from './components/AboutView';
import { RecordModal } from './components/RecordModal';
import { BottomAudioPlayer, type PlayerTrack } from './components/BottomAudioPlayer';
import { getAllEntries } from './lib/store';
import { loadManifest, cachedManifestWords } from './lib/tts';
import { playSamples, decodeBlob, SR } from './lib/dsp';
import type { CorpusEntry, SynthResult } from './lib/types';
import {
  getStoredHistory,
  addHistoryEntry,
  removeHistoryEntry,
  removeHistoryEntries,
  performSynthesis,
  mapSpeakerToCore,
  resolveTrackAudioBlob,
} from './services/ttsService';
import type { ConversionHistoryItem } from './data/mockCorpus';
import { NotificationModal, type NotificationModalData } from './components/NotificationModal';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('tts');
  const [inputText, setInputText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<'Hữu Thọ'>('Hữu Thọ');
  const [isConverting, setIsConverting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [activeResult, setActiveResult] = useState<SynthResult | null>(null);
  const [historyItems, setHistoryItems] = useState<ConversionHistoryItem[]>([]);
  const [realEntries, setRealEntries] = useState<CorpusEntry[]>([]);
  const [manifestCount, setManifestCount] = useState<number>(() => cachedManifestWords.length);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState<'Hữu Thọ' | null>(null);
  const [notificationModal, setNotificationModal] = useState<NotificationModalData | null>(null);
  const [recordInitialWord, setRecordInitialWord] = useState('');

  // Track âm thanh đang phát ở thanh player cố định cuối trang
  const [playerTrack, setPlayerTrack] = useState<PlayerTrack | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playTrigger, setPlayTrigger] = useState(0);

  // Tải danh sách ngữ liệu từ IndexedDB và manifest ban đầu
  const loadCorpus = useCallback(async () => {
    try {
      const initial = await getAllEntries();
      const existingIds = new Set(initial.map((e) => e.id));
      const count = await loadManifest(existingIds).catch(() => 0);
      setManifestCount(typeof count === 'number' && count > 0 ? count : cachedManifestWords.length);
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

  // Phát / Dừng hoặc tự động tổng hợp tức thì khi bấm nút Play
  const handleTogglePlayTrack = async (item: ConversionHistoryItem | PlayerTrack) => {
    // 1. Nếu đang phát chính track này -> tạm dừng
    if (playerTrack?.id === item.id && isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }

    // 2. Nếu là đúng track này và đã có audioBlob nhưng đang tạm dừng -> tiếp tục phát
    if (playerTrack?.id === item.id && playerTrack?.audioBlob) {
      setCurrentPlayingId(item.id || null);
      setIsPlayingAudio(true);
      setPlayTrigger((c) => c + 1);
      return;
    }

    // 3. Nếu chuyển sang track khác hoặc track chưa có blob âm thanh:
    let blob = item.audioBlob;
    if (!blob) {
      blob = (await resolveTrackAudioBlob(item, realEntries)) || undefined;
    }

    const updatedTrack: PlayerTrack = {
      id: item.id,
      text: item.text,
      speaker: item.speaker,
      durationSec: (item as any).durationSec || (item as any).duration || 0.72,
      audioBlob: blob,
      filename: item.filename,
    };

    setPlayerTrack(updatedTrack);
    setIsPlayerOpen(true);
    setCurrentPlayingId(item.id || null);
    setIsPlayingAudio(true);
    setPlayTrigger((c) => c + 1);
  };

  // Xử lý nghe thử trước khi tạo chính thức (không lưu vào lịch sử)
  const handlePreview = async () => {
    if (!inputText.trim()) {
      setNotificationModal({
        type: 'warning',
        title: 'Chưa nhập văn bản',
        message: 'Vui lòng nhập văn bản cần nghe thử.',
        confirmText: 'Đóng',
      });
      return;
    }

    setIsPreviewing(true);
    try {
      const res = await performSynthesis(inputText, selectedVoice, realEntries);
      if (!res.success || !res.result) {
        const isMissing = Boolean(res.missingTokens && res.missingTokens.length > 0 && !res.suggestedVoice);
        setNotificationModal({
          type: 'warning',
          title: res.suggestedVoice
            ? 'Đổi giọng đọc'
            : isMissing
            ? 'Chưa có bản ghi'
            : 'Chưa thể nghe thử',
          message: res.error || 'Chưa có file âm thanh trong ngữ liệu.',
          action: res.suggestedVoice
            ? {
                label: `Chọn Giọng ${res.suggestedVoice}`,
                onClick: () => {
                  setSelectedVoice(res.suggestedVoice!);
                },
              }
            : isMissing && res.missingTokens && res.missingTokens.length > 0
            ? {
                label: 'Thu âm ngay',
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

        // Đưa vào Bottom Player để phát trực tiếp
        const previewTrack: PlayerTrack = {
          id: `preview-${Date.now()}`,
          text: inputText,
          speaker: 'Hữu Thọ',
          durationSec: res.result.durationSec,
          audioBlob: res.result.wav,
          filename: 'vietvoice_preview_huutho.wav',
        };
        setPlayerTrack(previewTrack);
        setIsPlayerOpen(true);
        setCurrentPlayingId(previewTrack.id || null);
        setIsPlayingAudio(true);
        setPlayTrigger((c) => c + 1);
      }
    } catch (err: any) {
      setNotificationModal({
        type: 'error',
        title: 'Lỗi nghe thử',
        message: err?.message || 'Không thể tạo âm thanh nghe thử.',
        confirmText: 'Đóng',
      });
    } finally {
      setIsPreviewing(false);
    }
  };

  // Xử lý tạo âm thanh (Chuyển văn bản)
  const handleConvert = async () => {
    if (!inputText.trim()) {
      setNotificationModal({
        type: 'warning',
        title: 'Chưa nhập văn bản',
        message: 'Vui lòng nhập văn bản cần chuyển đổi.',
        confirmText: 'Đóng',
      });
      return;
    }

    setIsConverting(true);
    const tempId = `conv-${Date.now()}`;
    const pendingItem: ConversionHistoryItem = {
      id: tempId,
      text: inputText.trim(),
      speaker: 'Hữu Thọ',
      duration: 0,
      createdAt: 'Vừa xong',
      filename: 'vietvoice_huutho.wav',
      status: 'converting',
    };
    setHistoryItems((prev) => [pendingItem, ...prev]);

    try {
      const res = await performSynthesis(inputText, selectedVoice, realEntries);

      if (!res.success || !res.result) {
        const failedHist = addHistoryEntry(
          inputText,
          selectedVoice,
          0,
          undefined,
          undefined,
          'failed'
        );
        setHistoryItems((prev) => [failedHist, ...prev.filter((p) => p.id !== tempId)]);

        const isMissing = Boolean(res.missingTokens && res.missingTokens.length > 0 && !res.suggestedVoice);
        setNotificationModal({
          type: 'warning',
          title: res.suggestedVoice
            ? 'Đổi giọng đọc'
            : isMissing
            ? 'Chưa có bản ghi'
            : 'Chưa thể chuyển',
          message:
            res.error ||
            'Chưa có file âm thanh trong ngữ liệu.',
          action: res.suggestedVoice
            ? {
                label: `Chọn Giọng ${res.suggestedVoice}`,
                onClick: () => {
                  setSelectedVoice(res.suggestedVoice!);
                },
              }
            : isMissing && res.missingTokens && res.missingTokens.length > 0
            ? {
                label: 'Thu âm ngay',
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
        const newHist = addHistoryEntry(
          inputText,
          selectedVoice,
          res.result.durationSec,
          res.result.wav,
          undefined,
          'completed'
        );
        setHistoryItems((prev) => [newHist, ...prev.filter((p) => p.id !== tempId)]);

        // Cập nhật và phát ngay ở thanh player cố định cuối trang
        const newTrack: PlayerTrack = {
          id: newHist.id,
          text: inputText,
          speaker: selectedVoice,
          durationSec: res.result.durationSec,
          audioBlob: res.result.wav,
          filename: newHist.filename,
        };
        setPlayerTrack(newTrack);
        setIsPlayerOpen(true);
        setCurrentPlayingId(newHist.id);
        setIsPlayingAudio(true);
        setPlayTrigger((c) => c + 1);

        setNotificationModal({
          type: 'success',
          title: 'Tạo audio thành công',
          message: `Thời lượng: ${res.result.durationSec.toFixed(2)}s (${selectedVoice}).`,
          confirmText: 'OK',
        });
      }
    } catch (err: any) {
      const failedHist = addHistoryEntry(
        inputText,
        selectedVoice,
        0,
        undefined,
        undefined,
        'failed'
      );
      setHistoryItems((prev) => [failedHist, ...prev.filter((p) => p.id !== tempId)]);

      setNotificationModal({
        type: 'error',
        title: 'Lỗi tổng hợp',
        message: err?.message || 'Không thể tạo âm thanh.',
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
      a.download = trk.filename || 'vietvoice_huutho_audio.wav';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const dummy = new Blob(['RIFF....WAVEfmt '], { type: 'audio/wav' });
      const url = URL.createObjectURL(dummy);
      const a = document.createElement('a');
      a.href = url;
      a.download = trk.filename || 'vietvoice_huutho_audio.wav';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Xóa mục lịch sử với popup xác nhận (hỗ trợ cả xóa 1 mục hoặc xóa nhiều mục cùng lúc)
  const handleDeleteHistory = (idOrIds: string | string[]) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return;
    const isMultiple = ids.length > 1;

    setNotificationModal({
      type: 'confirm',
      title: isMultiple ? 'Xóa mục đã chọn' : 'Xóa lịch sử',
      message: isMultiple
        ? `Xóa ${ids.length} mục đã chọn khỏi lịch sử?`
        : 'Xóa mục này khỏi lịch sử?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      onConfirm: () => {
        const idSet = new Set(ids);
        const updated = removeHistoryEntries(ids);
        setHistoryItems(updated);
        if (playerTrack && idSet.has(playerTrack.id || '')) {
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
            setIsPlayerOpen(false);
          }
        }
      },
    });
  };

  // Nghe thử giọng mẫu của Hữu Thọ
  const handlePlayPreviewVoice = async (_voice?: 'Hữu Thọ') => {
    if (isPlayingPreview) return;
    setIsPlayingPreview('Hữu Thọ');

    const sampleEntry = realEntries.find(
      (e) => (e.speaker === 'nam' || e.speaker === 'Hữu Thọ') && e.blob
    );

    if (sampleEntry && sampleEntry.blob) {
      try {
        const samples = await decodeBlob(sampleEntry.blob);
        playSamples(samples, SR, () => {
          setIsPlayingPreview(null);
        });
      } catch {
        setIsPlayingPreview(null);
      }
    } else {
      setIsPlayingPreview(null);
      setNotificationModal({
        type: 'warning',
        title: 'Chưa có bản thu',
        message: 'Giọng Hữu Thọ chưa có bản thu mẫu.',
        confirmText: 'Đóng',
      });
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F7F8FC] flex text-[#20213A]">
      {/* 1. Left Fixed Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        corpusCount={realEntries.length + (cachedManifestWords.length || 6674)}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 ml-[240px] flex flex-col min-w-0 h-screen overflow-hidden pt-[72px]">
        {/* Top Header */}
        <Header currentTab={currentTab} />

        {/* Global Notification Modal Popup */}
        <NotificationModal
          data={notificationModal}
          onClose={() => setNotificationModal(null)}
        />

        {/* Workspace Body: Cố định cả tab Chuyển văn bản và tab Dữ liệu trong màn hình (chỉ cuộn list/bảng) */}
        {currentTab === 'about' ? (
          <main
            className={`flex-1 min-h-0 px-4 sm:px-6 pt-4 max-w-[1400px] w-full mx-auto overflow-y-auto overscroll-contain transition-[margin] duration-200 ${
              isPlayerOpen ? 'mb-[76px] pb-6' : 'pb-8'
            }`}
          >
            <AboutView />
          </main>
        ) : (
          <main
            className={`flex-1 min-h-0 px-4 sm:px-6 pt-4 max-w-[1400px] w-full mx-auto flex flex-col overflow-hidden transition-[margin] duration-200 ${
              isPlayerOpen
                ? 'mb-[76px] pb-2'
                : 'pb-3'
            }`}
          >
            {currentTab === 'tts' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto pr-1">
                {/* Main Editor Card: Cố định vị trí phía trên */}
                <div className="shrink-0">
                  <MainEditor
                    text={inputText}
                    onChangeText={setInputText}
                    selectedVoice={selectedVoice}
                    onSelectVoice={setSelectedVoice}
                    onConvert={handleConvert}
                    isConverting={isConverting}
                    onPreview={handlePreview}
                    isPreviewing={isPreviewing}
                    entries={realEntries}
                    manifestCount={manifestCount}
                    onPlayPreviewVoice={handlePlayPreviewVoice}
                    isPlayingPreview={isPlayingPreview}
                    onOpenRecordModal={(word) => {
                      setRecordInitialWord(word || '');
                      setIsRecordModalOpen(true);
                    }}
                    onShowNotification={setNotificationModal}
                  />

                  {/* Minh chứng ghép nối ngữ liệu (Concatenation Inspector) */}
                  {activeResult && (
                    <ConcatenationInspector
                      result={activeResult}
                      selectedVoice={selectedVoice}
                      onSelectWordToRecord={(word) => {
                        setRecordInitialWord(word);
                        setIsRecordModalOpen(true);
                      }}
                    />
                  )}
                </div>

                {/* Conversion History Section: Tự động co giãn theo chiều dọc và chỉ cuộn riêng phần danh sách */}
                <ConversionHistory
                  items={historyItems}
                  onDelete={handleDeleteHistory}
                  onRefresh={loadHistory}
                  currentPlayingId={currentPlayingId}
                  isPlayingAudio={isPlayingAudio}
                  onTogglePlay={handleTogglePlayTrack}
                  onShowNotification={setNotificationModal}
                  onPlayTrack={(track) => handleTogglePlayTrack(track)}
                  onSelectSampleText={(txt) => {
                    setInputText(txt);
                  }}
                />
              </div>
            )}

            {currentTab === 'corpus' && (
              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto pr-1">
                <CorpusView
                  realEntries={realEntries}
                  onOpenRecordModal={() => {
                    setRecordInitialWord('');
                    setIsRecordModalOpen(true);
                  }}
                  onRefresh={loadCorpus}
                  onShowNotification={setNotificationModal}
                />
              </div>
            )}
          </main>
        )}
      </div>

      {/* 3. Sticky Bottom Audio Player (Cố định ở chân trang, ngang hàng với mục thông tin ở sidebar) */}
      <BottomAudioPlayer
        track={playerTrack}
        isOpen={isPlayerOpen}
        isPlayingProp={isPlayingAudio}
        playTrigger={playTrigger}
        onClose={() => {
          setIsPlayerOpen(false);
          setIsPlayingAudio(false);
        }}
        onDownload={handleDownloadPlayerTrack}
        onPlaybackStateChange={(playing) => {
          setIsPlayingAudio(playing);
          if (!playing && !playerTrack) {
            setCurrentPlayingId(null);
          }
        }}
        onRequestAudio={handleTogglePlayTrack}
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
            title: 'Đã lưu bản thu',
            message: 'Từ mới đã được thêm vào ngữ liệu.',
            confirmText: 'OK',
          });
        }}
        defaultSpeaker={selectedVoice}
      />
    </div>
  );
};

export default App;
