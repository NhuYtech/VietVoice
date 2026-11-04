/**
 * Module Chuẩn Hóa Số Sang Chữ Tiếng Việt (Vietnamese Number Normalization)
 * 
 * Hỗ trợ chuyển đổi toàn diện cho hệ thống TTS:
 * - Số nguyên tự nhiên (0 - hàng tỷ tỷ)
 * - Số âm (-5, -20...)
 * - Số thập phân (3.14, 3,5...)
 * - Tỷ lệ phần trăm (50%, 99.9%...)
 * - Tiền tệ (500k, 100.000đ, 50.000 đồng...)
 * - Giờ giấc (10h30, 08:45, 9h...)
 * - Số thứ tự (thứ 1 -> thứ nhất, thứ 2 -> thứ hai...)
 * - Ngày tháng (ngày 4/11, 04/11/2024...)
 * - Số điện thoại / chuỗi mã số (0912..., đọc từng chữ số)
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

/**
 * Đọc số có 2 chữ số (0 - 99) theo ngữ âm chuẩn tiếng Việt
 */
export function readTwoDigits(n: number, isFull = false): string {
  const tens = Math.floor(n / 10);
  const units = n % 10;
  const words: string[] = [];

  if (tens === 0) {
    if (isFull) words.push('linh');
    if (units > 0) words.push(DIGITS[units]);
  } else if (tens === 1) {
    words.push('mười');
    if (units === 1) words.push('một');
    else if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units]);
  } else {
    words.push(DIGITS[tens], 'mươi');
    if (units === 1) words.push('mốt');
    else if (units === 4) words.push('tư');
    else if (units === 5) words.push('lăm');
    else if (units > 0) words.push(DIGITS[units]);
  }
  return words.join(' ');
}

/**
 * Đọc cụm 3 chữ số (hàng trăm)
 */
export function readThreeDigits(n: number, readZeroHundreds: boolean): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const words: string[] = [];

  if (hundreds > 0 || readZeroHundreds) {
    words.push(DIGITS[hundreds], 'trăm');
  }

  if (remainder > 0) {
    const tens = Math.floor(remainder / 10);
    const units = remainder % 10;
    if (hundreds > 0 || readZeroHundreds) {
      if (tens === 0) {
        words.push('linh', units === 5 ? 'năm' : DIGITS[units]);
      } else {
        words.push(readTwoDigits(remainder, false));
      }
    } else {
      words.push(readTwoDigits(remainder, false));
    }
  }

  return words.join(' ');
}

/**
 * Đọc số nguyên lớn bất kỳ
 */
export function readInteger(numStr: string | number): string {
  const clean = String(numStr).replace(/^0+/, '');
  if (!clean) return 'không';
  if (clean.length > 15) {
    return clean.split('').map((d) => (/\d/.test(d) ? DIGITS[parseInt(d, 10)] : d)).join(' ');
  }

  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ'];
  const groups: number[] = [];
  let s = clean;
  while (s.length > 0) {
    const start = Math.max(0, s.length - 3);
    groups.unshift(parseInt(s.slice(start), 10));
    s = s.slice(0, start);
  }

  const parts: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    const val = groups[i];
    const scaleIdx = groups.length - 1 - i;
    if (val === 0) continue;

    const readZero = i > 0;
    const groupText = readThreeDigits(val, readZero);
    const scale = scales[scaleIdx % scales.length];
    parts.push(groupText + (scale ? ' ' + scale : ''));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Đọc chuỗi số rời rạc từng số (dành cho số điện thoại, mã số)
 */
export function readDigitsSequence(seq: string): string {
  return seq
    .split('')
    .map((c) => (/\d/.test(c) ? DIGITS[parseInt(c, 10)] : c))
    .join(' ');
}

/**
 * Kiểm tra xem chuỗi có chứa số hay không
 */
export function hasNumbers(text: string): boolean {
  return /\d/.test(text);
}

/**
 * Chuẩn hóa toàn bộ số trong câu văn bản sang từ ngữ tiếng Việt
 */
export function normalizeNumbersInText(text: string): string {
  if (!text || !hasNumbers(text)) return text;
  let s = text;

  // 1. Số điện thoại (bắt đầu bằng 0, có 10-11 chữ số): 0912345678, 0901234567...
  s = s.replace(/\b0[35789]\d{8}\b/g, (match) => {
    return readDigitsSequence(match);
  });

  // 2. Giờ phút: 10h30, 8h15, 14:30
  s = s.replace(/\b(\d{1,2})h(\d{1,2})\b/gi, (_, h, m) => {
    return `${readInteger(h)} giờ ${readInteger(m)} phút`;
  });
  s = s.replace(/\b(\d{1,2})h\b/gi, (_, h) => {
    return `${readInteger(h)} giờ`;
  });
  s = s.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_, h, m) => {
    return `${readInteger(h)} giờ ${readInteger(m)} phút`;
  });

  // 3. Ngày tháng: "ngày 4/11" hoặc "04/11/2024"
  s = s.replace(/(?:ngày\s+)?\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/gi, (_, d, m, y) => {
    let res = `ngày ${readInteger(d)} tháng ${readInteger(m)}`;
    if (y) res += ` năm ${readInteger(y)}`;
    return res;
  });

  // 4. Tiền tệ viết tắt: 500k, 100.000đ, 50.000 đồng
  s = s.replace(/(\d{1,3}(?:\.\d{3})+|\d+)\s*[kK]\b/g, (_, num) => {
    const cleanNum = num.replace(/\./g, '');
    return readInteger(cleanNum) + ' nghìn';
  });
  s = s.replace(/(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:đ|vnđ|vnd)(?!\w)/gi, (_, num) => {
    const cleanNum = num.replace(/\./g, '');
    return readInteger(cleanNum) + ' đồng';
  });

  // 5. Tỷ lệ phần trăm: 50%, 12.5%
  s = s.replace(/(\d+(?:[.,]\d+)?)%/g, (_, num) => {
    return normalizeNumbersInText(num) + ' phần trăm';
  });

  // 6. Số thứ tự: thứ 1 -> thứ nhất, thứ 2 -> thứ hai... thứ 7 -> thứ bảy
  s = s.replace(/\bthứ\s+1\b/gi, 'thứ nhất');
  s = s.replace(/\bthứ\s+2\b/gi, 'thứ hai');
  s = s.replace(/\bthứ\s+3\b/gi, 'thứ ba');
  s = s.replace(/\bthứ\s+4\b/gi, 'thứ tư');
  s = s.replace(/\bthứ\s+5\b/gi, 'thứ năm');
  s = s.replace(/\bthứ\s+6\b/gi, 'thứ sáu');
  s = s.replace(/\bthứ\s+7\b/gi, 'thứ bảy');

  // 7. Số hàng nghìn chuẩn (ngăn cách bằng dấu chấm: 100.000, 1.500.000)
  s = s.replace(/\b\d{1,3}(?:\.\d{3})+\b/g, (match) => {
    const raw = match.replace(/\./g, '');
    return readInteger(raw);
  });

  // 8. Số thập phân: 3.5 hoặc 3,5 hoặc 3.14
  s = s.replace(/\b(\d+)[.,](\d+)\b/g, (_, intPart, decPart) => {
    const intWord = readInteger(intPart);
    const decWord = decPart.length === 1 ? readInteger(decPart) : readDigitsSequence(decPart);
    return `${intWord} phẩy ${decWord}`;
  });

  // 9. Số âm: -25, -100
  s = s.replace(/(?:^|(?<=\s))-(\d+)\b/g, (_, num) => {
    return 'âm ' + readInteger(num);
  });

  // 10. Số nguyên thông thường còn lại: \b\d+\b
  s = s.replace(/\b\d+\b/g, (match) => {
    return readInteger(match);
  });

  return s;
}
