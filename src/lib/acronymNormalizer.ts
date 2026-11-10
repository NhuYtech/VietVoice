/**
 * Module Chuẩn Hóa Từ Viết Tắt & Ký Tự Riêng Biệt (Acronym & Fallback Normalizer)
 * 
 * Chức năng:
 * 1. Nhận diện các từ viết tắt phổ thông (CTUT, FPT, AI, VTV, CSDL, TPHCM, CNTT, TTS, WAV, PCM, DSP...)
 * 2. Tự động tách tất cả các từ viết tắt (chữ hoa từ 2 ký tự trở lên) thành từng ký tự/chữ cái riêng biệt để phát âm.
 * 3. Nếu một từ không có trong kho dataset âm thanh (từ lạ, tên riêng, tiếng Anh chưa có bản thu),
 *    tự động phân rã thành từng chữ cái riêng biệt (được thu âm đầy đủ từ A-Z, Đ) để đọc nối ghép lại.
 */

export const COMMON_ACRONYMS: Record<string, string> = {
  // 1. Trường học, Viện nghiên cứu, Đơn vị đào tạo
  'ctut': 'c t u t',
  'ctu': 'c t u',
  'fpt': 'f p t',
  'uit': 'u i t',
  'hust': 'h u s t',
  'vnu': 'v n u',
  'neu': 'n e u',
  'ftu': 'f t u',
  'ueh': 'u e h',
  'uel': 'u e l',
  'hutech': 'h u t e c h',
  'bkhn': 'b k h n',
  'bktphcm': 'b k t p h c m',

  // 2. Cơ quan, Địa danh, Đơn vị hành chính
  'ubnd': 'u b n d',
  'hdnd': 'h đ n d',
  'bgd': 'b g d',
  'bch': 'b c h',
  'thpt': 't h p t',
  'thcs': 't h c s',
  'dh': 'đ h',
  'cd': 'c đ',
  'nxb': 'n x b',
  'tphcm': 't p h c m',
  'hcm': 'h c m',
  'hn': 'h n',
  'dn': 'đ n',
  'ct': 'c t',
  'vn': 'v n',
  'sv': 's v',
  'gv': 'g v',
  'vtv': 'v t v',
  'htv': 'h t v',
  'vov': 'v o v',

  // 3. Công nghệ thông tin, Khoa học máy tính & CSDL đa phương tiện
  'cntt': 'c n t t',
  'csdl': 'c s d l',
  'mmdbms': 'm m d b m s',
  'dbms': 'd b m s',
  'tts': 't t s',
  'asr': 'a s r',
  'stt': 's t t',
  'nlp': 'n l p',
  'ai': 'a i',
  'it': 'i t',
  'ui': 'u i',
  'ux': 'u x',
  'api': 'a p i',
  'sdk': 's d k',
  'url': 'u r l',
  'uri': 'u r i',
  'html': 'h t m l',
  'css': 'c s s',
  'js': 'j s',
  'ts': 't s',
  'cpu': 'c p u',
  'gpu': 'g p u',
  'tpu': 't p u',
  'ram': 'r a m',
  'rom': 'r o m',
  'ssd': 's s d',
  'hdd': 'h d d',
  'usb': 'u s b',
  'lan': 'l a n',
  'wan': 'w a n',
  'wifi': 'w i f i',
  'iot': 'i o t',
  'gps': 'g p s',
  'sim': 's i m',
  'sms': 's m s',
  'pdf': 'p d f',
  'doc': 'd o c',
  'docx': 'd o c x',
  'wav': 'w a v',
  'mp3': 'm p ba',
  'mp4': 'm p bốn',
  'pcm': 'p c m',
  'dsp': 'd s p',
  'fft': 'f f t',
  'stft': 's t f t',
  'mfcc': 'm f c c',
  'vad': 'v a d',
  'dtw': 'd t w',
  'lsd': 'l s d',
  'snr': 's n r',
  'f0': 'f không',
  'rms': 'r m s',
  'zcr': 'z c r',
  'mos': 'm o s',
  'rtf': 'r t f',
  'vni': 'v n i',
  'nfc': 'n f c',
  'nfd': 'n f d',
  'cdn': 'c d n',
  'idb': 'i d b',
  'http': 'h t t p',
  'https': 'h t t p s',
  'ftp': 'f t p',
  'ssh': 's s h',
  'ip': 'i p',
  'dns': 'd n s',
  'bot': 'b o t',
  'app': 'a p p',
};

/**
 * Tách các từ viết tắt (chữ in hoa liên tiếp từ 2 ký tự trở lên: CTUT, FPT, AI, VTV, CSDL...)
 * thành từng chữ cái riêng biệt.
 * Ví dụ: "Trường CTUT và FPT" -> "Trường C T U T và F P T"
 */
export function expandUppercaseAcronyms(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = text;

  // 1. Dạng viết tắt có dấu chấm (C.T.U.T, F.P.T, U.S.A, T.P.H.C.M...)
  result = result.replace(/\b([A-Za-zĐđ]\.)+([A-Za-zĐđ])\b/g, (match) => {
    return match.replace(/\./g, ' ');
  });

  // 2. Dạng kết hợp chữ hoa và số (4G, 5G, MP3, H2O, F0, 3D, 2D...)
  result = result.replace(/\b([A-Za-zĐđ]+)(\d+)\b/g, '$1 $2');
  result = result.replace(/\b(\d+)([A-Za-zĐđ]+)\b/g, '$1 $2');

  // 3. Dạng CamelCase như ChatGPT, iPhone, YouTube...
  result = result.replace(/([a-z])([A-Z])/g, '$1 $2');

  // 4. Dạng chữ hoa liên tiếp từ 2 ký tự trở lên (CTUT, FPT, AI, VTV, TTS, CSDL, TPHCM...)
  // Lưu ý: Không tách nếu là từ VNI đã mã hóa kết thúc bằng số 0-5 (ví dụ: BAC1, BA0)
  result = result.replace(/\b([A-ZĐ]{2,})\b/g, (match) => {
    // Nếu kết thúc bằng số 0-5 hoặc có dấu VNI thì giữ nguyên
    if (/[0-5]$/.test(match) || match.includes('+') || match.includes('-')) {
      return match;
    }
    return match.split('').join(' ');
  });

  return result;
}

/**
 * Mở rộng từ viết tắt phổ thông (áp dụng cho cả trường hợp gõ chữ thường như ctut, fpt, vtv, csdl...)
 */
export function expandCommonAcronyms(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const tokens = text.split(/(\s+)/);
  return tokens
    .map((tok) => {
      const lower = tok.trim().toLowerCase();
      if (COMMON_ACRONYMS[lower]) {
        return COMMON_ACRONYMS[lower];
      }
      return tok;
    })
    .join('');
}

/**
 * Phân rã một từ chưa có trong dataset thành các chữ cái riêng biệt
 * Ví dụ: "ctut" -> "c t u t", "covid" -> "c o v i d"
 */
export function decomposeWordToLetters(word: string): string {
  if (!word || typeof word !== 'string') return '';
  const clean = word.trim().toLowerCase();
  if (clean.length <= 1) return clean;

  // Lọc chỉ giữ các ký tự chữ cái tiếng Việt/Latin
  const letters = clean.match(/[\p{L}\p{N}]/gu);
  if (!letters || letters.length === 0) return clean;
  return letters.join(' ');
}

