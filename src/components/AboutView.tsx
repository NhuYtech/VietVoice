import React from 'react';
import { Info, ArrowRight, Layers, Activity, FileCode, CheckCircle2, Waves, Cpu, Database } from 'lucide-react';

export const AboutView: React.FC = () => {
  const pipelineSteps = [
    {
      num: '01',
      title: 'Văn bản đầu vào',
      en: 'Text Input',
      desc: 'Nhận từ đơn hoặc chuỗi từ tiếng Việt có dấu từ người dùng.',
    },
    {
      num: '02',
      title: 'Chuẩn hóa & Tách từ',
      en: 'Normalization',
      desc: 'Chuyển về dạng chuẩn NFC, chữ thường, loại bỏ ký tự lạ và phân tách token.',
    },
    {
      num: '03',
      title: 'Tra cứu ngữ liệu',
      en: 'Corpus Lookup',
      desc: 'Ánh xạ từ sang mã VNI quy ước (vd: bác → bac1) và tra cứu file âm thanh tương ứng theo giọng đọc.',
    },
    {
      num: '04',
      title: 'Trích xuất âm thanh',
      en: 'Audio Retrieval',
      desc: 'Giải mã file .wav của từng từ từ IndexedDB hoặc kho dữ liệu song song.',
    },
    {
      num: '05',
      title: 'Ghép nối & Xử lý biên âm',
      en: 'Concatenation & Crossfade',
      desc: 'Cắt khoảng lặng đầu/cuối, chuẩn hóa biên độ RMS, làm mượt biên âm bằng kỹ thuật crossfade equal-power.',
    },
    {
      num: '06',
      title: 'Tín hiệu âm thanh đầu ra',
      en: 'Audio Output',
      desc: 'Xuất file âm thanh .WAV hoàn chỉnh (22.05 kHz Lossless) và phát trực tiếp trên trình duyệt.',
    },
  ];

  const acousticFeatures = [
    {
      name: 'Tần số cơ bản (Pitch / F₀)',
      unit: 'Hz',
      desc: 'Đặc trưng cho độ cao trầm của giọng người thu (Nam thường ~110-140 Hz, Nữ thường ~200-240 Hz). Dùng thuật toán tự tương quan (Autocorrelation) để ước lượng.',
    },
    {
      name: 'Năng lượng ngắn hạn & RMS',
      unit: 'dB / Biên độ',
      desc: 'Đại diện cho độ to/cường độ của âm thanh. Chuẩn hóa RMS giúp các từ khi ghép nối có âm lượng đồng đều, không bị giật hoặc vỡ tiếng.',
    },
    {
      name: 'Trọng tâm phổ (Spectral Centroid)',
      unit: 'Hz',
      desc: 'Điểm "trọng tâm" phân bố năng lượng theo tần số, phản ánh độ sáng/trong hoặc tối/đục của nguyên âm.',
    },
    {
      name: 'Hệ số MFCC (13 Coefficients)',
      unit: 'Vector',
      desc: 'Biểu diễn hình dạng bao phổ tần số trên thang Mel gần với cơ chế tiếp nhận của tai người, phục vụ việc đánh giá tính tương đồng âm sắc.',
    },
    {
      name: 'Thời lượng & Cắt khoảng lặng',
      unit: 'Milli-giây (ms)',
      desc: 'Thời lượng thực phát âm của từng từ. Cắt bỏ vùng lặng (silence trimming) ở đầu và cuối từ giúp các từ khi ghép lại nghe liền mạch, tự nhiên.',
    },
  ];

  const vniRules = [
    { rule: 'Dấu thanh', detail: '0 = Không dấu, 1 = Sắc, 2 = Huyền, 3 = Hỏi, 4 = Ngã, 5 = Nặng', example: 'ba → ba0, bác → bac1, cảng → cang3' },
    { rule: 'Chữ có mũ', detail: 'â → a+,  ô → o+,  ê → e+', example: 'công → co+ng0, nghệ → nghe+5' },
    { rule: 'Chữ móc & trăng', detail: 'ă → aa,  ơ → oo,  ư → uu', example: 'học → hoc5, tự → tuu5' },
    { rule: 'Chữ đ', detail: 'đ → d-', example: 'đến → d-e+n1' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Intro Header */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] p-7 shadow-sm">
        <div className="flex items-center gap-2.5 text-[#6255CF] mb-2 font-semibold text-xs uppercase tracking-wider">
          <Info className="w-4 h-4" />
          <span>VietVoice — Give Vietnamese Text a Voice</span>
        </div>
        <h2 className="text-xl font-bold text-[#20213A] mb-3">
          VietVoice — Hệ thống chuyển đổi văn bản thành âm thanh tiếng Việt mức từ
        </h2>
        <p className="text-sm text-[#555870] leading-relaxed">
          <strong>VietVoice</strong> là hệ thống chuyển đổi văn bản thành âm thanh (Text-to-Speech) tiếng Việt sử dụng phương pháp <strong>ghép nối ngữ liệu (Concatenative Speech Synthesis)</strong> ở mức từ (word-level). Hệ thống sử dụng bộ dữ liệu âm thanh song song được thu âm trực tiếp bởi các thành viên, hỗ trợ hai phiên bản giọng đọc <strong>Nam</strong> (Male) và <strong>Nữ</strong> (Female).
        </p>
      </div>

      {/* Sơ đồ khối và quy trình thực hiện */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] p-7 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-[#6255CF]" />
          <h3 className="text-base font-bold text-[#20213A]">
            1. Sơ đồ khối hệ thống & Quy trình thực hiện (Pipeline)
          </h3>
        </div>
        <p className="text-xs text-[#85879A] mb-6">
          Quy trình tuần tự từ lúc nhận văn bản đến khi xuất ra file tín hiệu âm thanh hoàn chỉnh:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelineSteps.map((step) => (
            <div
              key={step.num}
              className="p-4 rounded-xl border border-[#E8E8F0] bg-[#FAFAFD] relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#6255CF]/10 text-[#6255CF]">
                  BƯỚC {step.num}
                </span>
                <span className="text-[10px] uppercase font-semibold text-[#85879A]">
                  {step.en}
                </span>
              </div>
              <h4 className="text-sm font-bold text-[#20213A] mb-1.5">{step.title}</h4>
              <p className="text-xs text-[#63667E] leading-relaxed flex-1">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Thuộc tính & Đặc trưng âm học */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] p-7 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-[#6255CF]" />
          <h3 className="text-base font-bold text-[#20213A]">
            2. Các thuộc tính & Đặc trưng âm học (Acoustic Features)
          </h3>
        </div>
        <p className="text-xs text-[#85879A] mb-6">
          Các đặc trưng vật lý được trích xuất bằng thuật toán DSP (Digital Signal Processing) để phân tích và kiểm soát chất lượng ghép nối:
        </p>

        <div className="space-y-3">
          {acousticFeatures.map((feat, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-[#E8E8F0] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#6255CF]/40 transition"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[#20213A]">{feat.name}</h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F0F2F9] text-[#555870]">
                    {feat.unit}
                  </span>
                </div>
                <p className="text-xs text-[#63667E] mt-1 leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quy ước mã hóa VNI */}
      <div className="bg-white rounded-2xl border border-[#E8E8F0] p-7 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <FileCode className="w-5 h-5 text-[#6255CF]" />
          <h3 className="text-base font-bold text-[#20213A]">
            3. Quy ước mã hóa từ có dấu & Đặt tên file .wav (Chuẩn đề bài)
          </h3>
        </div>
        <p className="text-xs text-[#85879A] mb-4">
          Tên file được tự động chuẩn hóa theo bộ quy ước gõ VNI mở rộng, số biểu diễn dấu thanh đặt sau cùng của từ:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-[#E8E8F0] rounded-xl overflow-hidden">
            <thead className="bg-[#FAFBFD] text-[#85879A] uppercase text-[10px] tracking-wider border-b border-[#E8E8F0]">
              <tr>
                <th className="py-3 px-4 w-36">Quy ước</th>
                <th className="py-3 px-4">Quy tắc chi tiết</th>
                <th className="py-3 px-4 w-64">Ví dụ chuyển đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8F0]">
              {vniRules.map((r, i) => (
                <tr key={i} className="hover:bg-[#FAFBFD]">
                  <td className="py-3 px-4 font-bold text-[#20213A]">{r.rule}</td>
                  <td className="py-3 px-4 text-[#555870] font-mono text-[11px]">{r.detail}</td>
                  <td className="py-3 px-4 font-semibold text-[#6255CF] font-mono text-[11px]">
                    {r.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

