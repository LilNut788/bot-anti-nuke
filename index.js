'use strict';
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  EmbedBuilder,
  AuditLogEvent,
  ChannelType,
  GuildVerificationLevel,
  OverwriteType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
});

const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID || '';
const ROLE_LOG_CHANNEL_ID = process.env.ROLE_LOG_CHANNEL_ID || '';

const AUDIT_LOG_WINDOW_MS = Number(process.env.AUDIT_LOG_WINDOW_MS ?? 40000);
const ROLE_ACTOR_CACHE_TTL_MS = Number(process.env.ROLE_ACTOR_CACHE_TTL_MS ?? 60000);

const WL_WEBHOOK = new Set((process.env.WHITELIST_WEBHOOK_IDS || '').split(',').map(s=>s.trim()).filter(Boolean));
const WL_APPS    = new Set((process.env.WHITELIST_APP_IDS   || '').split(',').map(s=>s.trim()).filter(Boolean));
const WL_BOTS    = new Set((process.env.WHITELIST_BOT_IDS   || '').split(',').map(s=>s.trim()).filter(Boolean));
const REQUIRE_ALLOWED_BOT_IDS = (process.env.REQUIRE_ALLOWED_BOT_IDS ?? '0') === '1';

const ALLOW_ADMIN = (process.env.ALLOW_ADMIN ?? '1') === '1';
const INVITER_DM  = (process.env.INVITER_DM  ?? '1') === '1';
const PUNISHMENT  = (process.env.PUNISHMENT  ?? 'ban').toLowerCase();
const AUTODEL_BOT = (process.env.AUTODEL_BOT ?? '1') === '1';
const WHITELIST_ROLE_IDS = (process.env.WHITELIST_ROLE_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
const ALLOWED_BOT_IDS    = (process.env.ALLOWED_BOT_IDS    || '').split(',').map(s=>s.trim()).filter(Boolean);

const SELF_PROTECT = (process.env.SELF_PROTECT ?? '1') === '1';
const SELF_PROTECT_PUNISHMENT = (process.env.SELF_PROTECT_PUNISHMENT ?? 'demote').toLowerCase();
const PROTECT_ALLOWED_ROLE_IDS = (process.env.PROTECT_ALLOWED_ROLE_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
const PROTECT_ROLE_SENTINEL = (process.env.PROTECT_ROLE_SENTINEL ?? '0') === '1';

const ALLOW_ACTOR_USER_IDS = (process.env.ALLOW_ACTOR_USER_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
const ALLOW_ACTOR_ROLE_IDS = (process.env.ALLOW_ACTOR_ROLE_IDS || '').split(',').map(s=>s.trim()).filter(Boolean);
const ALLOW_ACTOR_BOT_IDS  = (process.env.ALLOW_ACTOR_BOT_IDS  || '').split(',').map(s=>s.trim()).filter(Boolean);

const DM_ACTOR = (process.env.DM_ACTOR ?? '0') === '1';

const ANTINUKE_ENABLED = (process.env.ANTINUKE_ENABLED ?? '1') === '1';
const NUKE_WINDOW_MS = Number(process.env.NUKE_WINDOW_MS ?? 10000);
const NUKE_PUNISHMENT = (process.env.NUKE_PUNISHMENT ?? 'quarantine').toLowerCase();
const NUKE_PUNISH_COOLDOWN_MS = Number(process.env.NUKE_PUNISH_COOLDOWN_MS ?? 30000);
const QUARANTINE_ROLE_ID = (process.env.QUARANTINE_ROLE_ID || '').trim();

const AUTO_RESTORE_CHANNELS = (process.env.AUTO_RESTORE_CHANNELS ?? '1') === '1';
const RESTORE_WINDOW_MS = Number(process.env.RESTORE_WINDOW_MS ?? 60000);

const PANIC_LOCK_ENABLED = (process.env.PANIC_LOCK_ENABLED ?? '1') === '1';
const PANIC_LOCK_DURATION_MS = Number(process.env.PANIC_LOCK_DURATION_MS ?? 300000);
const PANIC_RAISE_VERIFICATION = (process.env.PANIC_RAISE_VERIFICATION ?? '1') === '1';

const CMD_PREFIX = process.env.CMD_PREFIX || '!';
const BACKUP_FILE = path.join(__dirname, 'antinuke-backup.json');

const CREDIT = 'LilNut788';

const c = {
  reset:'\x1b[0m', bold:'\x1b[1m',
  cyan:'\x1b[36m', gray:'\x1b[90m', green:'\x1b[32m',
  yellow:'\x1b[33m', red:'\x1b[31m', magenta:'\x1b[35m',
};

const GLYPHS = {
  L:['██╗     ','██║     ','██║     ','██║     ','███████╗','╚══════╝'],
  I:['██╗','██║','██║','██║','██║','╚═╝'],
  N:['███╗   ██╗','████╗  ██║','██╔██╗ ██║','██║╚██╗██║','██║ ╚████║','╚═╝  ╚═══╝'],
  U:['██╗   ██╗','██║   ██║','██║   ██║','██║   ██║','╚██████╔╝',' ╚═════╝ '],
  T:['████████╗','╚══██╔══╝','   ██║   ','   ██║   ','   ██║   ','   ╚═╝   '],
  '7':['███████╗','╚════██║','    ██╔╝','   ██╔╝ ','   ██║  ','   ╚═╝  '],
  '8':[' █████╗ ','██╔══██╗','╚█████╔╝','██╔══██╗','╚█████╔╝',' ╚════╝ '],
};

function makeBanner(word){
  const lines = ['','','','','',''];
  for(const ch of word.toUpperCase()){
    const g = GLYPHS[ch];
    if(!g) continue;
    for(let i=0;i<6;i++) lines[i] += g[i] + '  ';
  }
  return lines.join('\n');
}

function intEnv(name, def){ const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : def; }

const NUKE_ACTIONS = [
  { key:'channelDelete',    event:AuditLogEvent.ChannelDelete,    limit:intEnv('LIMIT_CHANNEL_DELETE',3),    label:'ลบห้อง' },
  { key:'channelCreate',    event:AuditLogEvent.ChannelCreate,    limit:intEnv('LIMIT_CHANNEL_CREATE',5),    label:'สร้างห้อง' },
  { key:'channelUpdate',    event:AuditLogEvent.ChannelUpdate,    limit:intEnv('LIMIT_CHANNEL_UPDATE',6),    label:'แก้ไขห้อง' },
  { key:'roleDelete',       event:AuditLogEvent.RoleDelete,       limit:intEnv('LIMIT_ROLE_DELETE',3),       label:'ลบ role' },
  { key:'roleCreate',       event:AuditLogEvent.RoleCreate,       limit:intEnv('LIMIT_ROLE_CREATE',4),       label:'สร้าง role' },
  { key:'roleUpdate',       event:AuditLogEvent.RoleUpdate,       limit:intEnv('LIMIT_ROLE_UPDATE',5),       label:'แก้ไข role' },
  { key:'ban',              event:AuditLogEvent.MemberBanAdd,     limit:intEnv('LIMIT_BAN',3),               label:'แบนสมาชิก' },
  { key:'kick',             event:AuditLogEvent.MemberKick,       limit:intEnv('LIMIT_KICK',3),              label:'เตะสมาชิก' },
  { key:'prune',            event:AuditLogEvent.MemberPrune,      limit:intEnv('LIMIT_PRUNE',1),             label:'Prune สมาชิก' },
  { key:'memberRoleUpdate', event:AuditLogEvent.MemberRoleUpdate, limit:intEnv('LIMIT_MEMBER_ROLE_UPDATE',6),label:'แจก/ถอด role จำนวนมาก' },
  { key:'webhookCreate',    event:AuditLogEvent.WebhookCreate,    limit:intEnv('LIMIT_WEBHOOK_CREATE',3),    label:'สร้าง webhook' },
  { key:'emojiDelete',      event:AuditLogEvent.EmojiDelete,      limit:intEnv('LIMIT_EMOJI_DELETE',6),      label:'ลบ emoji' },
  { key:'guildUpdate',      event:AuditLogEvent.GuildUpdate,      limit:intEnv('LIMIT_GUILD_UPDATE',2),      label:'แก้ตั้งค่าเซิร์ฟเวอร์' },
];
const NUKE_ACTION_BY_EVENT = new Map(NUKE_ACTIONS.map(a => [a.event, a]));

const nukeHits = new Map();
const nukePunishedRecently = new Map();
const nukeHandledEntryIds = new Set();

function recordNukeHit(gid, actorId, key, limit){
  const k = `${gid}:${actorId}:${key}`;
  const now = Date.now();
  const arr = (nukeHits.get(k) || []).filter(ts => now - ts <= NUKE_WINDOW_MS);
  arr.push(now);
  nukeHits.set(k, arr);
  return { count: arr.length, exceeded: arr.length >= limit };
}
function nukePunishOnCooldown(gid, actorId){
  const ts = nukePunishedRecently.get(`${gid}:${actorId}`);
  return ts && (Date.now() - ts <= NUKE_PUNISH_COOLDOWN_MS);
}
function markNukePunished(gid, actorId){
  nukePunishedRecently.set(`${gid}:${actorId}`, Date.now());
}

setInterval(() => {
  const now = Date.now();
  for(const [k, arr] of nukeHits){
    const f = arr.filter(ts => now - ts <= NUKE_WINDOW_MS);
    if(f.length) nukeHits.set(k, f); else nukeHits.delete(k);
  }
  for(const [k, ts] of nukePunishedRecently){
    if(now - ts > NUKE_PUNISH_COOLDOWN_MS) nukePunishedRecently.delete(k);
  }
}, 60000).unref?.();

function isActorAllowed(guild, actorMember, actorId){
  if(actorId === guild.ownerId) return true;
  if(ALLOW_ACTOR_USER_IDS.includes(actorId)) return true;
  if(ALLOW_ACTOR_BOT_IDS.includes(actorId)) return true;
  if(actorMember){
    if(actorMember.roles.cache.some(r => ALLOW_ACTOR_ROLE_IDS.includes(r.id))) return true;
    if(actorMember.roles.cache.some(r => PROTECT_ALLOWED_ROLE_IDS.includes(r.id))) return true;
  }
  return false;
}

const DANGEROUS_PERMS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageGuildExpressions,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.MentionEveryone,
];

async function quarantineActor(guild, member){
  const removed = [];
  const failed = [];
  const protectedIds = new Set([...PROTECT_ALLOWED_ROLE_IDS, ...ALLOW_ACTOR_ROLE_IDS]);
  const toRemove = member.roles.cache.filter(r =>
    r.id !== guild.id &&
    !r.managed &&
    !protectedIds.has(r.id) &&
    DANGEROUS_PERMS.some(p => r.permissions.has(p))
  );
  for(const r of toRemove.values()){
    try{ await member.roles.remove(r, 'Anti-Nuke: quarantine'); removed.push(`<@&${r.id}>`); }
    catch{ failed.push(`<@&${r.id}>`); }
  }
  if(QUARANTINE_ROLE_ID){
    try{ await member.roles.add(QUARANTINE_ROLE_ID, 'Anti-Nuke: quarantine'); }catch{}
  }
  return { removed, failed };
}

const liveChannelSnap = new Map();
const deletedChannelBuf = new Map();

function serializeChannel(ch){
  return {
    id: ch.id,
    name: ch.name,
    type: ch.type,
    parentId: ch.parentId ?? null,
    position: ch.rawPosition ?? 0,
    topic: ch.topic ?? null,
    nsfw: ch.nsfw ?? false,
    bitrate: ch.bitrate ?? null,
    userLimit: ch.userLimit ?? null,
    rateLimitPerUser: ch.rateLimitPerUser ?? null,
    overwrites: (ch.permissionOverwrites?.cache?.map(o => ({
      id: o.id, type: o.type,
      allow: o.allow.bitfield.toString(),
      deny:  o.deny.bitfield.toString(),
    })) ?? []),
  };
}

let saveTimer = null;
function persistSnapshots(){
  if(saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try{
      const out = {};
      for(const [gid, m] of liveChannelSnap) out[gid] = [...m.values()];
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(out), 'utf8');
    }catch(e){ console.error('[backup-save]', e?.message); }
  }, 5000);
}
function loadSnapshots(){
  try{
    if(!fs.existsSync(BACKUP_FILE)) return;
    const data = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
    for(const gid of Object.keys(data)){
      const m = new Map();
      for(const s of data[gid]) m.set(s.id, s);
      liveChannelSnap.set(gid, m);
    }
  }catch(e){ console.error('[backup-load]', e?.message); }
}
function snapshotGuildChannels(guild){
  const m = new Map();
  for(const ch of guild.channels.cache.values()){
    if(ch.type === ChannelType.GuildCategory ||
       ch.type === ChannelType.GuildText ||
       ch.type === ChannelType.GuildVoice ||
       ch.type === ChannelType.GuildAnnouncement ||
       ch.type === ChannelType.GuildStageVoice ||
       ch.type === ChannelType.GuildForum){
      m.set(ch.id, serializeChannel(ch));
    }
  }
  liveChannelSnap.set(guild.id, m);
  persistSnapshots();
  return m.size;
}

async function restoreChannels(guild){
  const cutoff = Date.now() - RESTORE_WINDOW_MS;
  const all = deletedChannelBuf.get(guild.id) || [];
  const batch = all.filter(x => x.ts >= cutoff);
  if(!batch.length){
    if(all.length) deletedChannelBuf.set(guild.id, []);
    return { created:0, failed:0 };
  }

  const items = batch.map(x => x.snap)
    .sort((a,b) => (a.type===ChannelType.GuildCategory?0:1) - (b.type===ChannelType.GuildCategory?0:1));

  const oldToNewParent = new Map();
  let created = 0, failed = 0;
  for(const s of items){
    const overwrites = s.overwrites
      .filter(o => o.type === OverwriteType.Member || o.id === guild.id || guild.roles.cache.has(o.id))
      .map(o => ({ id:o.id, type:o.type, allow:BigInt(o.allow), deny:BigInt(o.deny) }));
    const opts = { name: s.name, type: s.type, reason:'Anti-Nuke: auto-restore', permissionOverwrites: overwrites };
    if(s.type !== ChannelType.GuildCategory && s.parentId){
      if(guild.channels.cache.has(s.parentId)) opts.parent = s.parentId;
      else { const np = oldToNewParent.get(s.parentId); if(np) opts.parent = np; }
    }
    if(s.topic != null) opts.topic = s.topic;
    if(typeof s.nsfw === 'boolean') opts.nsfw = s.nsfw;
    if(s.bitrate) opts.bitrate = s.bitrate;
    if(s.userLimit != null) opts.userLimit = s.userLimit;
    if(s.rateLimitPerUser != null) opts.rateLimitPerUser = s.rateLimitPerUser;
    try{
      const ch = await guild.channels.create(opts);
      if(s.type === ChannelType.GuildCategory) oldToNewParent.set(s.id, ch.id);
      created++;
    }catch{
      try{
        delete opts.permissionOverwrites;
        const ch = await guild.channels.create(opts);
        if(s.type === ChannelType.GuildCategory) oldToNewParent.set(s.id, ch.id);
        created++;
      }catch{ failed++; }
    }
  }
  const processed = new Set(batch);
  const remaining = (deletedChannelBuf.get(guild.id) || [])
    .filter(x => !processed.has(x) && x.ts >= cutoff);
  deletedChannelBuf.set(guild.id, remaining);
  return { created, failed };
}

const lockdownState = new Map();

function isLockedDown(gid){
  const st = lockdownState.get(gid);
  return !!(st && st.until > Date.now());
}

async function enterLockdown(guild, ms, reason){
  if(!PANIC_LOCK_ENABLED) return;
  const existing = lockdownState.get(guild.id);
  const until = Date.now() + ms;
  let prevVerification = existing?.prevVerification;

  if(PANIC_RAISE_VERIFICATION && !existing){
    try{
      prevVerification = guild.verificationLevel;
      await guild.setVerificationLevel(GuildVerificationLevel.VeryHigh, 'Anti-Nuke: panic-lock');
    }catch{}
  }
  if(existing?.timer) clearTimeout(existing.timer);
  const timer = setTimeout(() => exitLockdown(guild, 'หมดเวลาอัตโนมัติ').catch(()=>{}), ms);
  lockdownState.set(guild.id, { until, prevVerification, timer });

  await sendLog(guild, embedInfo('🔴 PANIC-LOCK เปิดใช้งาน (LOCKDOWN)', [
    ['สาเหตุ', reason],
    ['ระยะเวลา', `${Math.round(ms/1000)} วินาที`],
    ['ผลระหว่างล็อก', 'ทุกการกระทำเสี่ยงจะถูกลงโทษทันที (limit=1)'],
    ['ปลดล็อก', `\`${CMD_PREFIX}unlock\``],
  ], 'Red'));
}

async function exitLockdown(guild, reason){
  const st = lockdownState.get(guild.id);
  if(!st) return;
  if(st.timer) clearTimeout(st.timer);
  lockdownState.delete(guild.id);
  if(PANIC_RAISE_VERIFICATION && st.prevVerification != null){
    try{ await guild.setVerificationLevel(st.prevVerification, 'Anti-Nuke: ปลด panic-lock'); }catch{}
  }
  await sendLog(guild, embedInfo('🟢 ปลด PANIC-LOCK แล้ว', [
    ['เหตุผล', reason],
  ], 'Green'));
}

async function punishNuker(guild, actorMember, actorId, actionDef, count){
  let result = '—';
  if(actorId === guild.ownerId){
    result = '⚠️ ผู้กระทำคือเจ้าของเซิร์ฟเวอร์ — ลงโทษอัตโนมัติไม่ได้';
  } else if(NUKE_PUNISHMENT === 'ban'){
    try{ await guild.members.ban(actorId, { reason:`Anti-Nuke: ${actionDef.label} เกินกำหนด`, deleteMessageSeconds:0 }); result = '🔨 แบนผู้กระทำแล้ว'; }
    catch{ result = 'แบนไม่สำเร็จ (สิทธิ์/ลำดับ role ไม่พอ)'; }
  } else if(NUKE_PUNISHMENT === 'kick'){
    try{ if(actorMember){ await actorMember.kick(`Anti-Nuke: ${actionDef.label} เกินกำหนด`); result = '👢 เตะผู้กระทำแล้ว'; } else result = 'เตะไม่สำเร็จ (หาสมาชิกไม่เจอ)'; }
    catch{ result = 'เตะไม่สำเร็จ (สิทธิ์/ลำดับ role ไม่พอ)'; }
  } else {
    if(actorMember){
      const { removed, failed } = await quarantineActor(guild, actorMember);
      result = removed.length ? `🔒 ริบสิทธิ์: ${removed.join(', ')}` : 'ไม่มี role อันตรายให้ริบ (หรือริบไม่สำเร็จ)';
      if(failed.length) result += ` | ❌ ริบไม่สำเร็จ: ${failed.join(', ')}`;
    } else {
      result = 'หาสมาชิกไม่เจอ — quarantine ไม่ได้';
    }
  }

  let restoreInfo = null;
  if(AUTO_RESTORE_CHANNELS && actionDef.key === 'channelDelete'){
    restoreInfo = await restoreChannels(guild).catch(()=>null);
    setTimeout(() => {
      restoreChannels(guild).then(r => {
        if(r?.created) sendLog(guild, embedInfo('♻️ กู้คืนห้องเพิ่มเติม (straggler sweep)', [
          ['สร้างคืนเพิ่ม', `${r.created} ห้อง${r.failed?` (พลาด ${r.failed})`:''}`],
        ], 'Green')).catch(()=>{});
      }).catch(()=>{});
    }, 5000);
  }

  const fields = [
    ['ผู้กระทำ', actorMember ? ufmt(actorMember.user) : `\`${actorId}\``],
    ['พฤติกรรม', `${actionDef.label} ${count} ครั้ง ภายใน ${Math.round(NUKE_WINDOW_MS/1000)} วิ`],
    ['บทลงโทษ', NUKE_PUNISHMENT],
    ['ผลลัพธ์', result],
  ];
  if(restoreInfo) fields.push(['กู้คืนห้อง', `สร้างคืน ${restoreInfo.created} ห้อง${restoreInfo.failed?` (พลาด ${restoreInfo.failed})`:''}`]);
  await sendLog(guild, embedInfo('🚨 ตรวจพบ NUKE — ลงโทษแล้ว', fields, 'Red'));

  if(PANIC_LOCK_ENABLED && !isLockedDown(guild.id)){
    await enterLockdown(guild, PANIC_LOCK_DURATION_MS, `ตรวจพบ NUKE: ${actionDef.label}`).catch(()=>{});
  }
}

client.on('guildAuditLogEntryCreate', async (entry, guild) => {
  if(!ANTINUKE_ENABLED) return;
  try{
    const def = NUKE_ACTION_BY_EVENT.get(entry.action);
    if(!def) return;

    if(entry.id){
      if(nukeHandledEntryIds.has(entry.id)) return;
      nukeHandledEntryIds.add(entry.id);
      if(nukeHandledEntryIds.size > 5000) nukeHandledEntryIds.clear();
    }

    const actorId = entry.executorId;
    if(!actorId || actorId === client.user.id) return;

    const actorMember = await guild.members.fetch(actorId).catch(()=>null);
    if(isActorAllowed(guild, actorMember, actorId)) return;

    const effLimit = isLockedDown(guild.id) ? 1 : def.limit;
    const { count, exceeded } = recordNukeHit(guild.id, actorId, def.key, effLimit);
    if(!exceeded) return;
    if(nukePunishOnCooldown(guild.id, actorId)) return;
    markNukePunished(guild.id, actorId);

    await punishNuker(guild, actorMember, actorId, def, count);
  }catch(err){
    await sendLog(guild, embedInfo('⚠️ Anti-Nuke Error', [
      ['รายละเอียด', codeBlock(err?.stack || err?.message || String(err))],
    ], 'Orange'));
  }
});

function embedInfo(title, entries, color='Blurple'){
  const e = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp().setFooter({ text: `Credit: ${CREDIT}` });
  e.addFields(entries.map(([n, v]) => ({ name:n, value:String(v), inline:true })));
  return e;
}
function ufmt(u){ if(!u) return 'ไม่ทราบ'; const name = u.globalName || u.username || u.tag || '(unknown)'; return `${name} (${u.id})`; }
function codeBlock(s){ return '```\n'+String(s)+'\n```'; }

async function sendLog(guild, embed){
  if(!LOG_CHANNEL_ID) return;
  let ch = guild.channels.cache.get(LOG_CHANNEL_ID) || await guild.channels.fetch(LOG_CHANNEL_ID).catch(()=>null);
  if(ch) await ch.send({ embeds:[embed] }).catch(()=>{});
}
async function sendRoleLog(guild, embed){
  const targetId = ROLE_LOG_CHANNEL_ID || LOG_CHANNEL_ID;
  if(!targetId) return;
  let ch = guild.channels.cache.get(targetId) || await guild.channels.fetch(targetId).catch(()=>null);
  if(ch) await ch.send({ embeds:[embed] }).catch(()=>{});
}
function describeAllowReason(inviterMember){
  if(!inviterMember) return '—';
  if(inviterMember.permissions.has(PermissionFlagsBits.Administrator)) return 'ผู้เชิญเป็น Admin';
  const wl = inviterMember.roles.cache.find(r => WHITELIST_ROLE_IDS.includes(r.id));
  if(wl) return `มีบทบาท whitelist: <@&${wl.id}>`;
  return '—';
}
async function isInstalledBot(guild, botUserId){
  const m = guild.members.cache.get(botUserId) || await guild.members.fetch(botUserId).catch(()=>null);
  return !!m;
}

const guildAuditCapable = new Set();

function refreshAuditCapability(guild) {
  try {
    const me = guild.members.me;
    if (me?.permissions?.has(PermissionFlagsBits.ViewAuditLog)) {
      guildAuditCapable.add(guild.id);
    } else {
      guildAuditCapable.delete(guild.id);
    }
  } catch {}
}

const recentRoleLogKeys = new Map();
const ROLE_LOG_DEDUP_TTL_MS = 15_000;

function makeRoleLogKey(guildId, memberId, addedIds = [], removedIds = [], actorId = 'unknown') {
  const a = [...new Set(addedIds)].sort().join(',');
  const r = [...new Set(removedIds)].sort().join(',');
  return `${guildId}:${memberId}:A[${a}]R[${r}]:by:${actorId}`;
}
function seenRecently(key) {
  const ts = recentRoleLogKeys.get(key);
  if (!ts) return false;
  if (Date.now() - ts > ROLE_LOG_DEDUP_TTL_MS) {
    recentRoleLogKeys.delete(key);
    return false;
  }
  return true;
}
function markSeen(key) {
  recentRoleLogKeys.set(key, Date.now());
}

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`👑 Credit: ${CREDIT}`);
  client.user.setPresence({ status: 'invisible' });
  loadSnapshots();
  client.guilds.cache.forEach(g => {
    refreshAuditCapability(g);
    try{ snapshotGuildChannels(g); }catch{}
  });
  console.log(`🛡️ Anti-Nuke พร้อมทำงาน | by ${CREDIT}`);
});

client.on('channelCreate', (ch) => {
  if(!ch.guild) return;
  const m = liveChannelSnap.get(ch.guild.id) || new Map();
  m.set(ch.id, serializeChannel(ch));
  liveChannelSnap.set(ch.guild.id, m);
  persistSnapshots();
});
client.on('channelUpdate', (_o, ch) => {
  if(!ch.guild) return;
  const m = liveChannelSnap.get(ch.guild.id) || new Map();
  m.set(ch.id, serializeChannel(ch));
  liveChannelSnap.set(ch.guild.id, m);
  persistSnapshots();
});
client.on('channelDelete', (ch) => {
  if(!ch.guild) return;
  const m = liveChannelSnap.get(ch.guild.id);
  const snap = m?.get(ch.id) || serializeChannel(ch);
  const cutoff = Date.now() - RESTORE_WINDOW_MS;
  const buf = (deletedChannelBuf.get(ch.guild.id) || []).filter(x => x.ts >= cutoff);
  buf.push({ snap, ts: Date.now() });
  deletedChannelBuf.set(ch.guild.id, buf);
  if(m){ m.delete(ch.id); persistSnapshots(); }
});

client.on('guildCreate', (guild) => {
  refreshAuditCapability(guild);
  try{ snapshotGuildChannels(guild); }catch{}
});

client.on('guildMemberUpdate', (_o, n) => {
  refreshAuditCapability(n.guild);
});

client.on('messageCreate', async (message) => {
  try{
    if(!message.inGuild()) return;
    if(message.author?.id === client.user.id) return;

    const me = message.guild.members.me;
    if(!me?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    if(message.webhookId){
      if(!WL_WEBHOOK.has(message.webhookId)){
        await message.delete().catch(()=>{});
        await sendLog(message.guild, embedInfo('🧹 ลบข้อความจาก Webhook ที่ไม่อนุญาต', [
          ['ช่อง', `<#${message.channel.id}>`],
          ['webhookId', `\`${message.webhookId}\``],
        ], 'Red'));
      }
      return;
    }

    if(message.author?.bot){
      const botId = message.author.id;
      const appId = message.applicationId ?? null;

      const installed = await isInstalledBot(message.guild, botId);
      if(!installed){
        await message.delete().catch(()=>{});
        await sendLog(message.guild, embedInfo('🧹 ลบข้อความ — botId ไม่ได้อยู่ในกิลด์', [
          ['ช่อง', `<#${message.channel.id}>`],
          ['botId', `\`${botId}\``],
        ], 'Red'));
        return;
      }
      if(REQUIRE_ALLOWED_BOT_IDS && !WL_BOTS.has(botId)){
        await message.delete().catch(()=>{});
        await sendLog(message.guild, embedInfo('🧹 ลบข้อความ — bot ไม่อยู่ใน allowlist', [
          ['ช่อง', `<#${message.channel.id}>`],
          ['botId', `\`${botId}\``],
        ], 'Red'));
        return;
      }
      if(appId && !WL_APPS.has(appId)){
        await message.delete().catch(()=>{});
        await sendLog(message.guild, embedInfo('🧹 ลบข้อความ — applicationId ไม่อยู่ใน allowlist', [
          ['ช่อง', `<#${message.channel.id}>`],
          ['applicationId', `\`${appId}\``],
          ['botId', `\`${botId}\``],
        ], 'Red'));
        return;
      }
    }
  }catch(e){ console.error('[anti-webhook/apps]', e); }
});

client.on('guildMemberAdd', async (member) => {
  if(!member.user.bot) return;
  const guild = member.guild;
  try{
    if(ALLOWED_BOT_IDS.includes(member.id)){
      await sendLog(guild, embedInfo('🟢 อนุญาตบอท (Allowlist)', [
        ['บอท', ufmt(member.user)],
        ['เหตุผล', 'Matched ALLOWED_BOT_IDS'],
      ], 'Green'));
      return;
    }

    const me = guild.members.me;
    const canView = me?.permissions.has(PermissionFlagsBits.ViewAuditLog);
    let entry = null;
    if(canView){
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 10 });
      const now = Date.now();
      entry = logs.entries.find(e => e?.target?.id === member.id && (now - e.createdTimestamp) <= AUDIT_LOG_WINDOW_MS) || null;
    }

    if(!entry){
      await handleUnauthorizedInvite(guild, member, null, 'ไม่พบผู้เชิญจาก Audit Log');
      return;
    }

    const inviterUser = entry.executor;
    const inviterMember = await guild.members.fetch(inviterUser.id).catch(()=>null);

    let allowed = false;
    if(ALLOW_ADMIN){
      if(inviterUser.id === guild.ownerId) allowed = true;
      if(!allowed && inviterMember?.permissions?.has(PermissionFlagsBits.Administrator)) allowed = true;
    }
    if(!allowed && inviterMember && WHITELIST_ROLE_IDS.length){
      allowed = inviterMember.roles.cache.some(r => WHITELIST_ROLE_IDS.includes(r.id));
    }

    if(allowed){
      await sendLog(guild, embedInfo('🟢 อนุญาตบอท', [
        ['ผู้เชิญ', ufmt(inviterUser)],
        ['บอท', ufmt(member.user)],
        ['เหตุผล', describeAllowReason(inviterMember)],
      ], 'Green'));
    }else{
      await handleUnauthorizedInvite(guild, member, inviterMember, 'ผู้เชิญไม่มีสิทธิ์ตามกฎ');
    }
  }catch(err){
    await sendLog(guild, embedInfo('⚠️ ระบบกันเชิญบอทผิดพลาด', [
      ['รายละเอียด', codeBlock(err?.stack || err?.message || String(err))],
      ['บอท', ufmt(member.user)],
    ], 'Orange'));
  }
});

async function handleUnauthorizedInvite(guild, botMember, inviterMember, reason){
  const actions = [];
  if(AUTODEL_BOT){
    try{ await botMember.kick('Anti-Bot: เชิญโดยไม่ได้รับอนุญาต'); actions.push('เตะบอทออกแล้ว'); }
    catch{ actions.push('เตะบอทไม่สำเร็จ (สิทธิ์/ลำดับ role ไม่พอ)'); }
  }

  let punished = 'ไม่ลงโทษ (PUNISHMENT=none หรือไม่ทราบผู้เชิญ)';
  if(inviterMember && PUNISHMENT !== 'none'){
    try{
      if(PUNISHMENT==='ban'){
        await guild.members.ban(inviterMember.id, { reason:'Anti-Bot: เชิญบอทโดยไม่ได้รับอนุญาต', deleteMessageSeconds:0 });
        punished = 'แบนผู้เชิญแล้ว';
      }else if(PUNISHMENT==='kick'){
        await inviterMember.kick('Anti-Bot: เชิญบอทโดยไม่ได้รับอนุญาต');
        punished = 'เตะผู้เชิญแล้ว';
      }
    }catch{ punished = 'ลงโทษผู้เชิญไม่สำเร็จ (สิทธิ์/ลำดับ role ไม่พอ)'; }
  }

  if(inviterMember && INVITER_DM){
    inviterMember.user.send({
      embeds:[ new EmbedBuilder()
        .setTitle('🚫 การเชิญบอทถูกปฏิเสธ')
        .setColor('Red')
        .setDescription([
          `บอท **${botMember.user.username}** ถูกปฏิเสธในเซิร์ฟเวอร์ **${guild.name}**`,
          '',
          `เหตุผล: **${reason}**`,
          'หากต้องการเชิญบอท โปรดติดต่อผู้ดูแลหรือเจ้าของเซิร์ฟเวอร์ก่อน',
        ].join('\n'))
        .setFooter({ text: `Credit: ${CREDIT}` })
        .setTimestamp()
      ]
    }).catch(()=>{});
  }

  await sendLog(guild, embedInfo('🚫 ตรวจพบการเชิญบอทโดยไม่ได้รับอนุญาต', [
    ['บอท', ufmt(botMember.user)],
    ['ผู้เชิญ', inviterMember ? ufmt(inviterMember.user) : 'ไม่ทราบ'],
    ['เหตุผล', reason],
    ['การกระทำ', actions.concat(punished).join(' | ') || '—'],
  ], 'Red'));
}

client.on('guildAuditLogEntryCreate', async (entry, guild) => {
  if(!SELF_PROTECT) return;
  try{
    const isKick = entry.action === AuditLogEvent.MemberKick;
    const isBan  = entry.action === AuditLogEvent.MemberBanAdd;
    if(!isKick && !isBan) return;
    if(entry.target?.id !== client.user.id) return;

    const actorId = entry.executorId;
    if(!actorId || actorId === client.user.id) return;

    const actorMember = await guild.members.fetch(actorId).catch(()=>null);
    if(!actorMember) return;

    const allowed =
      actorMember.id === guild.ownerId ||
      actorMember.roles.cache.some(r => PROTECT_ALLOWED_ROLE_IDS.includes(r.id));

    if(allowed){
      await sendLog(guild, embedInfo('⚠️ เตะ/แบนบอทโดยผู้ที่ได้รับอนุญาต', [
        ['ผู้กระทำ', ufmt(actorMember.user)],
        ['การกระทำ', isKick ? 'Kick Bot' : 'Ban Bot'],
      ], 'Orange'));
      return;
    }

    await retaliateAgainst(actorMember, guild, isKick ? 'Kick Bot' : 'Ban Bot');
  }catch(e){
    await sendLog(guild, embedInfo('⚠️ Self-Protect Error', [
      ['รายละเอียด', codeBlock(e?.stack || e?.message || String(e))],
    ], 'Orange'));
  }
});

async function retaliateAgainst(member, guild, actionLabel){
  let result = '—';
  try{
    if(SELF_PROTECT_PUNISHMENT==='ban'){
      await guild.members.ban(member.id, { reason:'Protect Bot: ห้ามเตะ/แบนบอท' });
      result = 'แบนผู้กระทำ';
    }else if(SELF_PROTECT_PUNISHMENT==='kick'){
      await member.kick('Protect Bot: ห้ามเตะ/แบนบอท');
      result = 'เตะผู้กระทำ';
    }else if(SELF_PROTECT_PUNISHMENT==='demote'){
      const willRemove = member.roles.cache.filter(r =>
        (r.permissions.has(PermissionFlagsBits.KickMembers) ||
         r.permissions.has(PermissionFlagsBits.BanMembers) ||
         r.permissions.has(PermissionFlagsBits.Administrator)) &&
        !PROTECT_ALLOWED_ROLE_IDS.includes(r.id)
      );
      for(const r of willRemove.values()){
        await member.roles.remove(r, 'Protect Bot: ลดสิทธิ์').catch(()=>{});
      }
      result = 'ลดสิทธิ์ผู้กระทำ';
    }else{
      result = 'ไม่ตอบโต้ (ตั้งค่า none)';
    }
  }catch{ result = 'ตอบโต้ไม่สำเร็จ (สิทธิ์/ลำดับ role ไม่พอ)'; }

  await sendLog(guild, embedInfo('🛡️ ป้องกันบอท', [
    ['ผู้กระทำ', ufmt(member.user)],
    ['การกระทำ', actionLabel],
    ['ผลตอบโต้', result],
  ], 'Red'));
}

client.on('roleUpdate', async (oldRole, newRole) => {
  if(!PROTECT_ROLE_SENTINEL) return;
  if(PROTECT_ALLOWED_ROLE_IDS.includes(newRole.id)) return;

  const pOld = oldRole.permissions, pNew = newRole.permissions;
  const addedKick  = !pOld.has(PermissionFlagsBits.KickMembers) && pNew.has(PermissionFlagsBits.KickMembers);
  const addedBan   = !pOld.has(PermissionFlagsBits.BanMembers)  && pNew.has(PermissionFlagsBits.BanMembers);
  const addedAdmin = !pOld.has(PermissionFlagsBits.Administrator) && pNew.has(PermissionFlagsBits.Administrator);

  if(addedKick || addedBan || addedAdmin){
    try{
      await newRole.setPermissions(pOld, 'Role Sentinel: ย้อนสิทธิ์ Kick/Ban/Admin');
      await sendLog(newRole.guild, embedInfo('🔒 Role Sentinel', [
        ['Role', `<@&${newRole.id}>`],
        ['Action', 'ย้อนสิทธิ์ Kick/Ban/Admin กลับสภาพเดิม'],
      ], 'Yellow'));
    }catch(e){
      await sendLog(newRole.guild, embedInfo('⚠️ Role Sentinel ล้มเหลว', [
        ['Role', `<@&${newRole.id}>`],
        ['รายละเอียด', codeBlock(e?.stack || e?.message || String(e))],
      ], 'Orange'));
    }
  }
});

async function resolveAuditActor(entry, guild) {
  try {
    const actorId = entry.executorId ?? entry.executor?.id ?? null;
    if (!actorId) return { actorId: 'unknown', actorUser: null };
    if (entry.executor) return { actorId, actorUser: entry.executor };
    const actorUser = await guild.client.users.fetch(actorId).catch(() => null);
    return { actorId, actorUser };
  } catch {
    return { actorId: 'unknown', actorUser: null };
  }
}

const handledRoleAuditEntryIds = new Set();
const rolePerItemFP = new Map();
const ROLE_ITEM_TTL_MS = 20_000;

function markRoleItemFP(gid, uid, rid, type) {
  rolePerItemFP.set(`${gid}:${uid}:${rid}:${type}`, Date.now());
}
function seenRoleItemFP(gid, uid, rid, type) {
  const k = `${gid}:${uid}:${rid}:${type}`;
  const ts = rolePerItemFP.get(k);
  if (!ts) return false;
  if (Date.now() - ts > ROLE_ITEM_TTL_MS) { rolePerItemFP.delete(k); return false; }
  return true;
}

client.on('guildAuditLogEntryCreate', async (entry, guild) => {
  try {
    if (entry.action !== AuditLogEvent.MemberRoleUpdate) return;
    if (!guildAuditCapable.has(guild.id)) return;

    if (entry.id && handledRoleAuditEntryIds.has(entry.id)) return;
    if (entry.id) handledRoleAuditEntryIds.add(entry.id);

    const targetId = entry.targetId;
    if (!targetId) return;

    const reason = entry.reason || '—';
    const { actorId, actorUser } = await resolveAuditActor(entry, guild);

    const changes = entry.changes || [];
    const addChange    = changes.find(c => c.key === '$add');
    const removeChange = changes.find(c => c.key === '$remove');

    const addedIdsAll   = (addChange?.new || []).map(r => r.id).filter(Boolean);
    const removedIdsAll = (removeChange?.new || []).map(r => r.id).filter(Boolean);

    const addedIds   = addedIdsAll.filter(rid   => !seenRoleItemFP(guild.id, targetId, rid, 'ADD'));
    const removedIds = removedIdsAll.filter(rid => !seenRoleItemFP(guild.id, targetId, rid, 'REM'));
    if (addedIds.length === 0 && removedIds.length === 0) return;

    addedIds.forEach(rid   => markRoleItemFP(guild.id, targetId, rid, 'ADD'));
    removedIds.forEach(rid => markRoleItemFP(guild.id, targetId, rid, 'REM'));

    const key = makeRoleLogKey(guild.id, targetId, addedIds, removedIds, actorId);
    if (seenRecently(key)) return;
    markSeen(key);

    const fmt = (ids) => ids.length ? ids.map(id => `<@&${id}>`).join(', ') : '—';
    const targetUser = await guild.client.users.fetch(targetId).catch(() => null);

    if (addedIds.length) {
      await sendRoleLog(guild, embedInfo('➕ ใส่บทบาทให้สมาชิก', [
        ['สมาชิก', targetUser ? ufmt(targetUser) : targetId],
        ['บทบาทที่เพิ่ม', fmt(addedIds)],
        ['ผู้กระทำ', actorUser ? ufmt(actorUser) : actorId],
        ['เหตุผล', reason],
      ], 'Green'));
    }
    if (removedIds.length) {
      await sendRoleLog(guild, embedInfo('➖ ถอดบทบาทจากสมาชิก', [
        ['สมาชิก', targetUser ? ufmt(targetUser) : targetId],
        ['บทบาทที่ถอด', fmt(removedIds)],
        ['ผู้กระทำ', actorUser ? ufmt(actorUser) : actorId],
        ['เหตุผล', reason],
      ], 'Red'));
    }
  } catch (err) {
    await sendRoleLog(guild, embedInfo('⚠️ Role Audit Logger Error', [
      ['รายละเอียด', codeBlock(err?.stack || err?.message || String(err))],
    ], 'Orange'));
  }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const guild = newMember.guild;
    if (guildAuditCapable.has(guild.id)) return;

    const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const addedIdsAll   = [...addedRoles.keys()];
    const removedIdsAll = [...removedRoles.keys()];
    const addedIds      = addedIdsAll.filter(rid   => !seenRoleItemFP(guild.id, newMember.id, rid, 'ADD'));
    const removedIds    = removedIdsAll.filter(rid => !seenRoleItemFP(guild.id, newMember.id, rid, 'REM'));
    if (addedIds.length === 0 && removedIds.length === 0) return;

    addedIds.forEach(rid   => markRoleItemFP(guild.id, newMember.id, rid, 'ADD'));
    removedIds.forEach(rid => markRoleItemFP(guild.id, newMember.id, rid, 'REM'));

    const key = makeRoleLogKey(guild.id, newMember.id, addedIds, removedIds, 'fallback');
    if (seenRecently(key)) return;
    markSeen(key);

    let actorTag = 'ไม่ทราบ';
    let reasonStr = '—';
    try {
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 10 });
      const now = Date.now();
      const entry = logs.entries.find(e =>
        e?.target?.id === newMember.id && (now - e.createdTimestamp) <= AUDIT_LOG_WINDOW_MS
      );
      if (entry) {
        const { actorId, actorUser } = await resolveAuditActor(entry, guild);
        actorTag = actorUser ? ufmt(actorUser) : (actorId || 'ไม่ทราบ');
        reasonStr = entry.reason || reasonStr;
      }
    } catch {}

    const fmt = (ids) => ids.length ? ids.map(id => `<@&${id}>`).join(', ') : '—';

    if (addedIds.length) {
      await sendRoleLog(guild, embedInfo('➕ ใส่บทบาทให้สมาชิก', [
        ['สมาชิก', ufmt(newMember.user)],
        ['บทบาทที่เพิ่ม', fmt(addedIds)],
        ['ผู้กระทำ', actorTag],
        ['เหตุผล', reasonStr],
      ], 'Green'));
    }
    if (removedIds.length) {
      await sendRoleLog(guild, embedInfo('➖ ถอดบทบาทจากสมาชิก', [
        ['สมาชิก', ufmt(newMember.user)],
        ['บทบาทที่ถอด', fmt(removedIds)],
        ['ผู้กระทำ', actorTag],
        ['เหตุผล', reasonStr],
      ], 'Red'));
    }
  } catch (err) {
    await sendRoleLog(newMember.guild, embedInfo('⚠️ Role Logger Error', [
      ['รายละเอียด', codeBlock(err?.stack || err?.message || String(err))],
    ], 'Orange'));
  }
});

function canManage(member){
  if(!member) return false;
  if(member.id === member.guild.ownerId) return true;
  if(member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(r => PROTECT_ALLOWED_ROLE_IDS.includes(r.id));
}

client.on('messageCreate', async (message) => {
  try{
    if(!message.inGuild() || message.author?.bot) return;
    if(!message.content.startsWith(CMD_PREFIX)) return;

    const args = message.content.slice(CMD_PREFIX.length).trim().split(/\s+/);
    const cmd = (args.shift() || '').toLowerCase();
    if(!['antinuke','status','lock','unlock','backup','restore','help'].includes(cmd)) return;

    const member = message.member || await message.guild.members.fetch(message.author.id).catch(()=>null);
    if(!canManage(member)){
      return void message.reply('⛔ คำสั่งนี้ใช้ได้เฉพาะเจ้าของ/แอดมิน/role ที่กำหนดเท่านั้น').catch(()=>{});
    }
    const guild = message.guild;

    if(cmd === 'help'){
      return void message.reply({ embeds:[ new EmbedBuilder().setTitle('🛡️ คำสั่งจัดการ Anti-Nuke').setColor('Blurple').setFooter({ text: `Credit: ${CREDIT}` }).setDescription([
        `\`${CMD_PREFIX}status\` — ดูสถานะ/ตั้งค่าระบบ`,
        `\`${CMD_PREFIX}lock [นาที]\` — เปิด panic-lock เอง (ดีฟอลต์ ${Math.round(PANIC_LOCK_DURATION_MS/60000)} นาที)`,
        `\`${CMD_PREFIX}unlock\` — ปลด panic-lock`,
        `\`${CMD_PREFIX}backup\` — บันทึก snapshot ห้องใหม่`,
        `\`${CMD_PREFIX}restore\` — กู้คืนห้องที่เพิ่งถูกลบ`,
      ].join('\n')) ]}).catch(()=>{});
    }

    if(cmd === 'antinuke' || cmd === 'status'){
      const snapCount = liveChannelSnap.get(guild.id)?.size ?? 0;
      const locked = isLockedDown(guild.id);
      const lockLeft = locked ? Math.max(0, Math.round((lockdownState.get(guild.id).until - Date.now())/1000)) : 0;
      return void message.reply({ embeds:[ embedInfo('🛡️ สถานะ Anti-Nuke', [
        ['ระบบ', ANTINUKE_ENABLED ? '🟢 เปิด' : '🔴 ปิด'],
        ['บทลงโทษ', NUKE_PUNISHMENT],
        ['หน้าต่างตรวจจับ', `${Math.round(NUKE_WINDOW_MS/1000)} วิ`],
        ['Auto-restore', AUTO_RESTORE_CHANNELS ? '🟢 เปิด' : '🔴 ปิด'],
        ['Panic-Lock', PANIC_LOCK_ENABLED ? '🟢 เปิด' : '🔴 ปิด'],
        ['สถานะ Lockdown', locked ? `🔴 ล็อกอยู่ (เหลือ ${lockLeft} วิ)` : '🟢 ปกติ'],
        ['ดู Audit Log ได้', guildAuditCapable.has(guild.id) ? '✅ ใช่' : '❌ ไม่ (ระบบจะทำงานไม่ครบ!)'],
        ['Snapshot ห้อง', `${snapCount} ห้อง`],
      ], locked ? 'Red' : 'Green') ]}).catch(()=>{});
    }

    if(cmd === 'lock'){
      const mins = Number(args[0]);
      const ms = Number.isFinite(mins) && mins > 0 ? mins*60000 : PANIC_LOCK_DURATION_MS;
      await enterLockdown(guild, ms, `สั่งโดย ${ufmt(message.author)}`);
      return void message.reply(`🔴 เปิด panic-lock แล้ว (${Math.round(ms/60000)} นาที)`).catch(()=>{});
    }

    if(cmd === 'unlock'){
      if(!isLockedDown(guild.id)) return void message.reply('ℹ️ ตอนนี้ไม่ได้อยู่ในโหมด lockdown').catch(()=>{});
      await exitLockdown(guild, `สั่งโดย ${ufmt(message.author)}`);
      return void message.reply('🟢 ปลด panic-lock แล้ว').catch(()=>{});
    }

    if(cmd === 'backup'){
      const n = snapshotGuildChannels(guild);
      return void message.reply(`💾 บันทึก snapshot แล้ว: ${n} ห้อง`).catch(()=>{});
    }

    if(cmd === 'restore'){
      const r = await restoreChannels(guild);
      return void message.reply(`♻️ กู้คืนห้องที่เพิ่งถูกลบ: สร้างคืน ${r.created} ห้อง${r.failed?` (พลาด ${r.failed})`:''}`).catch(()=>{});
    }
  }catch(e){ console.error('[commands]', e); }
});

console.log(`
${c.cyan}${c.bold}${makeBanner('LILNUT788')}${c.reset}
${c.gray}  Discord Anti-Nuke Bot  •  Powered by Discord.js v14  •  Credit: ${CREDIT}${c.reset}
`);

client.login(process.env.DISCORD_TOKEN);
