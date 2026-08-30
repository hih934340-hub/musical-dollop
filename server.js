// ============================================================
// OMEGA BOT v900 — AUTOMATIC MEMBER BOOSTER (ONLY)
// ============================================================

const express = require('express');
const { Telegraf, session, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURATION ====================
const BOT_TOKEN = process.env.BOT_TOKEN || '8840411754:AAHyJLmiPLehUMsqFPD1AQj50DXzhcfy8qA';
const ADMIN_ID = Number(process.env.ADMIN_ID) || 7757046138;
const MAIN_GROUP_LINK = 'https://t.me/checkscamvip2026';
const DB_FILE = path.join(__dirname, 'database.json');

// ==================== PERSISTENT DATABASE ====================
let db = {
  groups: {},      // groupId -> { id, title, memberCount }
  users: [],       // Danh sách user ID
  bannedUsers: [], // User ID bị khóa
  stats: { totalPulled: 0, totalSpamGroups: 0 }
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.groups) db.groups = {};
      if (!db.users) db.users = [];
      if (!db.bannedUsers) db.bannedUsers = [];
      if (!db.stats) db.stats = { totalPulled: 0, totalSpamGroups: 0 };
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

// ==================== ENGINE SETUP ====================
const app = express();
const bot = new Telegraf(BOT_TOKEN);

bot.use(session({
  defaultSession: () => ({ action: null, waitingInput: false })
}));

// Middleware chặn User bị khóa
bot.use((ctx, next) => {
  const userId = ctx.from?.id;
  if (userId && db.bannedUsers.includes(userId) && userId !== ADMIN_ID) {
    if (ctx.type === 'callback_query') {
      ctx.answerCbQuery('⛔ Tài khoản của bạn đã bị KHÓA toàn bộ chức năng!', { show_alert: true });
    } else {
      ctx.reply('⛔ **Tài khoản của bạn đã bị Admin KHÓA toàn bộ chức năng!**');
    }
    return;
  }
  return next();
});

// Tự động lưu thông tin nhóm khi Bot được thêm vào
bot.on(['new_chat_members', 'group_chat_created', 'supergroup_chat_created'], async (ctx) => {
  if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
    let count = 0;
    try {
      count = await bot.telegram.getChatMembersCount(ctx.chat.id);
    } catch (e) {}

    db.groups[ctx.chat.id] = {
      id: ctx.chat.id,
      title: ctx.chat.title,
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
      Markup.button.callback('🚀 KÉO MEMBER (RẢI LINK EVENT)', 'menu_invite_spam')
    ],
    [
      Markup.button.callback('📊 THỐNG KÊ KÉO MEM', 'menu_stats'),
      Markup.button.url('📢 VÀO GROUP EVENT', MAIN_GROUP_LINK)
    ]
  ];

  if (isAdmin) {
    buttons.push(
      [Markup.button.callback('🔒 KHÓA USER ID', 'menu_block_user'), Markup.button.callback('🔓 MỜ KHÓA USER ID', 'menu_unblock_user')],
      [Markup.button.callback('📋 DANH SÁCH NHÓM BOT VÀO', 'menu_list')]
    );
  }

  return Markup.inlineKeyboard(buttons);
}

// ==================== BOT HANDLERS ====================
bot.start(async (ctx) => {
  if (ctx.chat.type !== 'private') return ctx.reply('⚠️ Vui lòng chat riêng với Bot!');
  
  registerUser(ctx.from.id);
  const isAdmin = ctx.from.id === ADMIN_ID;
  ctx.session.action = null;
  ctx.session.waitingInput = false;

  await ctx.replyWithMarkdown(
    `🐱 **BOT AUTOMATIC MEMBER BOOSTER**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `👋 **Xin chào ${ctx.from.first_name}!**\n\n` +
    `⚡ Nhấn nút bên dưới để bắt đầu tự động rải Link Event và Kéo Member vào các nhóm!`,
    getMainMenu(isAdmin)
  );
});

// LỆNH KÉO MEMBER: RẢI LINK EVENT VÀO TẤT CẢ CÁC NHÓM
bot.action('menu_invite_spam', async (ctx) => {
  await ctx.answerCbQuery();
  const isAdmin = ctx.from.id === ADMIN_ID;

  const groupIds = Object.keys(db.groups);
  if (groupIds.length === 0) {
    return ctx.reply(
      '⚠️ **Bot chưa tham gia nhóm nào!**\n\n' +
      '👉 Vui lòng thêm Bot vào các nhóm Telegram đông người và cấp quyền **Admin / Gửi tin nhắn** để Bot tự động rải link kéo mem.',
      getMainMenu(isAdmin)
    );
  }

  await ctx.reply('⏳ **ĐANG TIẾN HÀNH RẢI LINK EVENT VÀO CÁC NHÓM...**\nVui lòng chờ trong giây lát!');

  const spamText = 
    `🎉 **ĐANG CÓ EVENT VIP Ở NHÓM:**\n` +
    `👉 **Tham gia ngay:** ${MAIN_GROUP_LINK}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 *Nhóm Event & Quà tặng VIP uy tín nhất Telegram!*`;

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
    `🎯 **ĐANG CÓ EVENT VIP Ở NHÓM:**\n👉 ${MAIN_GROUP_LINK}\n\n` +
    `🚀 **Rải thành công:** **${successCount}** nhóm\n` +
    `❌ **Rải thất bại:** **${failCount}** nhóm (thiếu quyền Admin/Gửi tin)\n` +
    `👥 **Mời/Tiếp cận lượt này:** ~**${estimatedMembersReached}** thành viên\n` +
    `📊 **Tổng số người Bot đã kéo/tiếp cận:** **${db.stats.totalPulled}** người\n` +
    `━━━━━━━━━━━━━━━━━━━━━`;

  await ctx.replyWithMarkdown(reportMsg, getMainMenu(isAdmin));
});

// ==================== ADMIN: KHÓA / MỜ KHÓA USER ID ====================
bot.action('menu_block_user', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  ctx.session.action = 'input_block_user';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🔒 **KHÓA TÀI KHOẢN USER**\n\nNhập Telegram **User ID** muốn KHÓA toàn bộ chức năng:');
});

bot.action('menu_unblock_user', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  ctx.session.action = 'input_unblock_user';
  ctx.session.waitingInput = true;
  await ctx.answerCbQuery();
  await ctx.reply('🔓 **MỞ KHÓA TÀI KHOẢN USER**\n\nNhập Telegram **User ID** cần MỜ KHÓA:');
});

bot.action('menu_list', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Bạn không có quyền!');
  await ctx.answerCbQuery();
  const groupKeys = Object.keys(db.groups);
  if (groupKeys.length === 0) {
    return ctx.reply('📋 Bot chưa lưu nhóm nào!');
  }
  let listMsg = `📋 **DANH SÁCH NHÓM BOT ĐÃ VÀO (${groupKeys.length}):**\n━━━━━━━━━━━━━━━━━━━━━\n`;
  groupKeys.forEach((id, idx) => {
    const g = db.groups[id];
    listMsg += `${idx + 1}. **${g.title}** (\`${g.id}\`) - ~${g.memberCount || 0} mems\n`;
  });
  await ctx.replyWithMarkdown(listMsg, getMainMenu(true));
});

// ==================== INPUT HANDLER ====================
bot.on('text', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  registerUser(ctx.from.id);

  const input = ctx.message.text.trim();
  const isAdmin = ctx.from.id === ADMIN_ID;

  // Cấp ID & Khóa User (Admin)
  if (isAdmin && ctx.session?.action === 'input_block_user') {
    const targetId = Number(input);
    if (isNaN(targetId)) return await ctx.reply('❌ ID phải là định dạng số!');
    
    if (!db.bannedUsers.includes(targetId)) {
      db.bannedUsers.push(targetId);
      saveDatabase();
    }
    ctx.session.action = null;
    ctx.session.waitingInput = false;
    return await ctx.reply(`🔒 **Đã KHÓA thành công User ID:** \`${targetId}\`\nUser này đã bị chặn mọi chức năng của Bot.`, getMainMenu(true));
  }

  // Mở khóa User (Admin)
  if (isAdmin && ctx.session?.action === 'input_unblock_user') {
    const targetId = Number(input);
    if (isNaN(targetId)) return await ctx.reply('❌ ID phải là định dạng số!');
    
    db.bannedUsers = db.bannedUsers.filter(id => id !== targetId);
    saveDatabase();
    ctx.session.action = null;
    ctx.session.waitingInput = false;
    return await ctx.reply(`🔓 **Đã MỞ KHÓA thành công User ID:** \`${targetId}\``, getMainMenu(true));
  }
});

// ==================== STATS ACTION ====================
bot.action('menu_stats', async (ctx) => {
  await ctx.answerCbQuery();
  const msg = 
    `📊 **THỐNG KÊ KÉO MEMBER**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 Số lượt rải nhóm thành công: **${db.stats.totalSpamGroups}** nhóm\n` +
    `👥 Số người ước tính đã tiếp cận: **${db.stats.totalPulled}** người\n` +
    `👥 Số người dùng đăng ký Bot: **${db.users.length}** user\n` +
    `🔒 Số User bị khóa: **${db.bannedUsers.length}** user\n` +
    `📋 Số nhóm Bot đang có mặt: **${Object.keys(db.groups).length}** nhóm\n` +
    `━━━━━━━━━━━━━━━━━━━━━`;
  await ctx.replyWithMarkdown(msg, getMainMenu(ctx.from.id === ADMIN_ID));
});

// ==================== SERVER LAUNCH ====================
app.use(express.json());
app.get('/', (req, res) => res.send('OMEGA BOT MEMBER BOOSTER RUNNING'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy trên Port ${PORT}`));

bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('🤖 BOT MEMBER BOOSTER READY'))
  .catch((err) => console.error('❌ Lỗi khởi động:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
