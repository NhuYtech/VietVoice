import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'wximbfoz',
  api_key: process.env.CLOUDINARY_API_KEY || '997752814949472',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'i7WA0ilQjUuYbOJnNeWdUP8tZ7M',
  secure: true
});

const app = express();
const port = parseInt(process.env.PORT || '5000', 10);
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'VietVoice';

app.use(cors());
app.use(express.json({ limit: '20mb' }));

let client = null;
let db = null;
let audioCollection = null;

// Cache manifest trong RAM để tăng tốc tối đa cho module TTS phía client
let cachedManifestData = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

// Nạp sẵn dữ liệu 6.674 từ vào RAM server ngay khi khởi động
try {
  const localManifestPath = path.join(process.cwd(), 'public', 'corpus', 'manifest.json');
  if (fs.existsSync(localManifestPath)) {
    const raw = fs.readFileSync(localManifestPath, 'utf-8');
    cachedManifestData = JSON.parse(raw);
    lastCacheTime = Date.now();
    console.log(`[Cache] Đã nạp sẵn ${cachedManifestData.words?.length || 0} từ vào RAM server!`);
  }
} catch (e) {
  console.warn('[Cache] Lỗi nạp manifest local:', e.message);
}

async function connectToMongo() {
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);
    audioCollection = db.collection('Audio');
    console.log(`[MongoDB] Đã kết nối thành công tới database "${dbName}"`);
  } catch (err) {
    console.error('[MongoDB] Lỗi kết nối:', err.message);
  }
}

// Middleware kiểm tra database
app.use((req, res, next) => {
  if (!audioCollection) {
    return res.status(503).json({ error: 'Database chưa sẵn sàng, vui lòng thử lại sau.' });
  }
  next();
});

// 1. Health check & Trạng thái kết nối
app.get('/api/health', async (req, res) => {
  try {
    const count = await audioCollection.estimatedDocumentCount();
    res.json({
      status: 'ok',
      database: 'connected',
      dbName,
      totalAudios: count,
      cloudinaryCloud: process.env.CLOUDINARY_CLOUD_NAME || 'wximbfoz',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// 2. Lấy toàn bộ manifest nhẹ cho TTS engine (có in-memory cache)
app.get('/api/audio/manifest', async (req, res) => {
  try {
    const forceReload = req.query.reload === 'true';
    const now = Date.now();

    if (!forceReload && cachedManifestData && now - lastCacheTime < CACHE_TTL_MS) {
      return res.json(cachedManifestData);
    }

    const docs = await audioCollection
      .find({}, {
        projection: {
          word: 1,
          code: 1,
          cloudinaryPublicId: 1,
          audioUrl: 1,
          speaker: 1,
          duration: 1
        }
      })
      .toArray();

    const words = docs.map((d) => ({
      id: d._id.toString(),
      word: d.word,
      code: d.code,
      cloudinaryPublicId: d.cloudinaryPublicId,
      file: `${d.code}.wav`,
      audioUrl: d.audioUrl,
      speaker: d.speaker || 'Hữu Thọ',
      duration: d.duration || 0.45,
    }));

    cachedManifestData = {
      name: 'Vietnamese Syllables Speech Dataset (Cloudinary + MongoDB)',
      total: words.length,
      source: 'mongodb',
      words
    };
    lastCacheTime = now;

    res.json(cachedManifestData);
  } catch (err) {
    console.error('Lỗi khi lấy manifest:', err);
    res.status(500).json({ error: 'Không thể lấy dữ liệu manifest' });
  }
});

// 3. Tìm kiếm và phân trang danh sách Audio (cho CorpusView)
app.get('/api/audio', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const q = (req.query.q || '').trim().toLowerCase();
    const speaker = req.query.speaker;

    const filter = {};
    if (speaker && speaker !== 'all') {
      filter.speaker = new RegExp(`^${speaker}$`, 'i');
    }

    if (q) {
      filter.$or = [
        { word: { $regex: q, $options: 'i' } },
        { code: { $regex: q, $options: 'i' } },
        { cloudinaryPublicId: { $regex: q, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      audioCollection
        .find(filter)
        .sort({ word: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      audioCollection.countDocuments(filter)
    ]);

    res.json({
      items: items.map((it) => ({
        ...it,
        id: it._id.toString()
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Lỗi khi truy vấn audio:', err);
    res.status(500).json({ error: 'Không thể lấy danh sách audio' });
  }
});

// 4. Lấy chi tiết âm thanh của 1 từ cụ thể
app.get('/api/audio/word/:word', async (req, res) => {
  try {
    const word = req.params.word.trim().toLowerCase();
    const speaker = req.query.speaker || 'Hữu Thọ';

    const item = await audioCollection.findOne({
      $or: [
        { word, speaker: new RegExp(`^${speaker}$`, 'i') },
        { code: word, speaker: new RegExp(`^${speaker}$`, 'i') },
        { cloudinaryPublicId: word, speaker: new RegExp(`^${speaker}$`, 'i') }
      ]
    });

    if (!item) {
      return res.status(404).json({ error: `Không tìm thấy từ "${word}"` });
    }

    res.json({
      ...item,
      id: item._id.toString()
    });
  } catch (err) {
    console.error('Lỗi khi tìm từ:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// 4b. Nhận file thu âm từ client, upload lên Cloudinary và lưu vào MongoDB Atlas
app.post('/api/audio/upload', async (req, res) => {
  try {
    const { word, speaker, code, audioBase64, duration } = req.body;
    if (!word || !audioBase64) {
      return res.status(400).json({ error: 'Thiếu word hoặc dữ liệu âm thanh' });
    }

    const cleanWord = word.trim().toLowerCase();
    const docCode = code || cleanWord;
    const speakerLabel = (speaker || 'Hữu Thọ').trim();
    const safeSpkId = speakerLabel.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'huu_tho';
    const publicId = `recordings/${safeSpkId}_${docCode.replace(/\+/g, '_')}`;

    let audioUrl = '';
    let uploadedPublicId = publicId;

    try {
      const uploadResult = await cloudinary.uploader.upload(audioBase64, {
        resource_type: 'video',
        public_id: publicId,
        folder: 'VietVoice_Corpus',
        overwrite: true
      });
      audioUrl = uploadResult.secure_url;
      uploadedPublicId = uploadResult.public_id;
      console.log(`[Cloudinary] Đã upload thành công từ "${cleanWord}":`, audioUrl);
    } catch (cldErr) {
      console.warn('[Cloudinary] Lỗi upload Cloudinary, lưu data URI dự phòng:', cldErr.message);
      audioUrl = audioBase64;
    }

    const doc = {
      word: cleanWord,
      code: docCode,
      cloudinaryPublicId: uploadedPublicId,
      audioUrl,
      speaker: speakerLabel,
      gender: 'male',
      duration: Number(duration) || 0.45,
      format: 'wav',
      source: 'record',
      updatedAt: new Date()
    };

    const result = await audioCollection.updateOne(
      { word: cleanWord, speaker: doc.speaker },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    // Cập nhật ngay vào cache RAM server
    if (cachedManifestData && Array.isArray(cachedManifestData.words)) {
      const existingIdx = cachedManifestData.words.findIndex(
        (w) => w.word === cleanWord && (w.speaker || '').toLowerCase() === doc.speaker.toLowerCase()
      );
      const newWordItem = {
        id: result.upsertedId ? result.upsertedId.toString() : 'rec-' + Date.now(),
        word: cleanWord,
        code: docCode,
        file: `${docCode}.wav`,
        audioUrl,
        speaker: doc.speaker.toLowerCase(),
        duration: doc.duration
      };
      if (existingIdx !== -1) {
        cachedManifestData.words[existingIdx] = newWordItem;
      } else {
        cachedManifestData.words.push(newWordItem);
        cachedManifestData.total = cachedManifestData.words.length;
      }
    }

    console.log(`[MongoDB] Đã lưu thành công từ mới "${cleanWord}" (${speakerLabel}) vào database!`);
    res.json({ success: true, audioUrl, doc });
  } catch (err) {
    console.error('Lỗi khi lưu audio:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Thêm / cập nhật bản ghi âm thanh mới (ví dụ người dùng thu âm hoặc upload)
app.post('/api/audio', async (req, res) => {
  try {
    const { word, code, audioUrl, speaker, duration, format, cloudinaryPublicId } = req.body;
    if (!word || !audioUrl) {
      return res.status(400).json({ error: 'Thiếu word hoặc audioUrl' });
    }

    const cleanWord = word.trim().toLowerCase();
    const doc = {
      word: cleanWord,
      code: code || cleanWord,
      cloudinaryPublicId: cloudinaryPublicId || code || cleanWord,
      audioUrl,
      speaker: speaker || 'Hữu Thọ',
      gender: 'male',
      duration: Number(duration) || 0.45,
      format: format || 'wav',
      source: 'upload',
      updatedAt: new Date()
    };

    const result = await audioCollection.updateOne(
      { word: cleanWord, speaker: doc.speaker },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );

    // Xóa cache để lần gọi tiếp theo nạp lại
    cachedManifestData = null;

    res.json({ success: true, upsertedId: result.upsertedId, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Lỗi khi lưu audio:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Xóa bản ghi
app.delete('/api/audio/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await audioCollection.deleteOne({ _id: new ObjectId(id) });
    cachedManifestData = null;
    res.json({ success: result.deletedCount > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Khởi động server
connectToMongo().then(() => {
  app.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`✓ VietVoice Backend Server đang chạy tại: http://localhost:${port}`);
    console.log(`✓ Kết nối MongoDB: ${uri}/${dbName}`);
    console.log(`✓ Cloudinary Cloud: ${process.env.CLOUDINARY_CLOUD_NAME || 'wximbfoz'}`);
    console.log(`=======================================================`);
  });
});

