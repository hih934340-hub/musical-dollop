// ============================================================
// OMEGA BOT v900 — AUTOMATIC MEMBER BOOSTER & SCAM DETECTOR
// ============================================================

const express = require('express');
const { Telegraf, session, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jsQR = require('jsqr');
const Jimp = require('jimp');

// ==================== CONFIGURATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN || '8840411754:AAHyJLmiPLehUMsqFPD1AQj50DXzhcfy8qA';
const ADMIN_ID = Number(process.env.ADMIN_ID) || 7757046138;
const MAIN_GROUP_LINK = 'https://t.me/checkscamvip2026';
const DB_FILE = path.join(__dirname, 'database.json');

// ==================== PERSISTENT DATABASE ====================
let db = {
  groups: {}, // groupId -> { id, title, memberCount }
  users: [],  // Danh sách user ID dùng bot
  bannedUsers: [], // Danh sách user ID bị khóa chức năng
  scamBlacklist: {}, 
  stats: { totalPulled: 0, totalSpamGroups: 0, scamSearches: 0, imageScans: 0, groupScans: 0 }
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.groups) db.groups = {};
      if (!db.users) db.users = [];
      if (!db.bannedUsers) db.bannedUsers = [];
      if (!db.scamBlacklist) db.scamBlacklist = {};
      if (!db.stats) db.stats = { totalPulled: 0, totalSpamGroups: 0, scamSearches: 0, imageScans: 0, groupScans: 0 };
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error('⚠️ Lỗi tải database:', err.message);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ Lỗi lưu database:', err.message);
  }
}

loadDatabase();

function registerUser(userId) {
  if (userId && !db.users.includes(userId)) {
    db.users.push(userId);
    saveDatabase();
  }
}

function cleanKey(input) {
  return String(input || '').trim().toLowerCase().replace(/[@\s-]/g, '');
}

function searchScam(query) {
  const key = cleanKey(query);
  if (!key || key.length < 3) return null;

  for (const itemKey in db.scamBlacklist) {
    const cleanItem = cleanKey(itemKey);
    if (cleanItem === key || cleanItem.includes(key) || key.includes(cleanItem)) {
      return db.scamBlacklist[itemKey];
    }
  }
  return null;
}

// ==================== ENGINE SETUP ====================
const app = express();
const bot = new Telegraf(BOT_TOKEN);

bot.use(session({
  defaultSession: () => ({ action: null, waitingInput: false, tempData: {} })
}));

// Middleware kiểm tra User bị khóa (Banned Check)
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (userId && db.bannedUsers.includes(userId) && userId !== ADMIN_ID) {
    if (ctx.type === 'callback_query') ctx.answerCbQuery('⛔ Tài khoản của bạn đã bị KHÓA toàn bộ chức năng!', { show_alert: true });
    else ctx.reply('⛔ **Tài khoản của bạn đã bị Admin KHÓA toàn bộ chức năng!**');
    return;
  }
  return next();
});

// Tự động lưu nhóm khi Bot được thêm vào nhóm mới
bot.on(['new_chat_members', 'group_chat_created', 'supergroup_chat_created'], async (ctx) => {
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    let count = 0;
    try {
      count = await bot.telegram.getChatMembersCount(ctx.chat.id);
    } catch (e) {}

    db.groups[ctx.chat.id] = {
      id: ctx.chat.id,
      title: ctx.chat.title,
      username: ctx.chat.username || null,
      memberCount: count,
      addedAt: new Date().toISOString()
    };
    saveDatabase();
  }
});

// ==================== KEYBOARDS ====================
function getMainMenu(isAdmin) {
  const buttons = [
    [
      Markup.button.callback('🚀 KÉO MEMBER (RẢI LINK EVENT)', 'menu_invite_spam'),
      Markup.button.callback('📊 THỐNG KÊ RẢI MEM', 'menu_stats')
    ],
    [
      Markup.button.callback('🔍 CHECK SCAM (TEXT/SĐT/STK)', 'menu_check_scam'),
      Markup.button.callback('🖼️ CHECK ẢNH / QR / BILL', 'menu_check_image')
    ],
    [
      Markup.button.url('📢 THAM GIA GROUP EVENT VIP', MAIN_GROUP_LINK)
    ]
  ];

  if (isAdmin) {
    buttons.push(
      [Markup.button.callback('🔒 KHÓA USER', 'menu_block_user'), Markup.button.callback('🔓 MỞ KHÓA USER', 'menu_unblock_user')],
      [Markup.button.callback('➕ THÊM SCAMMER', 'menu_add_scam'), Markup.button.callback('📋 DANH SÁCH NHÓM', 'menu_list')]
    );
  }

  return Markup.inlineKeyboard(buttons);
}

// ==================== BOT HANDLERS ====================
bot.start(async (ctx) => {
  if (ctx.chat.type !== 'private') return ctx.reply('⚠️ Vui lòng chat riêng với Bot để sử dụng!');
  
  registerUser(ctx.from.id);
  const isAdmin = ctx.from.id === ADMIN_ID;
  if (!ctx.session) ctx.session = {};
  ctx.session.action = null;
  ctx.session.waitingInput = false;

  await ctx.replyWithMarkdown(
    `🐱 **OMEGA BOT v900 — AUTOMATIC MEMBER BOOSTER**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 **Xin chào ${ctx.from.first_name}!**\n` +
    `⚡ Hệ thống rải Link Event & Kéo Member tự động:\n` +
    `• 🚀 **Kéo Member:** Tự động gửi bài quảng cáo sự kiện vào tất cả các nhóm bot tham gia\n` +
    `• 🔍 **Check Scam:** Kiểm tra STK, SĐT, Hình ảnh & QR Code lừa đảo\n` +
    `━━━━━━━━━━━━━━━━━━━━━`,
    getMainMenu(isAdmin)
  );
});

// LỆNH KÉO MEMBER: RẢI LINK VÀO TẤT CẢ CÁC NHÓM
bot.action('menu_invite_spam', async (ctx) => {
  await ctx.answerCbQuery();
  const isAdmin = ctx.from.id === ADMIN_ID;

  const groupIds = Object.keys(db.groups);
  if (groupIds.length === 0) {
    return ctx.reply('⚠️ **Bot chưa tham gia nhóm nào!**\nHãy thêm Bot vào các nhóm Telegram (và cấp quyền Admin/Gửi tin nhắn) để sử dụng tính năng kéo member.', getMainMenu(isAdmin));
  }

  await ctx.reply('⏳ **ĐANG TIẾN HÀNH RẢI LINK KÉO MEMBER VÀO CÁC NHÓM...**\nVui lòng chờ trong giây lát!');

  const spamText = 
    `🎉 **ĐANG CÓ EVENT VIP Ở NHÓM:**\n` +
    `👉 Tham gia ngay để nhận quà & cập nhật tin tức: ${MAIN_GROUP_LINK}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 *Nhóm kiểm tra lừa đảo & Sự kiện VIP uy tín nhất Telegram!*`;

  const spamKeyboard = Markup.inlineKeyboard([
    [Markup.button.url('🔥 THAM GIA EVENT NGAY', MAIN_GROUP_LINK)]
  ]);

  let successCount = 0;
  let failCount = 0;
  let estimatedMembersReached = 0;

  for (const groupId of groupIds) {
    try {
      await bot.telegram.sendMessage(groupId, spamText, {
        parse_mode: 'Markdown',
        ...spamKeyboard
      });
      successCount++;
      estimatedMembersReached += (db.groups[groupId].memberCount || 50);
    } catch (err) {
      failCount++;
    }
  }

  db.stats.totalSpamGroups += successCount;
  db.stats.totalPulled += estimatedMembersReached;
  saveDatabase();

  const reportMsg = 
    `✅ **KẾT QUẢ RẢI LINK KÉO MEMBER**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 **Đang có Event ở nhóm:** ${MAIN_GROUP_LINK}\n` +
    `🚀 **Rải thành công:** **${successCount}** nhóm\n` +
    `❌ **Rải thất bại:** **${failCount}** nhóm (thiếu quyền/bị kick)\n` +
    `👥 **Ước tính số người tiếp cận:** ~**${estimatedMembersReached}** thành viên\n` +
    `📊 **Tổng số người Bot đã kéo/tiếp cận được:** **${db.stats.totalPulled}** người\n` +
    `━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(reportMsg, getMainMenu(isAdmin));
});

// ==================== ADMIN: KHÓA / MỜ KHÓA USER ====================
bot.action('menu_block_user', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  ctx.session.action = 'input_block_user';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🔒 **KHÓA NGƯỜI DÙNG**\n\nNhập Telegram **User ID** cần khóa toàn bộ chức năng:');
});

bot.action('menu_unblock_user', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  ctx.session.action = 'input_unblock_user';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🔓 **MỜ KHÓA NGƯỜI DÙNG**\n\nNhập Telegram **User ID** cần mở khóa:');
});

bot.action('menu_list', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  await ctx.answerCbQuery();
  const groupKeys = Object.keys(db.groups);
  if (groupKeys.length === 0) {
    return ctx.reply('📋 Bot chưa tham gia nhóm nào!');
  }
  let listMsg = `📋 **DANH SÁCH NHÓM BOT ĐÃ VÀO (${groupKeys.length}):**\n━━━━━━━━━━━━━━━━━━━━━\n`;
  groupKeys.forEach((id, idx) => {
    const g = db.groups[id];
    listMsg += `${idx + 1}. **${g.title}** (\`${g.id}\`) - Thành viên: ~${g.memberCount || 0}\n`;
  });
  await ctx.replyWithMarkdown(listMsg, getMainMenu(true));
});

bot.action('menu_add_scam', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  ctx.session.action = 'add_scam_key';
  ctx.session.waitingInput = true;
  ctx.session.tempData = {};
  await ctx.answerCbQuery();
  await ctx.reply('➕ **THÊM SCAMMER MỚI**\n\nNhập **STK / SĐT / Username / ID** của đối tượng lừa đảo:');
});

// ==================== CHECK SCAM TEXT & IMAGE ====================
bot.action('menu_check_scam', async (ctx) => {
  ctx.session.action = 'check_scam';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🔍 **NHẬP THÔNG TIN CẦN CHECK:**\n\nGửi STK ngân hàng, Số điện thoại hoặc Telegram Username/ID.');
});

bot.action('menu_check_image', async (ctx) => {
  ctx.session.action = 'check_image';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🖼️ **GỬI HÌNH ẢNH CẦN CHECK:**\n\nHãy gửi ảnh QR ngân hàng, bill chuyển khoản hoặc ảnh tin nhắn.');
});

bot.on('photo', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  registerUser(ctx.from.id);

  const isAdmin = ctx.from.id === ADMIN_ID;
  db.stats.imageScans++;
  saveDatabase();

  await ctx.reply('⏳ **Đang tải và quét dữ liệu từ hình ảnh...**');

  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileUrl = await bot.telegram.getFileLink(photo.file_id);

    const response = await axios.get(fileUrl.href, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);

    const image = await Jimp.read(imageBuffer);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const imageData = new Uint8ClampedArray(image.bitmap.data);

    const qrCode = jsQR(imageData, width, height);

    let detectedInfo = [];
    let scamResult = null;

    if (qrCode && qrCode.data) {
      detectedInfo.push(`📌 **Mã QR:** \`${qrCode.data}\``);
      scamResult = searchScam(qrCode.data);
    }

    const caption = ctx.message.caption || '';
    if (caption) {
      const captionScam = searchScam(caption);
      if (captionScam) scamResult = captionScam;
    }

    if (scamResult) {
      await ctx.replyWithMarkdown(
        `🚨 **CẢNH BÁO: PHÁT HIỆN DẤU HIỆU LỪA ĐẢO TRONG ẢNH!**\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        (detectedInfo.length > 0 ? detectedInfo.join('\n') + '\n' : '') +
        `⚠️ **Thông tin bị trùng:** \`${scamResult.key}\`\n` +
        `❌ **Lý do cảnh báo:** ${scamResult.reason}\n` +
        `🔗 **Bằng chứng:** ${scamResult.proof || 'Không có'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛑 **CẢNH BÁO:** TUYỆT ĐỐI KHÔNG CHUYỂN TIỀN HOẶC GIAO DỊCH!`,
        getMainMenu(isAdmin)
      );
    } else {
      await ctx.replyWithMarkdown(
        `✅ **KẾT QUẢ QUÉT ẢNH**\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        (detectedInfo.length > 0 ? detectedInfo.join('\n') + '\n\n' : '') +
        `📌 Không phát hiện dữ liệu nằm trong danh sách đen lừa đảo.\n\n` +
        `💡 *Lưu ý: Luôn kiểm tra kỹ tên chủ tài khoản trước khi chuyển khoản!*`,
        getMainMenu(isAdmin)
      );
    }

    ctx.session.waitingInput = false;
  } catch (err) {
    await ctx.reply(`❌ Lỗi xử lý ảnh: ${err.message}`, getMainMenu(isAdmin));
  }
});

// ==================== INPUT HANDLER ====================
bot.on('text', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  registerUser(ctx.from.id);

  const input = ctx.message.text.trim();
  const isAdmin = ctx.from.id === ADMIN_ID;

  // Luồng Khóa User ID (Admin)
  if (isAdmin && ctx.session?.action === 'input_block_user') {
    const targetId = Number(input);
    if (isNaN(targetId)) return await ctx.reply('❌ User ID phải là số!');
    if (!db.bannedUsers.includes(targetId)) {
      db.bannedUsers.push(targetId);
      saveDatabase();
    }
    ctx.session.action = null;
    ctx.session.waitingInput = false;
    return await ctx.reply(`🔒 **Đã KHÓA thành công User ID:** \`${targetId}\`\nNgười dùng này không thể dùng bot nữa.`, getMainMenu(true));
  }

  // Luồng Mở Khóa User ID (Admin)
  if (isAdmin && ctx.session?.action === 'input_unblock_user') {
    const targetId = Number(input);
    if (isNaN(targetId)) return await ctx.reply('❌ User ID phải là số!');
    db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
    saveDatabase();
    ctx.session.action = null;
    ctx.session.waitingInput = false;
    return await ctx.reply(`🔓 **Đã MỞ KHÓA thành công User ID:** \`${targetId}\``, getMainMenu(true));
  }

  // Luồng Thêm Scam (Admin)
  if (isAdmin && ctx.session?.action === 'add_scam_key') {
    ctx.session.tempData.key = input;
    ctx.session.action = 'add_scam_reason';
    return await ctx.reply('📝 Nhập **LÝ DO / HÀNH VI LỪA ĐẢO**:');
  }

  if (isAdmin && ctx.session?.action === 'add_scam_reason') {
    ctx.session.tempData.reason = input;
    ctx.session.action = 'add_scam_proof';
    return await ctx.reply('🔗 Nhập **LINK BẰNG CHỨNG / ẢNH** (Hoặc gõ `không` để bỏ qua):');
  }

  if (isAdmin && ctx.session?.action === 'add_scam_proof') {
    const proof = input.toLowerCase() === 'không' ? 'Không có' : input;
    const key = ctx.session.tempData.key;
    const cleanK = cleanKey(key);

    db.scamBlacklist[cleanK] = {
      key: key,
      reason: ctx.session.tempData.reason,
      proof: proof,
      addedBy: ctx.from.id,
      date: new Date().toLocaleDateString('vi-VN')
    };

    saveDatabase();
    ctx.session.action = null;
    ctx.session.waitingInput = false;
    return await ctx.replyWithMarkdown(`✅ **Đã thêm thành công Scammer vào Blacklist!**\n📌 Key: \`${key}\``, getMainMenu(true));
  }

  // Luồng Check Scam Text
  if (ctx.session?.waitingInput && ctx.session.action === 'check_scam') {
    ctx.session.waitingInput = false;
    db.stats.scamSearches++;
    saveDatabase();

    const result = searchScam(input);
    if (result) {
      return await ctx.replyWithMarkdown(
        `🚨 **CẢNH BÁO: PHÁT HIỆN SCAMMER!**\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 **Thông tin:** \`${result.key}\`\n` +
        `❌ **Lý do:** ${result.reason}\n` +
        `🔗 **Bằng chứng:** ${result.proof || 'Không có'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛑 **CẢNH BÁO:** KHÔNG GIAO DỊCH!`,
        getMainMenu(isAdmin)
      );
    } else {
      return await ctx.replyWithMarkdown(
        `✅ **CHƯA CÓ GHI NHẬN XẤU**\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `🔍 Từ khóa: \`${input}\`\n` +
        `📌 Không có thông tin trong danh sách lừa đảo.`,
        getMainMenu(isAdmin)
      );
    }
  }
});

// ==================== STATS ACTION ====================
bot.action('menu_stats', async (ctx) => {
  await ctx.answerCbQuery();
  const msg = 
    `📊 **THỐNG KÊ KÉO MEMBER & BOT**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 Tổng lượt rải nhóm thành công: **${db.stats.totalSpamGroups}**\n` +
    `👥 Số người ước tính tiếp cận/kéo được: **${db.stats.totalPulled}** người\n` +
    `👥 Số người dùng đăng ký Bot: **${db.users.length}**\n` +
    `🔒 Số User bị khóa: **${db.bannedUsers.length}**\n` +
    `📋 Số nhóm Bot đang có mặt: **${Object.keys(db.groups).length}**\n` +
    `🚨 Dữ liệu Scammer: **${Object.keys(db.scamBlacklist).length}**\n` +
    `━━━━━━━━━━━━━━━━━━━━━`;
  await ctx.replyWithMarkdown(msg, getMainMenu(ctx.from.id === ADMIN_ID));
});

// ==================== SERVER LAUNCH ====================
app.use(express.json());
app.get('/', (req, res) => res.send('OMEGA BOT v900 RUNNING'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy trên Port ${PORT}`));

bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('🤖 OMEGA BOT v900 MEMBER BOOSTER READY'))
  .catch((err) => console.error('❌ Lỗi khởi động:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
