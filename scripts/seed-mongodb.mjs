import fs from 'node:fs';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.DB_NAME || 'VietVoice';
const key = process.env.CLOUDINARY_API_KEY;
const sec = process.env.CLOUDINARY_API_SECRET;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'wximbfoz';

async function seed() {
  console.log('--- KHỞI TẠO ĐỒNG BỘ ĐẦY ĐỦ 6.674 TÀI NGUYÊN CLOUDINARY -> MONGODB ---');
  console.log(`Connecting to MongoDB: ${uri}/${dbName}...`);
  
  const client = new MongoClient(uri);
  await client.connect();
  console.log('✓ Kết nối MongoDB thành công!');

  const db = client.db(dbName);
  const collection = db.collection('Audio');

  // Đọc danh mục manifest.json
  const manifestPath = 'public/corpus/manifest.json';
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Không tìm thấy file ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`✓ Đã đọc manifest: ${manifest.words.length} mục`);

  // Quét danh sách tài nguyên trên Cloudinary để lấy thông tin chi tiết
  console.log('Đang đồng bộ danh sách assets từ Cloudinary...');
  const auth = Buffer.from(`${key}:${sec}`).toString('base64');
  let cursor = null;
  const cloudMap = new Map();

  do {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/video?max_results=500${cursor ? `&next_cursor=${cursor}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    const data = await res.json();
    if (!data.resources) {
      console.warn('Lỗi khi tải resources Cloudinary:', data);
      break;
    }
    for (const r of data.resources) {
      cloudMap.set(r.public_id, r);
    }
    cursor = data.next_cursor;
    process.stdout.write(`Đã lấy ${cloudMap.size} assets từ Cloudinary...\r`);
  } while (cursor);

  console.log(`\n✓ Quét xong Cloudinary: Tìm thấy ${cloudMap.size} files audio.`);

  // Xóa toàn bộ dữ liệu cũ trong collection Audio để nạp lại chuẩn xác 100% không trùng lặp
  console.log('Làm sạch collection "Audio" để đồng bộ mới...');
  await collection.deleteMany({});
  try {
    await collection.dropIndexes();
  } catch (e) {
    // ignore if no indexes
  }

  // Chuẩn bị bulk operations dựa trên mã file (code) để giữ đủ cả các bản ghi âm thứ hai (_02)
  const now = new Date();
  const docs = [];

  for (const item of manifest.words) {
    const code = item.code || item.file.replace(/^wavs\//, '').replace(/\.wav$/, '');
    const publicId = item.cloudinaryPublicId || code.replace(/\+/g, '_');
    const cloudAsset = cloudMap.get(publicId);

    const audioUrl = cloudAsset?.secure_url || item.audioUrl || `https://res.cloudinary.com/${cloudName}/video/upload/${publicId}.wav`;
    const duration = typeof item.duration === 'number' && !isNaN(item.duration) ? item.duration : 0.45;

    docs.push({
      word: item.word.trim().toLowerCase(),
      code,
      cloudinaryPublicId: publicId,
      audioUrl,
      speaker: 'Nam',
      gender: 'male',
      duration,
      format: cloudAsset?.format || 'wav',
      bytes: cloudAsset?.bytes || null,
      source: 'cloudinary',
      createdAt: cloudAsset?.created_at ? new Date(cloudAsset.created_at) : now,
      updatedAt: now
    });
  }

  console.log(`Đang ghi toàn bộ ${docs.length} bản ghi vào collection "Audio"...`);
  
  // Chia nhỏ theo batch 1000 items
  const batchSize = 1000;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await collection.insertMany(batch, { ordered: false });
    console.log(`- Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} docs đã ghi.`);
  }

  // Tạo index tìm kiếm nhanh
  console.log('Đang thiết lập Index cho collection "Audio"...');
  await collection.createIndex({ code: 1, speaker: 1 }, { unique: true });
  await collection.createIndex({ cloudinaryPublicId: 1 });
  await collection.createIndex({ word: 1 });
  await collection.createIndex({ speaker: 1 });
  console.log('✓ Thiết lập các index thành công!');

  const count = await collection.countDocuments();
  console.log(`\n========================================`);
  console.log(`✓ THÀNH CÔNG!`);
  console.log(`- Tổng số documents trong VietVoice.Audio: ${count}`);
  console.log(`========================================\n`);

  await client.close();
}

seed().catch((err) => {
  console.error('Lỗi khi nạp dữ liệu vào MongoDB:', err);
  process.exit(1);
});
