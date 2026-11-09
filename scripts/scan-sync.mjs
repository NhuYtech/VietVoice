import 'dotenv/config';
import fs from 'node:fs';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'VietVoice';
const key = process.env.CLOUDINARY_API_KEY;
const sec = process.env.CLOUDINARY_API_SECRET;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'wximbfoz';
const auth = Buffer.from(`${key}:${sec}`).toString('base64');

const VOWEL_ACCENTS = {
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

function decodeSingleWord(token) {
  let t = token.replace(/d-/g, 'đ');
  const toneMatch = t.match(/[0-5]$/);
  const tone = toneMatch ? parseInt(toneMatch[0], 10) : 0;
  let base = toneMatch ? t.slice(0, -1) : t;
  const vowelRegex = /(a\+|aa|e\+|o\+|oo|uu|a|e|i|o|u|y)/g;
  const parts = [];
  let lastIdx = 0;
  let m;
  while ((m = vowelRegex.exec(base)) !== null) {
    if (m.index > lastIdx) parts.push({ type: 'c', val: base.slice(lastIdx, m.index) });
    parts.push({ type: 'v', val: m[0] });
    lastIdx = vowelRegex.lastIndex;
  }
  if (lastIdx < base.length) parts.push({ type: 'c', val: base.slice(lastIdx) });

  const vowelIndices = [];
  parts.forEach((p, idx) => { if (p.type === 'v') vowelIndices.push(idx); });
  if (vowelIndices.length === 0) return base;

  let targetVowelIdx = vowelIndices[0];
  const specialVowels = vowelIndices.filter((idx) => ['a+', 'e+', 'o+', 'oo', 'uu', 'aa'].includes(parts[idx].val));
  if (specialVowels.length === 1) {
    targetVowelIdx = specialVowels[0];
  } else if (specialVowels.length > 1) {
    const ooIdx = specialVowels.find((idx) => parts[idx].val === 'oo');
    targetVowelIdx = ooIdx !== undefined ? ooIdx : specialVowels[specialVowels.length - 1];
  } else if (vowelIndices.length === 2) {
    const hasFinalConsonant = parts[parts.length - 1].type === 'c';
    targetVowelIdx = hasFinalConsonant ? vowelIndices[1] : vowelIndices[0];
  } else if (vowelIndices.length >= 3) {
    targetVowelIdx = vowelIndices[1];
  }

  let result = '';
  parts.forEach((p, idx) => {
    if (p.type === 'c') {
      result += p.val;
    } else {
      const accents = VOWEL_ACCENTS[p.val] || [p.val];
      result += (idx === targetVowelIdx && tone > 0 && tone < accents.length) ? accents[tone] : accents[0];
    }
  });
  return result;
}

function decodeVnWord(code) {
  if (!code) return '';
  return code.split(/[_\s]+/).map(decodeSingleWord).join(' ');
}

async function main() {
  console.log('=== BẮT ĐẦU QUÉT VÀ ĐỒNG BỘ TOÀN DIỆN CLOUDINARY & MONGODB ===');

  // Đọc manifest hiện có để map code sang từ tiếng Việt nếu có sẵn
  const codeToWordMap = new Map();
  try {
    const raw = fs.readFileSync('public/corpus/manifest.json', 'utf-8');
    const parsed = JSON.parse(raw);
    const words = Array.isArray(parsed) ? parsed : (parsed.words || []);
    for (const w of words) {
      if (w.code && w.word) codeToWordMap.set(w.code.toLowerCase(), w.word);
      if (w.file && w.word) {
        const c = w.file.replace(/^wavs\//, '').replace(/\.wav$/, '').toLowerCase();
        codeToWordMap.set(c, w.word);
      }
    }
    console.log(`✓ Đã nạp ${codeToWordMap.size} ánh xạ từ trong manifest.json.`);
  } catch (e) {
    console.warn('Lỗi đọc manifest:', e.message);
  }

  // 1. Quét toàn bộ resources video/audio trên Cloudinary
  console.log('1. Đang quét toàn bộ file âm thanh trên Cloudinary CDN...');
  let cursor = null;
  const cloudAssets = [];

  do {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/video?max_results=500${cursor ? `&next_cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    const data = await res.json();
    if (!data.resources) {
      console.error('Lỗi khi gọi API Cloudinary:', data);
      break;
    }
    cloudAssets.push(...data.resources);
    cursor = data.next_cursor;
    process.stdout.write(`   -> Đã quét ${cloudAssets.length} file âm thanh trên Cloudinary...\r`);
  } while (cursor);

  console.log(`\n✓ Quét xong Cloudinary: Tổng cộng ${cloudAssets.length} file âm thanh.`);

  // 2. Kết nối MongoDB
  console.log('2. Đang kết nối tới MongoDB Atlas...');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const collection = db.collection('Audio');

  // Đọc danh mục hiện có trong MongoDB
  const existingDocs = await collection.find({}).toArray();
  console.log(`✓ Đã nạp ${existingDocs.length} bản ghi hiện tại trong MongoDB.`);

  const docByPublicId = new Map();
  const docByCode = new Map();
  for (const doc of existingDocs) {
    if (doc.cloudinaryPublicId) docByPublicId.set(doc.cloudinaryPublicId, doc);
    if (doc.code) docByCode.set(doc.code.toLowerCase(), doc);
  }

  // 3. Phân tích các file trên Cloudinary xem có file nào mới chưa có trong MongoDB
  console.log('3. So sánh dữ liệu Cloudinary với MongoDB...');
  const newAssetsToAdd = [];
  const now = new Date();

  for (const asset of cloudAssets) {
    const publicId = asset.public_id; // e.g. "y0", "VietVoice_Corpus/recordings/nam_bac1", etc.
    const secureUrl = asset.secure_url;
    const duration = typeof asset.duration === 'number' && !isNaN(asset.duration) ? asset.duration : 0.45;

    // Tách code và tên file
    const cleanId = publicId.replace(/^.*[\\\/]/, ''); // Lấy tên basename
    let inferredCode = cleanId;
    let inferredSpeaker = 'Hữu Thọ';

    if (cleanId.startsWith('nam_')) {
      inferredCode = cleanId.replace(/^nam_/, '');
    } else if (cleanId.startsWith('huu_tho_')) {
      inferredCode = cleanId.replace(/^huu_tho_/, '');
    } else if (cleanId.startsWith('nu_')) {
      inferredCode = cleanId.replace(/^nu_/, '');
    }

    // Tìm từ tương ứng từ code: ưu tiên codeToWordMap, sau đó dùng decodeVnWord
    let inferredWord = codeToWordMap.get(inferredCode.toLowerCase()) || decodeVnWord(inferredCode);
    if (!inferredWord) inferredWord = inferredCode;

    if (!docByPublicId.has(publicId) && !docByCode.has(inferredCode.toLowerCase())) {
      newAssetsToAdd.push({
        word: inferredWord.toLowerCase(),
        code: inferredCode,
        cloudinaryPublicId: publicId,
        audioUrl: secureUrl,
        speaker: inferredSpeaker,
        gender: 'male',
        duration,
        format: asset.format || 'wav',
        bytes: asset.bytes || null,
        source: 'cloudinary_scan',
        createdAt: asset.created_at ? new Date(asset.created_at) : now,
        updatedAt: now,
      });
      // Đánh dấu để tránh lặp
      docByPublicId.set(publicId, true);
      docByCode.set(inferredCode.toLowerCase(), true);
    }
  }

  console.log(`✓ Phát hiện ${newAssetsToAdd.length} file âm thanh mới trên Cloudinary cần nạp vào DB.`);

  if (newAssetsToAdd.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < newAssetsToAdd.length; i += batchSize) {
      const batch = newAssetsToAdd.slice(i, i + batchSize);
      await collection.insertMany(batch, { ordered: false });
    }
    console.log(`✓ Đã nạp thành công ${newAssetsToAdd.length} bản ghi mới vào collection "Audio"!`);
  }

  // 4. Chuẩn hóa 100% speaker trong MongoDB thành "Hữu Thọ"
  const fixRes = await collection.updateMany(
    { speaker: { $ne: 'Hữu Thọ' } },
    { $set: { speaker: 'Hữu Thọ' } }
  );
  if (fixRes.modifiedCount > 0) {
    console.log(`✓ Đã chuẩn hóa ${fixRes.modifiedCount} bản ghi về đúng giọng "Hữu Thọ".`);
  }

  // 5. Cập nhật lại audioUrl từ Cloudinary nếu tài nguyên nào có URL mới
  const cloudMap = new Map();
  for (const a of cloudAssets) {
    cloudMap.set(a.public_id, a.secure_url);
    const base = a.public_id.replace(/^.*[\\\/]/, '');
    cloudMap.set(base, a.secure_url);
  }

  // 6. Đọc lại danh sách đầy đủ nhất từ MongoDB để đồng bộ vào public/corpus/manifest.json
  const allDocs = await collection.find({}).sort({ word: 1 }).toArray();
  console.log(`4. Tổng số bản ghi âm trong MongoDB Atlas hiện tại: ${allDocs.length}`);

  const manifestWords = allDocs.map((doc) => {
    const directUrl = cloudMap.get(doc.cloudinaryPublicId) || cloudMap.get(doc.code) || doc.audioUrl;
    return {
      id: doc._id.toString(),
      word: doc.word,
      code: doc.code,
      cloudinaryPublicId: doc.cloudinaryPublicId,
      file: `${doc.code}.wav`,
      audioUrl: directUrl,
      speaker: 'Hữu Thọ',
      duration: doc.duration || 0.45,
    };
  });

  const manifestData = {
    name: 'Vietnamese Syllables Speech Dataset (Cloudinary + MongoDB)',
    total: manifestWords.length,
    updatedAt: new Date().toISOString(),
    source: 'mongodb',
    words: manifestWords,
  };

  const manifestPath = 'public/corpus/manifest.json';
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8');
  console.log(`✓ Đã cập nhật file "${manifestPath}" với đầy đủ ${manifestWords.length} từ vựng!`);

  await client.close();
  console.log('=== HOÀN TẤT ĐỒNG BỘ 100% ===');
}

main().catch((err) => {
  console.error('Lỗi khi đồng bộ:', err);
  process.exit(1);
});
