import { ArrowDown, ArrowRight } from 'lucide-react';

export const Sub = ({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const Box = ({ n, title, sub, color }: { n: string; title: string; sub: string; color: string }) => (
  <div className={`min-w-[140px] flex-1 rounded-xl border ${color} bg-black/20 p-3`}>
    <div className="text-xs font-bold text-white">
      <span className="mr-1.5 rounded bg-indigo-600 px-1.5 py-0.5 text-[10px]">{n}</span>
      {title}
    </div>
    <div className="mt-1 text-[11px] leading-snug text-slate-400">{sub}</div>
  </div>
);

const Flow = ({ items, color }: { items: [string, string, string][]; color: string }) => (
  <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
    {items.map(([n, t, s], i) => (
      <div key={n} className="flex flex-1 flex-col items-center gap-2 md:flex-row">
        <Box n={n} title={t} sub={s} color={color} />
        {i < items.length - 1 && (
          <>
            <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-500 md:block" />
            <ArrowDown className="h-4 w-4 shrink-0 text-slate-500 md:hidden" />
          </>
        )}
      </div>
    ))}
  </div>
);

export default function PipelinePanel() {
  return (
    <div className="space-y-4 text-sm text-slate-300">
      <Sub title="Hướng tiếp cận: tổng hợp ghép nối mức từ (concatenative)">
        <p className="leading-relaxed">
          Ngữ liệu song song <b>từ ↔ file thu âm</b> (theo giọng từng thành viên) là cơ sở dữ liệu đơn vị âm; đơn vị ghép là <b>nguyên một từ</b>.
          Khi tổng hợp, hệ thống tra từ đầu vào, lấy đoạn thu tương ứng, tiền xử lý rồi ghép lại. Không dùng mạng học sâu (Tacotron, FastSpeech…).
        </p>
      </Sub>

      <Sub title="Sơ đồ khối A – Xây dựng ngữ liệu (ngoại tuyến)">
        <Flow
          color="border-cyan-400/40"
          items={[
            ['A1', 'Thu âm', 'Mỗi từ × mỗi người, 1 từ = 1 file'],
            ['A2', 'Giải mã', 'Mono, lấy mẫu lại 22.05 kHz'],
            ['A3', 'Trích đặc trưng', 'Năng lượng, F0, STFT/mel/MFCC, thời lượng'],
            ['A4', 'Lưu trữ', 'IndexedDB, khóa giọng::từ'],
          ]}
        />
      </Sub>

      <Sub title="Sơ đồ khối B – Tổng hợp: từ văn bản đến tín hiệu âm thanh">
        <div className="space-y-3">
          <Flow
            color="border-pink-400/40"
            items={[
              ['B1', 'Nhận văn bản', 'Một từ hoặc chuỗi từ'],
              ['B2', 'Chuẩn hóa', 'NFC, chữ thường, bỏ dấu câu'],
              ['B3', 'Tách từ', 'Khớp dài nhất (longest-match)'],
            ]}
          />
          <Flow
            color="border-amber-400/40"
            items={[
              ['B4', 'Tra cứu ngữ liệu', '(giọng, từ) → bản ghi; thiếu → giọng khác / báo ngoài danh sách'],
              ['B5', 'Tiền xử lý', 'Cắt lặng, chuẩn hóa RMS, fade 5 ms'],
              ['B6', 'Ghép nối', 'Chèn lặng hoặc crossfade equal-power'],
            ]}
          />
          <Flow
            color="border-emerald-400/40"
            items={[
              ['B7', 'Kiểm tra điểm nối', 'Nhảy năng lượng (dB), nhảy F0 (semitone)'],
              ['B8', 'Xuất tín hiệu', 'Float32 → WAV PCM 16-bit'],
              ['B9', 'Phát / tải / đánh giá', 'Nghe, tải WAV, MOS & độ đo khách quan'],
            ]}
          />
        </div>
      </Sub>

      <Sub title="Quy trình chi tiết">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li><b>Nhận văn bản</b>, ví dụ “Xin chào, Việt Nam!”.</li>
          <li><b>Chuẩn hóa</b> → <code>xin chào việt nam</code> (Unicode NFC giữ dấu tiếng Việt thống nhất; bỏ ký tự không phải chữ/số).</li>
          <li><b>Tách từ longest-match</b>: thử khớp cụm n âm tiết dài nhất có trong danh mục, giảm dần đến 1.</li>
          <li><b>Tra cứu</b> khóa <code>giọng::từ</code>. Thiếu → dùng giọng khác (nếu bật) hoặc ghi “ngoài danh sách” và bỏ qua.</li>
          <li><b>Tiền xử lý</b>: cắt lặng bằng ngưỡng năng lượng thích nghi, chuẩn hóa RMS, fade 5 ms chống tiếng “lụp”.</li>
          <li><b>Ghép nối</b>: sₖ = kết thúc(k−1) + khoảng lặng; nếu khoảng lặng = 0, chồng crossfade với trọng số cos/sin (giữ công suất).</li>
          <li><b>Đo độ mượt</b> tại điểm nối, <b>xuất WAV</b> và phát.</li>
        </ol>
      </Sub>

      <div className="grid gap-4 lg:grid-cols-2">
        <Sub title="Lưu trữ & quản lý dữ liệu">
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-slate-200">{`public/corpus/
├─ manifest.json        # npm run corpus
├─ an/                  # thư mục = người thu
│   ├─ xin.wav          # tên file = từ
│   └─ việt_nam.wav     # '_' = khoảng trắng
└─ binh/xin.wav

IndexedDB "vietvoice-corpus"/"entries"
{ id: "an::xin",  word: "xin",
  speaker: "an",  blob: <audio gốc>,
  duration, features: {f0, energyDb,
    ltas, mfccMean, ...} }`}</pre>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
            <li>Khóa <code>giọng::từ</code>: tra cứu O(1), mỗi cặp là duy nhất.</li>
            <li>Chỉ mục theo <code>word</code> và <code>speaker</code>: liệt kê các giọng đọc từ X, mọi từ của giọng Y.</li>
            <li>Đặc trưng lưu kèm nên không phải tính lại; tín hiệu đã xử lý được cache.</li>
          </ul>
        </Sub>

        <Sub title="Tra cứu & kết hợp cho từ đầu vào mới">
          <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed text-slate-200">{`tokens ← tách(chuẩn_hóa(văn_bản))
i ← 0
while i < |tokens|:
  for n = N_max … 1:
    key ← tokens[i : i+n]
    e ← corpus[giọng][key] ∨ corpus[khác][key]
    if e: chọn(e); i += n; break
  else: ghi_OOV(tokens[i]); i += 1

for mỗi e đã chọn:
  x ← chuẩn_hóa_RMS(cắt_lặng(giải_mã(e)))
  đặt x tại s_k; chồng / chèn lặng
y ← ghép; kiểm_tra_nối(features)`}</pre>
        </Sub>
      </div>

      <Sub title="So sánh các kỹ thuật TTS hiện hành">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400"><tr><th className="p-2">Kỹ thuật</th><th className="p-2">Ý tưởng</th><th className="p-2">Ưu</th><th className="p-2">Nhược</th><th className="p-2">Phù hợp</th></tr></thead>
            <tbody className="align-top [&_td]:border-t [&_td]:border-white/5 [&_td]:p-2">
              <tr><td className="font-semibold">Ghép nối mức từ</td><td>Nối đoạn thu sẵn</td><td>Tự nhiên từng từ, đơn giản, không huấn luyện</td><td>Chỉ nói được từ đã thu; ngắt nhịp cơ học</td><td>✔ Dùng</td></tr>
              <tr><td className="font-semibold">Unit selection / PSOLA</td><td>Chọn đơn vị theo chi phí đích + nối; chỉnh F0, thời lượng</td><td>Mượt hơn</td><td>Cần CSDL lớn, gán nhãn</td><td>Mở rộng</td></tr>
              <tr><td className="font-semibold">Formant / articulatory</td><td>Mô hình nguồn–bộ lọc</td><td>Nhỏ gọn</td><td>Giọng máy móc</td><td>—</td></tr>
              <tr><td className="font-semibold">HMM / thống kê</td><td>Sinh thông số phổ + F0</td><td>Linh hoạt</td><td>Giọng “bí”</td><td>—</td></tr>
              <tr><td className="font-semibold">Neural (Tacotron, FastSpeech + vocoder)</td><td>Học văn bản → mel → sóng</td><td>Rất tự nhiên</td><td>Cần dữ liệu & GPU</td><td>Không yêu cầu</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">Chuẩn tham chiếu fpt.ai / vbee.vn: mỗi từ thu riêng, độ dài ngắn/dài khác nhau → cần cắt lặng và chuẩn hóa mức trước khi ghép.</p>
      </Sub>
    </div>
  );
}

