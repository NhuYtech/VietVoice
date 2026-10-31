# VietVoice – TTS ghép nối mức từ (concatenative)

Đầu vào: một từ / chuỗi từ thuộc danh sách đã thu âm → đầu ra: file WAV.

## Chạy
```
npm install
npm run dev
```

## Nạp ngữ liệu (bộ dữ liệu từ ↔ file thu âm của nhóm)
Đặt file vào `public/corpus/<người-thu>/<từ>.wav` (`_` = khoảng trắng, vd `việt_nam.wav`), rồi:
```
npm run corpus     # sinh public/corpus/manifest.json
```
Mở web, ngữ liệu tự nạp. Cũng có thể tải file/thư mục lên hoặc thu âm trực tiếp ở mục **Ngữ liệu & lưu trữ**.

## Cấu trúc
- `src/lib/dsp.ts` – giải mã, cắt lặng, chuẩn hóa RMS, STFT/mel/MFCC, F0, độ đo DTW
- `src/lib/tts.ts` – chuẩn hóa văn bản, tra cứu longest-match, ghép nối crossfade, nhập ngữ liệu
- `src/lib/store.ts` – IndexedDB (khóa `giọng::từ`)
- `src/components/` – Sơ đồ & quy trình, Đặc trưng, Ngữ liệu & lưu trữ, Đánh giá (MOS + độ đo khách quan)
