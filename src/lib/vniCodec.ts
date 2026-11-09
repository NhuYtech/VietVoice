/**
 * Module mã hóa từ có dấu và đặt tên file .wav theo đúng quy ước:
 * 
 * Quy ước:
 * - Dấu giống bộ gõ VNI (số là dấu: 0=ngang, 1=sắc, 2=huyền, 3=hỏi, 4=ngã, 5=nặng) và đặt phía sau mỗi từ.
 *   Với những từ không dấu thì đặt số 0 phía sau (VD: ba -> ba0, bác -> bac1, cảng -> cang3).
 * - Chữ â, ô, ê -> quy định: â -> a+, ô -> o+, ê -> e+
 * - Chữ ă, ơ, ư -> quy định: ă -> aa, ơ -> oo, ư -> uu
 * - Chữ đ -> quy định: đ -> d-
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

const OLD_TO_NEW_TONE_A: Record<string, string> = {
  'ó': 'oá', 'ò': 'oà', 'ỏ': 'oả', 'õ': 'oã', 'ọ': 'oạ',
};
const OLD_TO_NEW_TONE_E: Record<string, string> = {
  'ó': 'oé', 'ò': 'oè', 'ỏ': 'oẻ', 'õ': 'oẽ', 'ọ': 'oẹ',
};
const OLD_TO_NEW_TONE_Y: Record<string, string> = {
  'ú': 'uý', 'ù': 'uỳ', 'ủ': 'uỷ', 'ũ': 'uỹ', 'ụ': 'uỵ',
};

/**
 * Chuẩn hóa vị trí dấu thanh tiếng Việt từ kiểu cũ sang kiểu mới:
 * Ví dụ: hóa -> hoá, hòa -> hoà, hỏa -> hoả, khỏe -> khoẻ, thủy -> thuỷ.
 * Giúp tương thích tuyệt đối với bộ 6.674 từ trong dataset và quy chuẩn hiện đại.
 */
export function normalizeToneToNewStyle(str: string): string {
  if (!str) return '';
  return str
    .replace(/([óòỏõọ])a/g, (_, ch) => OLD_TO_NEW_TONE_A[ch] || ch + 'a')
    .replace(/([óòỏõọ])e/g, (_, ch) => OLD_TO_NEW_TONE_E[ch] || ch + 'e')
    .replace(/([úùủũụ])y/g, (_, ch) => OLD_TO_NEW_TONE_Y[ch] || ch + 'y');
}

/**
 * Chuyển dấu thanh từ kiểu mới sang kiểu cũ:
 * Ví dụ: hoá -> hóa, hoà -> hòa, hoả -> hỏa, khoẻ -> khỏe, thuỷ -> thủy.
 */
export function normalizeToneToOldStyle(str: string): string {
  if (!str) return '';
  return str
    .replace(/o([áàảãạ])/g, (_, ch) => {
      const map: Record<string, string> = { 'á': 'óa', 'à': 'òa', 'ả': 'ỏa', 'ã': 'õa', 'ạ': 'ọa' };
      return map[ch] || 'o' + ch;
    })
    .replace(/o([éèẻẽẹ])/g, (_, ch) => {
      const map: Record<string, string> = { 'é': 'óe', 'è': 'òe', 'ẻ': 'ỏe', 'ẽ': 'õe', 'ẹ': 'ọe' };
      return map[ch] || 'o' + ch;
    })
    .replace(/u([ýỳỷỹỵ])/g, (_, ch) => {
      const map: Record<string, string> = { 'ý': 'úy', 'ỳ': 'ùy', 'ỷ': 'ủy', 'ỹ': 'ũy', 'ỵ': 'ụy' };
      return map[ch] || 'u' + ch;
    });
}

/**
 * Lấy danh sách các biến thể dấu của từ (cả kiểu cũ và kiểu mới) để tra cứu đa chiều.
 */
export function getToneVariants(text: string): string[] {
  if (!text) return [];
  const t = text.trim().toLowerCase();
  const n = normalizeToneToNewStyle(t);
  const o = normalizeToneToOldStyle(t);
  return Array.from(new Set([t, n, o])).filter(Boolean);
}

/**
 * Chuẩn hóa mã VNI: nếu số dấu thanh (0-5) nằm ở giữa từ (ví dụ: ho1a, ho3a, thu3y, to1an)
 * thì tự động chuyển về đúng quy ước chuẩn đặt ở cuối từ (hoa1, hoa3, thuy3, toan1).
 */
export function normalizeVniCode(code: string): string {
  if (!code || typeof code !== 'string') return '';
  const c = code.trim().toLowerCase();
  const midMatch = c.match(/^([a-z\+\-]+?)([0-5])([a-z\+\-]+)$/);
  if (midMatch) {
    return `${midMatch[1]}${midMatch[3]}${midMatch[2]}`;
  }
  return c;
}

/**
 * Sinh mã alias có số ở giữa cho các nguyên âm đôi (ví dụ: hoa1 -> ho1a, hoa3 -> ho3a, thuy3 -> thu3y)
 */
export function codeToMidDigitAlias(code: string): string {
  if (!code || typeof code !== 'string') return '';
  const c = code.trim().toLowerCase();
  const endMatch = c.match(/^([a-z\+\-]+)(oa|oe|uy)([0-5])$/);
  if (endMatch) {
    const prefix = endMatch[1];
    const diph = endMatch[2];
    const tone = endMatch[3];
    return `${prefix}${diph[0]}${tone}${diph[1]}`;
  }
  const simpleMatch = c.match(/^(oa|oe|uy)([0-5])$/);
  if (simpleMatch) {
    const diph = simpleMatch[1];
    const tone = simpleMatch[2];
    return `${diph[0]}${tone}${diph[1]}`;
  }
  return c;
}

/**
 * Kiểm tra chuỗi có phải là mã VNI đã mã hóa theo quy ước không (vd: ba0, bac1, cang3, muung2, d-e+m0, xin0_chao2, ho1a, ho3a).
 */
export function isVniCode(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim().toLowerCase();
  const tokens = t.split(/[_\s]+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => {
    const norm = normalizeVniCode(tok);
    return (
      /^[a-z0-9\+\-]+[0-5]$/.test(norm) ||
      norm.includes('d-') ||
      norm.includes('+') ||
      /[0-5]$/.test(norm)
    );
  });
}

/**
 * Mã hóa 1 từ đơn tiếng Việt sang mã theo quy ước (vd: ba -> ba0, bác -> bac1, cảng -> cang3, mừng -> muung2, đêm -> d-e+m0).
 */
export function encodeSingleWord(rawWord: string): string {
  if (!rawWord || typeof rawWord !== 'string') return '';
  let word = rawWord.trim().toLowerCase();
  if (!word) return '';

  // Chuẩn hóa nếu là mã có số ở giữa: ho1a -> hoa1, ho3a -> hoa3
  word = normalizeVniCode(word);

  // Nếu chuỗi đã là mã theo quy ước (kết thúc bằng 0-5), trả về luôn
  if (/^[a-z0-9\+\-]+[0-5]$/.test(word)) {
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

  // Quy ước mũ / móc: â -> a+, ô -> o+, ê -> e+, ă -> aa, ơ -> oo, ư -> uu
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

  // Luôn đặt số dấu VNI (0-5) ở phía sau mỗi từ. Từ không dấu thì đặt số 0 phía sau
  return `${res}${tone}`;
}

/**
 * Mã hóa từ hoặc cụm từ tiếng Việt sang mã theo quy ước (vd: ba -> ba0, bác -> bac1, cảng -> cang3, xin chào -> xin0_chao2).
 */
export function encodeVnWord(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  const trimmed = rawText.trim().toLowerCase();
  if (!trimmed) return '';

  const words = trimmed.split(/[\s_]+/).filter(Boolean);
  if (words.length === 0) return '';
  return words.map(encodeSingleWord).join('_');
}

/**
 * Giải mã 1 từ đơn từ mã quy ước về từ tiếng Việt có dấu chuẩn (vd: bac1 -> bác, cang3 -> cảng, ba0 -> ba, muung2 -> mừng, d-e+m0 -> đêm).
 */
export function decodeSingleWord(code: string): string {
  if (!code || typeof code !== 'string') return '';
  const c = normalizeVniCode(code.trim().toLowerCase());
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
      const v1 = parts[vowelIndices[0]].val;
      const v2 = parts[vowelIndices[1]].val;
      // oa, oe, uy: âm đệm (o, u) + âm chính (a, e, y) -> theo chuẩn mới và 6.674 từ dataset, dấu thanh đặt trên âm chính (v2): hoá, hoè, thuỷ
      if (['oa', 'oe', 'uy'].includes(v1 + v2)) {
        targetVowelIdx = vowelIndices[1];
      } else {
        // ia, ua, ưa -> âm chính là âm đầu (v1): mía, của, cửa
        targetVowelIdx = vowelIndices[0];
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
 * Giải mã từ hoặc chuỗi mã quy ước về từ tiếng Việt có dấu chuẩn (vd: xin0_chao2 -> xin chào, bac1 -> bác, cang3 -> cảng).
 */
export function decodeVnWord(code: string): string {
  if (!code || typeof code !== 'string') return '';
  const c = code.trim().toLowerCase();
  if (!c) return '';

  const tokens = c.split(/[_\s]+/).filter(Boolean);
  return tokens.map(decodeSingleWord).join(' ');
}

/**
 * Trả về tên file .wav theo đúng quy ước:
 * - ba -> ba0.wav
 * - bác -> bac1.wav
 * - cảng -> cang3.wav
 * - mừng -> muung2.wav
 * - đêm -> d-e+m0.wav
 * - xin chào -> xin0_chao2.wav
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

  // Kiểm tra nếu là dạng mã quy ước VNI (vd: bac1, ba0, cang3, d-e+m0, xin0_chao2)
  if (isVniCode(cleanName)) {
    const word = decodeVnWord(cleanName);
    const code = encodeVnWord(word);
    return { word, code };
  }

  // Nếu là từ tiếng Việt thông thường (vd: "bác" hoặc "xin chào")
  const word = cleanName.replace(/[_\-.]+/g, ' ').trim();
  const code = encodeVnWord(word);
  return { word, code };
}
