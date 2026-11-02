/**
 * Module mã hóa từ có dấu và đặt tên file .wav theo quy ước VNI:
 * 
 * Quy ước:
 * - Dấu giống bộ gõ VNI (số là dấu: 0=ngang, 1=sắc, 2=huyền, 3=hỏi, 4=ngã, 5=nặng) và đặt phía sau mỗi từ.
 *   Từ không dấu đặt số 0 phía sau (VD: ba -> ba0, bác -> bac1, cảng -> cang3).
 * - Chữ â, ô, ê -> a+, o+, e+
 * - Chữ ă, ơ, ư -> aa, oo, uu
 * - Chữ đ -> d-
 */

const TONE_MARKS: Record<string, number> = {
  '\u0301': 1, // Sắc
  '\u0300': 2, // Huyền
  '\u0309': 3, // Hỏi
  '\u0303': 4, // Ngã
  '\u0323': 5  // Nặng
};

const VOWEL_ACCENTS: Record<string, string[]> = {
  'a': ['a', 'á', 'à', 'ả', 'ã', 'ạ'],
  'a+': ['â', 'ấ', 'ầ', 'ẩ', 'ẫ', 'ậ'],
  'aa': ['ă', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ'],
  'e': ['e', 'é', 'è', 'ẻ', 'ẽ', 'ẹ'],
  'e+': ['ê', 'ế', 'ề', 'ể', 'ễ', 'ệ'],
  'i': ['i', 'í', 'ì', 'ỉ', 'ĩ', 'ị'],
  'o': ['o', 'ó', 'ò', 'ỏ', 'õ', 'ọ'],
  'o+': ['ô', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ'],
  'oo': ['ơ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ'],
  'u': ['u', 'ú', 'ù', 'ủ', 'ũ', 'ụ'],
  'uu': ['ư', 'ứ', 'ừ', 'ử', 'ữ', 'ự'],
  'y': ['y', 'ý', 'ỳ', 'ỷ', 'ỹ', 'ỵ']
};

/**
 * Kiểm tra chuỗi có phải là mã VNI đã mã hóa theo quy ước không (vd: ba0, bac1, cang3, d-e+m0).
 */
export function isVniCode(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim().toLowerCase();
  return /^[a-z0-9\+\-]+[0-5]$/.test(t) || t.includes('d-') || t.includes('+') || /[0-5]$/.test(t);
}

/**
 * Mã hóa 1 từ tiếng Việt sang mã theo quy ước (vd: ba -> ba0, bác -> bac1, cảng -> cang3).
 */
export function encodeVnWord(rawWord: string): string {
  if (!rawWord || typeof rawWord !== 'string') return '';
  let word = rawWord.trim().toLowerCase();
  if (!word) return '';

  // Nếu chuỗi đã là mã theo quy ước (kết thúc bằng 0-5 và có ký tự mã hóa), trả về luôn
  if (/^[a-z\+\-]+[0-5]$/.test(word)) {
    return word;
  }

  // Chữ đ -> d-
  word = word.replace(/đ/g, 'd-');

  // Phân rã NFD để tách dấu thanh
  const nfd = word.normalize('NFD');
  let tone = 0;
  const chars: string[] = [];

  for (const ch of nfd) {
    if (TONE_MARKS[ch] !== undefined) {
      tone = TONE_MARKS[ch];
    } else {
      chars.push(ch);
    }
  }

  // Ghép lại NFC để có các nguyên âm mũ/móc (â, ô, ê, ă, ơ, ư) không còn dấu thanh
  const baseNfc = chars.join('').normalize('NFC');

  // Quy ước mũ / móc
  let res = '';
  for (const ch of baseNfc) {
    if (ch === 'â') res += 'a+';
    else if (ch === 'ô') res += 'o+';
    else if (ch === 'ê') res += 'e+';
    else if (ch === 'ă') res += 'aa';
    else if (ch === 'ơ') res += 'oo';
    else if (ch === 'ư') res += 'uu';
    else res += ch;
  }

  // Luôn đặt số dấu VNI (0-5) ở phía sau mỗi từ
  return `${res}${tone}`;
}

/**
 * Giải mã từ mã quy ước về từ tiếng Việt có dấu chuẩn (vd: bac1 -> bác, cang3 -> cảng, d-e+m0 -> đêm).
 */
export function decodeVnWord(code: string): string {
  if (!code || typeof code !== 'string') return '';
  const c = code.trim().toLowerCase();
  if (!c) return '';

  // Tách số dấu thanh ở cuối (0-5)
  const match = c.match(/^(.*?)([0-5])$/);
  let base = c;
  let tone = 0;

  if (match) {
    base = match[1];
    tone = parseInt(match[2], 10);
  }

  // Thay thế d- -> đ
  base = base.replace(/d-/g, 'đ');

  // Phân tích các nguyên âm và phụ âm
  const vowelRegex = /(a\+|e\+|o\+|aa|oo|uu|[aeiouy])/g;
  const parts: { type: 'c' | 'v'; val: string }[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = vowelRegex.exec(base)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ type: 'c', val: base.slice(lastIdx, m.index) });
    }
    parts.push({ type: 'v', val: m[1] });
    lastIdx = m.index + m[1].length;
  }

  if (lastIdx < base.length) {
    parts.push({ type: 'c', val: base.slice(lastIdx) });
  }

  const vowelIndices: number[] = [];
  parts.forEach((p, idx) => {
    if (p.type === 'v') vowelIndices.push(idx);
  });

  if (vowelIndices.length === 0) {
    return base;
  }

  // Xác định nguyên âm chính nhận dấu thanh theo ngữ âm tiếng Việt
  const hasFinalConsonant = parts[parts.length - 1].type === 'c';
  let targetVowelIdx = vowelIndices[0];

  const specialVowels = vowelIndices.filter((idx) =>
    ['a+', 'e+', 'o+', 'oo', 'uu', 'aa'].includes(parts[idx].val)
  );

  if (specialVowels.length === 1) {
    targetVowelIdx = specialVowels[0];
  } else if (specialVowels.length > 1) {
    // Trường hợp ươ (uu + oo) như trong "đường" -> ơ (oo) nhận dấu
    const ooIdx = specialVowels.find((idx) => parts[idx].val === 'oo');
    targetVowelIdx = ooIdx !== undefined ? ooIdx : specialVowels[specialVowels.length - 1];
  } else if (vowelIndices.length === 2) {
    if (hasFinalConsonant) {
      targetVowelIdx = vowelIndices[1];
    } else {
      const v2 = parts[vowelIndices[1]].val;
      if (['a', 'e'].includes(v2)) {
        targetVowelIdx = vowelIndices[0];
      } else {
        targetVowelIdx = vowelIndices[0]; // ai, oi, ui, ay
      }
    }
  } else if (vowelIndices.length >= 3) {
    targetVowelIdx = vowelIndices[1];
  }

  let result = '';
  parts.forEach((p, idx) => {
    if (p.type === 'c') {
      result += p.val;
    } else {
      const vKey = p.val;
      const accents = VOWEL_ACCENTS[vKey] || [vKey];
      if (idx === targetVowelIdx && tone > 0 && tone < accents.length) {
        result += accents[tone];
      } else {
        result += accents[0];
      }
    }
  });

  return result;
}

/**
 * Trả về tên file .wav theo đúng quy ước (vd: "bác" -> "bac1.wav", "ba" -> "ba0.wav").
 */
export function encodeVnFilename(word: string): string {
  if (!word || typeof word !== 'string') return 'audio.wav';
  const code = encodeVnWord(word);
  return `${code || 'audio'}.wav`;
}

/**
 * Nhận diện từ và mã quy ước từ tên file (vd: "bac1.wav" -> { word: "bác", code: "bac1" }).
 */
export function wordAndCodeFromFilename(filename: string): { word: string; code: string } {
  if (!filename || typeof filename !== 'string') return { word: '', code: '' };
  const cleanName = filename
    .replace(/\.[^.]+$/, '') // bỏ đuôi .wav
    .replace(/\s*\(\d+\)\s*$/, '') // bỏ (1), (2)...
    .trim()
    .toLowerCase();

  // Kiểm tra nếu là dạng mã quy ước VNI (vd: bac1, ba0, cang3, d-e+m0)
  if (isVniCode(cleanName)) {
    const word = decodeVnWord(cleanName);
    const code = encodeVnWord(word);
    return { word, code };
  }

  // Nếu là từ tiếng Việt thông thường (vd: "bác" hoặc "xin chào")
  const word = cleanName.replace(/[_\-.]+/g, ' ').trim();
  const code = word.split(' ').map(encodeVnWord).join('_');
  return { word, code };
}

