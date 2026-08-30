// ============================================================
// OMEGA BOT v900 — AI MULTIMEDIA & GROUP SCAM DETECTOR
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
const CHECK_SCAM_GROUP = '@checkscamvip2026'; // Group Check Scam cố định
const DB_FILE = path.join(__dirname, 'database.json');

// ==================== PERSISTENT DATABASE ====================
let db = {
  groups: {},
  users: [], // Lưu danh sách user ID dùng bot để broadcast
  protected: { usernames: ['ongvuaphantich'], ids: [ADMIN_ID] },
  scamBlacklist: {}, // key -> { key, reason, addedBy, date, proof }
  stats: { totalPulled: 0, totalBanned: 0, scamSearches: 0, imageScans: 0, groupScans: 0 }
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.scamBlacklist) db.scamBlacklist = {};
      if (!db.users) db.users = [];
      if (!db.protected) db.protected = { usernames: ['ongvuaphantich'], ids: [ADMIN_ID] };
      if (!db.stats) db.stats = { totalPulled: 0, totalBanned: 0, scamSearches: 0, imageScans: 0, groupScans: 0 };
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

// Tự động ghi nhận Group & Member
bot.on(['new_chat_members', 'group_chat_created', 'supergroup_chat_created'], (ctx) => {
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    db.groups[ctx.chat.id] = {
      id: ctx.chat.id,
      title: ctx.chat.title,
      username: ctx.chat.username || null,
      addedAt: new Date().toISOString()
    };
    saveDatabase();
  }
});

// ==================== HÀM TỰ ĐỘNG THÔNG BÁO SCAM ====================
async function notifyScamAlert(scamData, detectedSource = 'Hệ thống') {
  const alertText = 
    `🚨 **CẢNH BÁO TỰ ĐỘNG: PHÁT HIỆN SCAMMER MỚI!**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 **Thông tin đối tượng:** \`${scamData.key}\`\n` +
    `❌ **Hành vi/Lý do:** ${scamData.reason}\n` +
    `🔗 **Bằng chứng:** ${scamData.proof || 'Không có'}\n` +
    `📌 **Nguồn phát hiện:** ${detectedSource}\n` +
    `⏰ **Thời gian:** ${scamData.date || new Date().toLocaleDateString('vi-VN')}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛑 **CẢNH BÁO:** Tuyệt đối không giao dịch với thông tin trên!\n` +
    `👉 Gia nhập nhóm check scam: https://t.me/checkscamvip2026`;

  const groupKeyboard = Markup.inlineKeyboard([
    [Markup.button.url('📢 THAM GIA GROUP CHECK SCAM', 'https://t.me/checkscamvip2026')]
  ]);

  // 1. Tự động gửi bài vào Group Check Scam
  try {
    const sentMsg = await bot.telegram.sendMessage(CHECK_SCAM_GROUP, alertText, { 
      parse_mode: 'Markdown',
      ...groupKeyboard 
    });
    // Lưu ID bài đăng để Admin có thể xóa nếu cần
    if (sentMsg && sentMsg.message_id) {
      scamData.lastMessageId = sentMsg.message_id;
      saveDatabase();
    }
  } catch (err) {
    console.error('⚠️ Không thể tự động gửi bài vào Group Check Scam:', err.message);
  }

  // 2. Broadcast thông báo đến tất cả người dùng Bot để cảnh báo & kéo mem
  for (const userId of db.users) {
    try {
      await bot.telegram.sendMessage(userId, alertText, { 
        parse_mode: 'Markdown',
        ...groupKeyboard 
      });
    } catch (e) {
      // Bỏ qua nếu user đã block bot
    }
  }
}

// ==================== KEYBOARDS ====================
function getMainMenu(isAdmin) {
  const buttons = [
    [
      Markup.button.callback('🔍 CHECK SCAM (TEXT/SĐT/STK)', 'menu_check_scam'),
      Markup.button.callback('🖼️ CHECK ẢNH / QR / BILL', 'menu_check_image')
    ],
    [
      Markup.button.callback('🔗 CHECK LINK GROUP', 'menu_check_group'),
      Markup.button.callback('📊 THỐNG KÊ', 'menu_stats')
    ],
    [
      Markup.button.url('📢 GROUP CHECK SCAM VIP', 'https://t.me/checkscamvip2026')
    ]
  ];

  if (isAdmin) {
    buttons.push(
      [Markup.button.callback('➕ THÊM SCAMMER', 'menu_add_scam'), Markup.button.callback('🗑️ XÓA BÀI ĐĂNG', 'menu_delete_post')],
      [Markup.button.callback('🔨 BAN ALL', 'menu_ban'), Markup.button.callback('📋 DANH SÁCH GROUP', 'menu_list')]
    );
  }

  return Markup.inlineKeyboard(buttons);
}

// ==================== BOT HANDLERS ====================
bot.start(async (ctx) => {
  if (ctx.chat.type !== 'private') return ctx.reply('⚠️ Vui lòng chat riêng với Bot để dùng menu chức năng!');
  
  registerUser(ctx.from.id);
  const isAdmin = ctx.from.id === ADMIN_ID;
  if (!ctx.session) ctx.session = {};
  ctx.session.action = null;
  ctx.session.waitingInput = false;

  await ctx.replyWithMarkdown(
    `🐱 **OMEGA BOT v900 — MULTIMEDIA SCAM DETECTOR**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 **Xin chào ${ctx.from.first_name}!**\n` +
    `⚡ Hệ thống hỗ trợ kiểm tra lừa đảo đa năng:\n` +
    `• 🔤 **Check Text:** SĐT, STK Ngân hàng, Telegram ID\n` +
    `• 🖼️ **Check Ảnh:** Quét QR Code, đọc thông tin bill/ảnh\n` +
    `• 🔗 **Check Link Group:** Phân tích độ an toàn của nhóm\n` +
    `📢 **Channel Check Scam:** @checkscamvip2026\n` +
    `━━━━━━━━━━━━━━━━━━━━━`,
    getMainMenu(isAdmin)
  );
});

// Menu Check Ảnh
bot.action('menu_check_image', async (ctx) => {
  ctx.session.action = 'check_image';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🖼️ **GỬI HÌNH ẢNH CẦN CHECK:**\n\nHãy gửi ảnh QR ngân hàng, bill chuyển khoản hoặc ảnh tin nhắn/bảng giá cần kiểm tra scam.');
});

// Menu Check Link Group
bot.action('menu_check_group', async (ctx) => {
  ctx.session.action = 'check_group';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🔗 **GỬI LINK GROUP / CHANNEL:**\n\nVí dụ: `https://t.me/ten_group` hoặc `@ten_group`');
});

// Menu Check Text Scam
bot.action('menu_check_scam', async (ctx) => {
  ctx.session.action = 'check_scam';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🔍 **NHẬP THÔNG TIN CẦN CHECK:**\n\nGửi STK ngân hàng, Số điện thoại hoặc Telegram Username/ID.');
});

// ==================== ADMIN ACTIONS ====================
bot.action('menu_add_scam', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  ctx.session.action = 'add_scam_key';
  ctx.session.waitingInput = true;
  ctx.session.tempData = {};
  await ctx.answerCbQuery();
  await ctx.reply('➕ **THÊM SCAMMER MỚI**\n\nNhập **STK / SĐT / Username / ID** của đối tượng lừa đảo:');
});

// Admin Xóa Bài Đăng Cảnh Báo
bot.action('menu_delete_post', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  ctx.session.action = 'delete_post_id';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🗑️ **XÓA BÀI ĐĂNG TRONG GROUP CHECK SCAM**\n\nNhập **Message ID** của bài viết cần xóa trong group @checkscamvip2026:');
});

bot.action('menu_list', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  await ctx.answerCbQuery();
  const groupKeys = Object.keys(db.groups);
  if (groupKeys.length === 0) {
    return ctx.reply('📋 Bot chưa lưu danh sách group nào!');
  }
  let listMsg = `📋 **DANH SÁCH GROUP BOT ĐANG CÓ MẶT (${groupKeys.length}):**\n━━━━━━━━━━━━━━━━━━━━━\n`;
  groupKeys.forEach((id, idx) => {
    const g = db.groups[id];
    listMsg += `${idx + 1}. **${g.title}** (\`${g.id}\`)\n`;
  });
  await ctx.replyWithMarkdown(listMsg, getMainMenu(true));
});

bot.action('menu_ban', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  await ctx.answerCbQuery();
  await ctx.reply('🔨 **Đang khởi chạy tiến trình quét và cấm Scammer khỏi các nhóm...**');
  
  let bannedCount = 0;
  const scamKeys = Object.keys(db.scamBlacklist);

  for (const groupId in db.groups) {
    for (const key of scamKeys) {
      if (/^\d+$/.test(key)) {
        try {
          await bot.telegram.banChatMember(groupId, Number(key));
          bannedCount++;
        } catch (e) {}
      }
    }
  }

  db.stats.totalBanned += bannedCount;
  saveDatabase();
  await ctx.reply(`✅ **HOÀN TẤT BAN ALL!**\nĐã cấm tổng cộng **${bannedCount}** lượt vi phạm trong các nhóm.`, getMainMenu(true));
});

// ==================== XỬ LÝ CHECK LINK GROUP ====================
async function analyzeGroupLink(ctx, input) {
  try {
    let clean = input.trim();
    if (clean.includes('t.me/')) {
      clean = clean.split('t.me/')[1].split('/')[0].replace('@', '');
    } else {
      clean = clean.replace('@', '');
    }

    db.stats.groupScans++;
    saveDatabase();

    const chat = await bot.telegram.getChat(`@${clean}`);
    const isScamDb = searchScam(chat.id) || searchScam(chat.username);

    let riskScore = 0;
    let warnings = [];

    if (isScamDb) {
      riskScore += 100;
      warnings.push(`🚨 **CẢNH BÁO ĐỎ:** Group này nằm trong Blacklist Scammer!`);
    }

    const titleLower = (chat.title || '').toLowerCase();
    const suspiciousKeywords = ['admin', 'cskh', 'trung gian', 'chợ', 'quỹ', 'event', 'giftcode', 'uy tín'];
    const hasKey = suspiciousKeywords.some(k => titleLower.includes(k));

    if (hasKey) {
      riskScore += 25;
      warnings.push(`⚠️ Tên nhóm chứa từ khóa nhạy cảm dễ bị mạo danh: *"${chat.title}"*`);
    }

    if (!chat.username) {
      riskScore += 20;
      warnings.push(`⚠️ Nhóm riêng tư không có Username công khai.`);
    }

    let resultMsg = 
      `🔍 **KẾT QUẢ QUÉT LINK GROUP TELEGRAM**\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 **Tên Group:** ${chat.title || 'Không rõ'}\n` +
      `🆔 **ID:** \`${chat.id}\`\n` +
      `🔗 **Username:** @${chat.username || 'Không có'}\n` +
      `📝 **Mô tả:** ${chat.description || 'Không có mô tả'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n`;

    if (riskScore >= 50) {
      resultMsg += `🚨 **MỨC ĐỘ RỦI RO: CAO (${riskScore}%)**\n\n` + warnings.join('\n') + `\n\n🛑 **CẢNH BÁO:** Hãy cẩn thận khi giao dịch trong nhóm này!`;
      
      // Tự động phát cảnh báo nếu nhóm rủi ro cao
      if (isScamDb) {
        await notifyScamAlert(isScamDb, 'Quét Link Group');
      }
    } else {
      resultMsg += `✅ **MỨC ĐỘ RỦI RO: THẤP (${riskScore}%)**\n\n` + (warnings.length > 0 ? warnings.join('\n') : '📌 Chưa phát hiện dấu hiệu lừa đảo nguy hiểm.');
    }

    await ctx.replyWithMarkdown(resultMsg, getMainMenu(ctx.from.id === ADMIN_ID));
  } catch (err) {
    await ctx.reply(`❌ Không thể quét nhóm này: ${err.message}\n(Có thể nhóm không tồn tại hoặc ở chế độ riêng tư không công khai).`, getMainMenu(ctx.from.id === ADMIN_ID));
  }
}

// ==================== XỬ LÝ HÌNH ẢNH & QR CODE ====================
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

      // Tự động đẩy cảnh báo
      await notifyScamAlert(scamResult, 'Quét QR/Hình Ảnh');
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

  // Luồng Xóa Bài Đăng Cảnh Báo từ Admin
  if (isAdmin && ctx.session?.action === 'delete_post_id') {
    const msgId = Number(input);
    if (isNaN(msgId)) {
      return await ctx.reply('❌ Message ID phải là một số nguyên hợp lệ!');
    }
    try {
      await bot.telegram.deleteMessage(CHECK_SCAM_GROUP, msgId);
      ctx.session.action = null;
      ctx.session.waitingInput = false;
      return await ctx.reply(`✅ **Đã xóa bài đăng ID ${msgId} thành công khỏi Group @checkscamvip2026!**`, getMainMenu(true));
    } catch (err) {
      return await ctx.reply(`❌ Lỗi khi xóa bài đăng: ${err.message}\n(Vui lòng kiểm tra lại ID bài viết hoặc quyền Admin của Bot).`, getMainMenu(true));
    }
  }

  // Luồng thêm Scam cho Admin
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

    const newScam = {
      key: key,
      reason: ctx.session.tempData.reason,
      proof: proof,
      addedBy: ctx.from.id,
      date: new Date().toLocaleDateString('vi-VN')
    };

    db.scamBlacklist[cleanK] = newScam;
    saveDatabase();

    ctx.session.action = null;
    ctx.session.waitingInput = false;

    await ctx.replyWithMarkdown(`✅ **Đã thêm thành công Scammer vào Blacklist!**\n📌 Key: \`${key}\``, getMainMenu(true));

    // Tự động gửi cảnh báo vào Group & Broadcast người dùng
    await notifyScamAlert(newScam, 'Admin Cập Nhật');
    return;
  }

  // Luồng kiểm tra thông thường
  if (ctx.session?.waitingInput) {
    if (ctx.session.action === 'check_group' || input.includes('t.me/') || input.startsWith('@')) {
      ctx.session.waitingInput = false;
      return await analyzeGroupLink(ctx, input);
    }

    if (ctx.session.action === 'check_scam') {
      ctx.session.waitingInput = false;
      db.stats.scamSearches++;
      saveDatabase();

      const result = searchScam(input);
      if (result) {
        await ctx.replyWithMarkdown(
          `🚨 **CẢNH BÁO: PHÁT HIỆN SCAMMER!**\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎯 **Thông tin:** \`${result.key}\`\n` +
          `❌ **Lý do:** ${result.reason}\n` +
          `🔗 **Bằng chứng:** ${result.proof || 'Không có'}\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n` +
          `🛑 **CẢNH BÁO:** KHÔNG GIAO DỊCH!`,
          getMainMenu(isAdmin)
        );

        // Tự động gửi cảnh báo nếu phát hiện
        await notifyScamAlert(result, 'Tra cứu Check Text');
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
  }
});

// ==================== STATS ACTION ====================
bot.action('menu_stats', async (ctx) => {
  await ctx.answerCbQuery();
  const msg = 
    `📊 **THỐNG KÊ HỆ THỐNG QUÉT SCAM**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔍 Lượt check Text: **${db.stats.scamSearches}**\n` +
    `🖼️ Lượt quét Ảnh/QR: **${db.stats.imageScans}**\n` +
    `🔗 Lượt check Group: **${db.stats.groupScans}**\n` +
    `🔨 Lượt cấm thành công: **${db.stats.totalBanned}**\n` +
    `👥 Người dùng đăng ký bot: **${db.users.length}**\n` +
    `🚨 Dữ liệu Scammer: **${Object.keys(db.scamBlacklist).length}**\n` +
    `━━━━━━━━━━━━━━━━━━━━━`;
  await ctx.replyWithMarkdown(msg, getMainMenu(ctx.from.id === ADMIN_ID));
});

// ==================== SERVER LAUNCH ====================
app.use(express.json());
app.get('/', (req, res) => res.send('OMEGA BOT v900 MULTIMEDIA RUNNING'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy trên Port ${PORT}`));

bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('🤖 OMEGA BOT v900 MULTIMEDIA DETECTOR READY'))
  .catch((err) => console.error('❌ Lỗi khởi động:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
