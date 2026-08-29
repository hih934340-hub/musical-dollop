// ============================================================
// OMEGA BOT - RENDER.COM DEPLOYMENT READY
// server.js - Node.js + Telegraf Framework
// Auto-Pull + SuperBan Engine for Butter
// ============================================================

const express = require('express');
const { Telegraf, session, Markup } = require('telegraf');
const { message } = require('telegraf/filters');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ==================== OMEGA CONFIG ====================
const BOT_TOKEN = '8840411754:AAHyJLmiPLehUMsqFPD1AQj50DXzhcfy8qA';
const ADMIN_ID = 7757046138; // Your Supreme ID
const TARGET_GROUP_LINK = 'https://t.me/your_group'; // Replace with your group

// ==================== OMEGA ENGINE ====================
const app = express();
const bot = new Telegraf(BOT_TOKEN);

// Enable session
bot.use(session());

// Global state
let pullActive = false;
let pulledCount = 0;
let bannedCount = 0;
let targetGroupId = null;

// ==================== BEAUTY & UI ====================
const MAIN_MENU = Markup.inlineKeyboard([
  [Markup.button.callback('🚀 Start Pull', 'pull_on')],
  [Markup.button.callback('🛑 Stop Pull', 'pull_off')],
  [Markup.button.callback('🔨 Ban All Members', 'ban_all')],
  [Markup.button.callback('📊 Status', 'status')],
  [Markup.button.url('🔗 Join Target Group', TARGET_GROUP_LINK)]
]);

const BEAUTY_HEADER = `
🐱 **OMEGA BOT v42.0.1**
━━━━━━━━━━━━━━━━━━━━━
*Supreme Auto-Pull & Ban Engine*
*Designed for Butter's Absolute Dominance*
━━━━━━━━━━━━━━━━━━━━━
`;

// ==================== COMMANDS ====================
bot.start(async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply('❌ Unauthorized. This bot is for Butter only.');
  }
  await ctx.replyWithHTML(
    `${BEAUTY_HEADER}\n✅ **System**: ONLINE\n✅ **Pull Engine**: ${pullActive ? 'ACTIVE' : 'STANDBY'}\n✅ **Admin**: IDENTIFIED\n\n*You command. I execute.*`,
    MAIN_MENU
  );
});

// ==================== AUTO PULL ENGINE ====================
async function autoPull() {
  if (!pullActive) return;
  
  try {
    // Get target group
    if (!targetGroupId) {
      const target = await bot.telegram.getChat(TARGET_GROUP_LINK);
      targetGroupId = target.id;
    }

    // Find large groups to pull from
    const dialogs = await bot.telegram.getChats();
    const largeGroups = dialogs.filter(d => 
      d.type === 'group' || d.type === 'supergroup' 
    );

    for (const group of largeGroups) {
      if (!pullActive) break;
      
      try {
        // Get members from source group
        const members = await bot.telegram.getChatMembersCount(group.id);
        if (members < 50) continue;

        // Get random members
        const admins = await bot.telegram.getChatAdministrators(group.id);
        const adminIds = admins.map(a => a.user.id);
        
        // Get participants (limited to 20 per cycle)
        const participants = await bot.telegram.getChatMembers(group.id, { limit: 10 });
        
        for (const member of participants) {
          if (!pullActive) break;
          if (member.user.id === ADMIN_ID) continue;
          if (member.user.is_bot) continue;
          if (adminIds.includes(member.user.id)) continue;

          try {
            await bot.telegram.exportChatInviteLink(targetGroupId);
            await bot.telegram.inviteToChat(targetGroupId, member.user.id);
            pulledCount++;
            console.log(`✅ Pulled: ${member.user.first_name} (${pulledCount})`);
            await new Promise(r => setTimeout(r, 2000)); // Anti-flood
          } catch (e) {
            console.log(`⚠️ Failed to pull: ${e.message}`);
          }
        }
      } catch (e) {
        console.log(`⚠️ Group error: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`⚠️ Pull cycle error: ${e.message}`);
  }
}

// ==================== BAN ALL ENGINE ====================
async function banAllMembers(chatId, ctx) {
  try {
    const chat = await bot.telegram.getChat(chatId);
    const members = await bot.telegram.getChatMembersCount(chatId);
    let banned = 0;
    let skipped = 0;

    // Get all members
    const participants = await bot.telegram.getChatMembers(chatId, { limit: 1000 });
    
    for (const member of participants) {
      if (member.user.id === ADMIN_ID) {
        skipped++;
        continue;
      }
      if (member.user.id === ctx.botInfo.id) {
        skipped++;
        continue;
      }
      if (member.user.is_bot) {
        skipped++;
        continue;
      }

      try {
        await bot.telegram.banChatMember(chatId, member.user.id);
        banned++;
        if (banned % 20 === 0) {
          await ctx.reply(`⚡ Banned ${banned} members so far...`);
        }
        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        console.log(`⚠️ Can't ban ${member.user.id}: ${e.message}`);
      }
    }

    return { banned, skipped, total: members };
  } catch (e) {
    throw new Error(`BanAll failed: ${e.message}`);
  }
}

// ==================== BUTTON HANDLERS ====================
bot.action('pull_on', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  if (pullActive) {
    return ctx.answerCbQuery('⚠️ Pull already active');
  }
  
  pullActive = true;
  await ctx.answerCbQuery('🚀 Pull Engine STARTED');
  await ctx.editMessageText(
    `${BEAUTY_HEADER}\n🔄 **Pull Engine**: ACTIVATED\n📊 **Total Pulled**: ${pulledCount}\n\n*Harvesting members now...*`,
    MAIN_MENU
  );
  
  // Start pull loop
  while (pullActive) {
    await autoPull();
    await new Promise(r => setTimeout(r, 30000));
  }
});

bot.action('pull_off', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  if (!pullActive) {
    return ctx.answerCbQuery('⚠️ Pull already stopped');
  }
  
  pullActive = false;
  await ctx.answerCbQuery('🛑 Pull Engine STOPPED');
  await ctx.editMessageText(
    `${BEAUTY_HEADER}\n🛑 **Pull Engine**: DEACTIVATED\n📊 **Total Pulled**: ${pulledCount}\n\n*Standing by for your command.*`,
    MAIN_MENU
  );
});

bot.action('ban_all', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  const chatId = ctx.chat.id;
  await ctx.answerCbQuery('🔨 BAN ALL INITIATED');
  
  await ctx.reply(`🔥 **BAN ALL STARTED**\nGroup: ${ctx.chat.title}\n\n*Terminating all members...*`);
  
  try {
    const result = await banAllMembers(chatId, ctx);
    await ctx.reply(
      `✅ **BAN ALL COMPLETE**\n━━━━━━━━━━━━━━\n🔨 Banned: ${result.banned}\n⏭️ Skipped: ${result.skipped}\n👥 Total: ${result.total}\n\n💀 Silence is absolute.`
    );
  } catch (e) {
    await ctx.reply(`⚠️ Error: ${e.message}`);
  }
});

bot.action('status', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.answerCbQuery('❌ Unauthorized');
  }
  
  const me = await ctx.telegram.getMe();
  const dialogs = await ctx.telegram.getChats();
  const groups = dialogs.filter(d => d.type === 'group' || d.type === 'supergroup').length;
  
  await ctx.answerCbQuery('📊 Status fetched');
  await ctx.editMessageText(
    `${BEAUTY_HEADER}\n` +
    `🤖 **Bot**: ${me.first_name}\n` +
    `🆔 **ID**: ${me.id}\n` +
    `👥 **Groups**: ${groups}\n` +
    `⚡ **Pull Engine**: ${pullActive ? 'ACTIVE' : 'STANDBY'}\n` +
    `📊 **Pulled**: ${pulledCount}\n` +
    `🔗 **Target**: ${TARGET_GROUP_LINK}\n` +
    `👑 **Admin**: ${ADMIN_ID}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `*"You command. I execute."*`,
    MAIN_MENU
  );
});

// ==================== WEBHOOK FOR RENDER ====================
app.use(express.json());
app.post('/webhook', (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.get('/', (req, res) => {
  res.send(`
    <h1>🐱 OMEGA BOT</h1>
    <p>Status: <strong>ONLINE</strong></p>
    <p>Admin: ${ADMIN_ID}</p>
    <p>Pull Engine: ${pullActive ? 'ACTIVE' : 'STANDBY'}</p>
    <p>Total Pulled: ${pulledCount}</p>
    <p>Total Banned: ${bannedCount}</p>
    <hr>
    <p><i>Supreme Bot for Butter</i></p>
  `);
});

// ==================== LAUNCH ====================
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🐱 OMEGA BOT STARTED on port ${PORT}`);
  console.log(`👑 Admin ID: ${ADMIN_ID}`);
  console.log(`🔗 Target Group: ${TARGET_GROUP_LINK}`);
  console.log(`⚡ Pull Engine: ${pullActive ? 'ACTIVE' : 'STANDBY'}`);
  
  // Set webhook
  const webhookUrl = `https://${process.env.RENDER_EXTERNAL_URL || 'localhost'}/webhook`;
  await bot.telegram.setWebhook(webhookUrl);
  console.log(`✅ Webhook set: ${webhookUrl}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  bot.stop();
  process.exit(0);
});
