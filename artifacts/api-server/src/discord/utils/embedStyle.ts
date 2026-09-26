import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type APIEmbedField, type ColorResolvable } from "discord.js";
import { shouldShowAds, isCurrentContextPremium } from "./botContext";

export const SUPPORT_SERVER_URL = "https://discord.gg/gFgAfpSYdp";
export const BOT_INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1466728565352435847&permissions=8&scope=bot%20applications.commands";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL EMBED SANITIZATION:
// Discord DOES NOT render custom emojis (<:name:id> or <a:name:id>) in embed
// titles, author names, or footer text. They render as ugly raw text.
// We sanitize these globally so every embed across the entire bot is pristine.
// ─────────────────────────────────────────────────────────────────────────────
const origSetTitle = EmbedBuilder.prototype.setTitle;
EmbedBuilder.prototype.setTitle = function (this: EmbedBuilder, title: string | null) {
  if (!title) return origSetTitle.call(this, title);
  const cleaned = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  return origSetTitle.call(this, cleaned || " ");
};

const origSetFooter = EmbedBuilder.prototype.setFooter;
EmbedBuilder.prototype.setFooter = function (this: EmbedBuilder, options: any) {
  if (!options) return origSetFooter.call(this, options);
  if (typeof options.text === "string") {
    options.text = options.text.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  return origSetFooter.call(this, options);
};

const origSetAuthor = EmbedBuilder.prototype.setAuthor;
EmbedBuilder.prototype.setAuthor = function (this: EmbedBuilder, options: any) {
  if (!options) return origSetAuthor.call(this, options);
  if (typeof options.name === "string") {
    options.name = options.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  return origSetAuthor.call(this, options);
};

const origToJSON = EmbedBuilder.prototype.toJSON;
EmbedBuilder.prototype.toJSON = function (this: EmbedBuilder) {
  const json: any = origToJSON.call(this);
  if (!json.color) {
    json.color = 0x2b2d31;
  }
  const showAds = shouldShowAds();
  if (showAds) {
    if (!json.footer?.text || json.footer.text === "Relosta High-Fidelity Audio" || json.footer.text === "Relosta Audio VIP Engine") {
      json.footer = {
        text: getRandomMarketingFooter(json.footer?.text),
        icon_url: json.footer?.icon_url,
      };
    } else if (!json.footer.text.includes("discord.gg/gFgAfpSYdp") && !json.footer.text.startsWith("Page ")) {
      json.footer.text = getRandomMarketingFooter(json.footer.text);
    }
  } else {
    // Premium users: Strip any promotional marketing ads from footers
    if (json.footer?.text) {
      json.footer.text = json.footer.text
        .replace(/•?\s*discord\.gg\/\S+/g, "")
        .replace(/•?\s*Tired of lag.*$/i, "")
        .replace(/•?\s*Don't let raiders.*$/i, "")
        .replace(/•?\s*Elevate your server.*$/i, "")
        .replace(/•?\s*Crystal-clear.*$/i, "")
        .replace(/•?\s*Stop settling.*$/i, "")
        .replace(/•?\s*Enterprise Protection.*$/i, "")
        .replace(/•?\s*Your community deserves.*$/i, "")
        .trim();
      if (!json.footer.text) {
        json.footer.text = `${getBotName()} • VIP Engine`;
      }
    }
  }
  if (json.title) {
    json.title = json.title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  if (json.author?.name) {
    json.author.name = json.author.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  if (json.footer?.text) {
    json.footer.text = json.footer.text.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  return json;
};

export const MARKETING_PITCHES = [
  "Tired of lag & downtime? Unlock 24/7 High-Fi Voice & VIP Perks • discord.gg/gFgAfpSYdp",
  "Don't let raiders ruin your hard work. Get God-Mode Anti-Nuke with Premium • discord.gg/gFgAfpSYdp",
  "Elevate your server to VIP status • Instant No-Prefix Commands: discord.gg/gFgAfpSYdp",
  "Crystal-clear 384kbps audio & 24/7 dedicated voice node • Join: discord.gg/gFgAfpSYdp",
  "Stop settling for basic bots. Transform your community with Premium • discord.gg/gFgAfpSYdp",
  "Enterprise Protection & Unmatched Reliability • Claim your VIP Pass: discord.gg/gFgAfpSYdp",
  "Your community deserves the best. Upgrade to Relosta Premium today • discord.gg/gFgAfpSYdp",
];

export function getRandomMarketingFooter(fallback?: string): string {
  if (!shouldShowAds()) {
    if (fallback) {
      return fallback
        .replace(/•?\s*discord\.gg\/\S+/g, "")
        .replace(/•?\s*Tired of lag.*$/i, "")
        .replace(/•?\s*Don't let raiders.*$/i, "")
        .replace(/•?\s*Elevate your server.*$/i, "")
        .replace(/•?\s*Crystal-clear.*$/i, "")
        .replace(/•?\s*Stop settling.*$/i, "")
        .replace(/•?\s*Enterprise Protection.*$/i, "")
        .replace(/•?\s*Your community deserves.*$/i, "")
        .replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "")
        .trim() || `${getBotName()} • VIP Engine`;
    }
    return `${getBotName()} • VIP Engine`;
  }
  if (fallback && (fallback.includes("discord.gg") || fallback.includes("Relosta Premium"))) {
    return fallback.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  }
  const pitch = MARKETING_PITCHES[Math.floor(Math.random() * MARKETING_PITCHES.length)];
  return fallback 
    ? `${fallback.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim()} • ${pitch}` 
    : pitch;
}

export function buildSupportRow(customLabel?: string, forceNonPremium = false): ActionRowBuilder<ButtonBuilder> {
  const cleanLabel = (customLabel || "Official Support Server")
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu, "")
    .trim();

  // If user is premium and not forced, do NOT show ad buttons (Get Premium / Invite)
  if (!shouldShowAds() && !forceNonPremium) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel(cleanLabel || "Support Server")
        .setEmoji(CE.chat.id)
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_SERVER_URL)
    );
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Get Relosta Premium")
      .setEmoji(CE.boost.id)
      .setStyle(ButtonStyle.Link)
      .setURL(SUPPORT_SERVER_URL),
    new ButtonBuilder()
      .setLabel(cleanLabel || "Official Support Server")
      .setEmoji(CE.chat.id)
      .setStyle(ButtonStyle.Link)
      .setURL(SUPPORT_SERVER_URL),
    new ButtonBuilder()
      .setLabel("Invite Relosta Bot")
      .setEmoji(CE.promotion.id)
      .setStyle(ButtonStyle.Link)
      .setURL(BOT_INVITE_URL)
  );
}

let cachedBotName = "Bot";

export function setCachedBotName(name: string | null | undefined): void {
  if (name && name.trim()) {
    cachedBotName = name.trim();
  }
}

export function getBotName(): string {
  return cachedBotName;
}

export const COLORS = {
  primary: 0x2b2d31,
  success: 0x57f287,
  warning: 0xfee75c,
  danger:  0xed4245,
  info:    0x5dade2,
  neutral: 0x99aab5,
  staff:   0x9b59b6,
  premium: 0xffd700,
} as const;

export interface CustomEmojiEntry {
  str: string;
  id: string;
  name: string;
  animated: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM EMOJI REGISTRY — All from the Relosta Bot emoji server & Dev server
// Update IDs here and every command/embed updates automatically.
// Static:   <:name:id>   |   Animated: <a:name:id>
// ─────────────────────────────────────────────────────────────────────────────
export const CE: Record<string, CustomEmojiEntry> = {
  // ── Status ───────────────────────────────────────────────────────────────
  success:       { str: "<a:yellow_tick:1471104306286694451>", id: "1471104306286694451", name: "yellow_tick",    animated: true  },
  check:         { str: "<a:SuccesWhite:1551170061404864546>", id: "1551170061404864546", name: "SuccesWhite",   animated: true  },
  check_yes:     { str: "<a:yellow_tick:1471104306286694451>", id: "1471104306286694451", name: "yellow_tick",    animated: true  },
  check_no:      { str: "<:874346wrong:1511387734483144764>", id: "1511387734483144764", name: "874346wrong",   animated: false },
  loading:       { str: "<a:white:1551170067058786309>",      id: "1551170067058786309", name: "white",         animated: true  },
  error:         { str: "<:4561pinkerror:1511387678170677377>",id: "1511387678170677377", name: "4561pinkerror", animated: false },
  failure:       { str: "<:874346wrong:1511387734483144764>", id: "1511387734483144764", name: "874346wrong",   animated: false },
  failureorno:   { str: "<:874346wrong:1511387734483144764>", id: "1511387734483144764", name: "874346wrong",   animated: false },
  warning:       { str: "<:red_info:1471148734833492065>",    id: "1471148734833492065", name: "red_info",      animated: false },
  verified:      { str: "<:1178verified:1519270217912422441>", id: "1519270217912422441", name: "1178verified",  animated: false },
  // ── People ───────────────────────────────────────────────────────────────
  members:       { str: "<:user:1519271719137968238>",        id: "1519271719137968238", name: "user",          animated: false },
  user:          { str: "<:botuser:1551170035773481070>",     id: "1551170035773481070", name: "botuser",       animated: false },
  staff:         { str: "<:8968pastelstaff:1471148829888872661>",id: "1471148829888872661", name: "8968pastelstaff",animated: false },
  admin:         { str: "<:RedAdmin:1471461238620946584>",    id: "1471461238620946584", name: "RedAdmin",      animated: false },
  manager:       { str: "<:crown_leads:1471104546582302929>", id: "1471104546582302929", name: "crown_leads",   animated: false },
  owner:         { str: "<:Founders:1471148780530434333>",    id: "1471148780530434333", name: "Founders",      animated: false },
  developer:     { str: "<:white_botdev:956255837091934338>", id: "956255837091934338", name: "white_botdev",  animated: false },
  creators:      { str: "<:creators:1510521109441675334>",    id: "1510521109441675334", name: "creators",      animated: false },
  bot:           { str: "<:bots:1551170028517335140>",        id: "1551170028517335140", name: "bots",          animated: false },
  white_bot:     { str: "<:white_bot:1521553655126425640>",   id: "1521553655126425640", name: "white_bot",     animated: false },
  // ── Moderation & Systems ──────────────────────────────────────────────────
  moderation:    { str: "<:RedAdmin:1471461238620946584>",    id: "1471461238620946584", name: "RedAdmin",      animated: false },
  ban:           { str: "<:x_logMessage:1519269247908581498>",id: "1519269247908581498", name: "x_logMessage",  animated: false },
  mute:          { str: "<:red_info:1471148734833492065>",    id: "1471148734833492065", name: "red_info",      animated: false },
  mute_icon:     { str: "<:red_info:1471148734833492065>",    id: "1471148734833492065", name: "red_info",      animated: false },
  nuke:          { str: "<a:FireRedandBlack:1471148448622444679>",id: "1471148448622444679", name: "FireRedandBlack",animated: true},
  termination:   { str: "<:4561pinkerror:1511387678170677377>",id: "1511387678170677377", name: "4561pinkerror", animated: false },
  demotion:      { str: "<:bottom:1551170032183025705>",      id: "1551170032183025705", name: "bottom",        animated: false },
  promotion:     { str: "<a:red_point:1471148554717499558>",  id: "1471148554717499558", name: "red_point",     animated: true  },
  // ── UI / Info & Communication ─────────────────────────────────────────────
  information:   { str: "<:botinfo:1551170025732313109>",     id: "1551170025732313109", name: "botinfo",       animated: false },
  link:          { str: "<:ng_website:1471456690766348350>",   id: "1471456690766348350", name: "ng_website",    animated: false },
  link_icon:     { str: "<:ng_website:1471456690766348350>",   id: "1471456690766348350", name: "ng_website",    animated: false },
  notifications: { str: "<a:announcement:1471459879448477739>",id: "1471459879448477739", name: "announcement",animated: true },
  announce:      { str: "<:serverannounce:1519271127854088282>",id: "1519271127854088282", name: "serverannounce",animated: false},
  settings:      { str: "<:guidelines:1471461018956988568>",   id: "1471461018956988568", name: "guidelines",   animated: false },
  automod:       { str: "<:guidelines:1471461018956988568>",   id: "1471461018956988568", name: "guidelines",   animated: false },
  locked:        { str: "<:red_info:1471148734833492065>",    id: "1471148734833492065", name: "red_info",      animated: false },
  folder:        { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  clipboard:     { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  delete:        { str: "<:x_logMessage:1519269247908581498>",id: "1519269247908581498", name: "x_logMessage",  animated: false },
  trash:         { str: "<:x_logMessage:1519269247908581498>",id: "1519269247908581498", name: "x_logMessage",  animated: false },
  ticket:        { str: "<a:Tickets_t:1471148888957124710>",  id: "1471148888957124710", name: "Tickets_t",    animated: true  },
  calendar:      { str: "<:botCalendarLight:1551170019226947625>",id: "1551170019226947625", name: "botCalendarLight",animated: false},
  level:         { str: "<a:red_point:1471148554717499558>",  id: "1471148554717499558", name: "red_point",     animated: true  },
  chart:         { str: "<:botinfo:1551170025732313109>",     id: "1551170025732313109", name: "botinfo",       animated: false },
  trophy:        { str: "<a:stars:1471148954581209223>",      id: "1471148954581209223", name: "stars",         animated: true  },
  dm_sent:       { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  incoming:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  outgoing:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  eightball:     { str: "<:botinfo:1551170025732313109>",     id: "1551170025732313109", name: "botinfo",       animated: false },
  fortune:       { str: "<a:stars:1471148954581209223>",      id: "1471148954581209223", name: "stars",         animated: true  },
  slots:         { str: "<:250885giveaway:1519270730540253204>",id: "1519270730540253204", name: "250885giveaway",animated: false},
  slotmachine:   { str: "<:250885giveaway:1519270730540253204>",id: "1519270730540253204", name: "250885giveaway",animated: false},
  bullseye:      { str: "<:red_info:1471148734833492065>",    id: "1471148734833492065", name: "red_info",      animated: false },
  dead:          { str: "<:4561pinkerror:1511387678170677377>",id: "1511387678170677377", name: "4561pinkerror", animated: false },
  roulette:      { str: "<a:FireRedandBlack:1471148448622444679>",id: "1471148448622444679", name: "FireRedandBlack",animated: true},
  gun:           { str: "<a:FireRedandBlack:1471148448622444679>",id: "1471148448622444679", name: "FireRedandBlack",animated: true},
  ship:          { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  ship_header:   { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  ship_filled:   { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  ship_empty:    { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  soulmate:      { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  soulmates:     { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  soulmates_ring:{ str: "<a:PurpleStar:1471148510245294100>", id: "1471148510245294100", name: "PurpleStar",    animated: true  },
  no_luck_face:  { str: "<:4561pinkerror:1511387678170677377>",id: "1511387678170677377", name: "4561pinkerror", animated: false },
  rank1:         { str: "<a:stars:1471148954581209223>",      id: "1471148954581209223", name: "stars",         animated: true  },
  rank2:         { str: "<a:red_point:1471148554717499558>",  id: "1471148554717499558", name: "red_point",     animated: true  },
  rank3:         { str: "<:user:1519271719137968238>",        id: "1519271719137968238", name: "user",          animated: false },
  // ── Shop & Premium ───────────────────────────────────────────────────────
  cash:          { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  cashout:       { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  ltc:           { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  shoppingcart:  { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  discount:      { str: "<:BotCompras:1551170021999255552>",  id: "1551170021999255552", name: "BotCompras",    animated: false },
  limited:       { str: "<a:PurpleStar:1471148510245294100>", id: "1471148510245294100", name: "PurpleStar",    animated: true  },
  star:          { str: "<a:stars:1471148954581209223>",      id: "1471148954581209223", name: "stars",         animated: true  },
  star_rating:   { str: "<a:stars:1471148954581209223>",      id: "1471148954581209223", name: "stars",         animated: true  },
  heart:         { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  chat:          { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  // ── Games & Fun ──────────────────────────────────────────────────────────
  giveaway:      { str: "<:250885giveaway:1519270730540253204>",id: "1519270730540253204", name: "250885giveaway",animated: false},
  boost:         { str: "<a:boosts:1511698728820670645>",     id: "1511698728820670645", name: "boosts",        animated: true  },
  fire:          { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  streak:        { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  arrow_red:     { str: "<:redarrow:1481966135917281430>",    id: "1481966135917281430", name: "redarrow",      animated: false },
  arrow_yellow:  { str: "<:y_arrow:1519269086775873536>",     id: "1519269086775873536", name: "y_arrow",       animated: false },
  arrow_anim:    { str: "<a:arrow_arrow:1511698578567860404>",id: "1511698578567860404", name: "arrow_arrow",  animated: true  },
  // ── Music Player & Controls ──────────────────────────────────────────────
  music:         { str: "<a:music:1551170042346082397>",      id: "1551170042346082397", name: "music",         animated: true  },
  play:          { str: "<a:playing:1551170052806541323>",    id: "1551170052806541323", name: "playing",       animated: true  },
  pause:         { str: "<:p_musicstop:1358407974690750524>", id: "1358407974690750524", name: "p_musicstop",  animated: false },
  stop:          { str: "<:p_musicstop:1358407974690750524>", id: "1358407974690750524", name: "p_musicstop",  animated: false },
  skip:          { str: "<a:arrow_arrow:1511698578567860404>",id: "1511698578567860404", name: "arrow_arrow",  animated: true  },
  music_bot:     { str: "<:001_music:1551170011899371642>",   id: "1551170011899371642", name: "001_music",     animated: false },
  music_queue:   { str: "<:selectionmenu_music_white:1251537150999003187>",id: "1251537150999003187", name: "selectionmenu_music_white", animated: false },
  white_musicnote:{ str: "<:white_musicnote:964953681730613258>",id: "964953681730613258", name: "white_musicnote", animated: false },
  // ── Social & Platforms ───────────────────────────────────────────────────
  discord:       { str: "<:Discord:1472116340939554900>",     id: "1472116340939554900", name: "Discord",       animated: false },
  youtube:       { str: "<:YOUTUBE:1514591262962090085>",     id: "1514591262962090085", name: "YOUTUBE",       animated: false },
  instagram:     { str: "<:Instagram:1471456550408159253>",  id: "1471456550408159253", name: "Instagram",     animated: false },
  google:        { str: "<:google:1514592158403923979>",      id: "1514592158403923979", name: "google",        animated: false },
  gmail:         { str: "<:gmail:1472115964395913247>",       id: "1472115964395913247", name: "gmail",         animated: false },
  india:         { str: "<:India:1514592784093417593>",       id: "1514592784093417593", name: "India",         animated: false },
  partnered:     { str: "<:Partnered:1472116412033011762>",   id: "1472116412033011762", name: "Partnered",     animated: false },
  // ── Fallback UI ──────────────────────────────────────────────────────────
  draw:          { str: "<:Partnered:1472116412033011762>",   id: "1472116412033011762", name: "Partnered",     animated: false },
  clock:         { str: "<:botCalendarLight:1551170019226947625>",id: "1551170019226947625", name: "botCalendarLight",animated: false},
  media:         { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  prank:         { str: "<:AGzO_Loll:1511417840975089837>",   id: "1511417840975089837", name: "AGzO_Loll",     animated: false },
  equalizer:     { str: "<a:music:1551170042346082397>",      id: "1551170042346082397", name: "music",         animated: true  },
  radio:         { str: "<a:announcement:1471459879448477739>",id: "1471459879448477739", name: "announcement",animated: true },
  loop_icon:     { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  volume_icon:   { str: "<a:red_point:1471148554717499558>",  id: "1471148554717499558", name: "red_point",     animated: true  },
  upvote:        { str: "<a:yellow_tick:1471104306286694451>",id: "1471104306286694451", name: "yellow_tick",    animated: true  },
  rope:          { str: "<:red_info:1471148734833492065>",    id: "1471148734833492065", name: "red_info",      animated: false },
  transcript:    { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  launch:        { str: "<a:red_point:1471148554717499558>",  id: "1471148554717499558", name: "red_point",     animated: true  },
  users_icon:    { str: "<:user:1519271719137968238>",        id: "1519271719137968238", name: "user",          animated: false },
  key_icon:      { str: "<:RedAdmin:1471461238620946584>",    id: "1471461238620946584", name: "RedAdmin",      animated: false },
  edit_icon:     { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  recycle:       { str: "<:guidelines:1471461018956988568>",   id: "1471461018956988568", name: "guidelines",   animated: false },
  spam:          { str: "<a:FireRedandBlack:1471148448622444679>",id: "1471148448622444679", name: "FireRedandBlack",animated: true},
  badwords:      { str: "<:x_logMessage:1519269247908581498>",id: "1519269247908581498", name: "x_logMessage",  animated: false },
  mentions_icon: { str: "<a:announcement:1471459879448477739>",id: "1471459879448477739", name: "announcement",animated: true },
  attach:        { str: "<:ng_website:1471456690766348350>",   id: "1471456690766348350", name: "ng_website",    animated: false },
  location:      { str: "<:user:1519271719137968238>",        id: "1519271719137968238", name: "user",          animated: false },
  thinking:      { str: "<:botinfo:1551170025732313109>",     id: "1551170025732313109", name: "botinfo",       animated: false },
  c4_red:        { str: "<a:red_point:1471148554717499558>",  id: "1471148554717499558", name: "red_point",     animated: true  },
  c4_yellow:     { str: "<:y_arrow:1519269086775873536>",     id: "1519269086775873536", name: "y_arrow",       animated: false },
  c4_empty:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  slot_cherry:   { str: "<a:red_point:1471148554717499558>",  id: "1471148554717499558", name: "red_point",     animated: true  },
  slot_lemon:    { str: "<:y_arrow:1519269086775873536>",     id: "1519269086775873536", name: "y_arrow",       animated: false },
  slot_grape:    { str: "<a:PurpleStar:1471148510245294100>", id: "1471148510245294100", name: "PurpleStar",    animated: true  },
  slot_bell:     { str: "<a:announcement:1471459879448477739>",id: "1471459879448477739", name: "announcement",animated: true },
  slot_diamond:  { str: "<a:PurpleStar:1471148510245294100>", id: "1471148510245294100", name: "PurpleStar",    animated: true  },
  slot_seven:    { str: "<a:Fire_Cyan:1466875400243384421>",  id: "1466875400243384421", name: "Fire_Cyan",     animated: true  },
  jackpot:       { str: "<:250885giveaway:1519270730540253204>",id: "1519270730540253204", name: "250885giveaway",animated: false},
  big_win:       { str: "<a:stars:1471148954581209223>",      id: "1471148954581209223", name: "stars",         animated: true  },
  small_win:     { str: "<a:yellow_tick:1471104306286694451>",id: "1471104306286694451", name: "yellow_tick",    animated: true  },
  rps_rock:      { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  rps_paper:     { str: "<:0white_pm:1551170015774900294>",   id: "1551170015774900294", name: "0white_pm",     animated: false },
  rps_scissors:  { str: "<:x_logMessage:1519269247908581498>",id: "1519269247908581498", name: "x_logMessage",  animated: false },
  rps_win:       { str: "<a:yellow_tick:1471104306286694451>",id: "1471104306286694451", name: "yellow_tick",    animated: true  },
};

export function updateCustomEmoji(key: string, data: CustomEmojiEntry): void {
  CE[key] = data;
}

/** Semantic aliases — all resolve to CE custom emojis. */
export const EMOJI = {
  ok:        CE.success.str,
  fail:      CE.error.str,
  warn:      CE.warning.str,
  info:      CE.information.str,
  loading:   CE.loading.str,
  shield:    CE.admin.str,
  crown:     CE.owner.str,
  star:      CE.staff.str,
  fire:      CE.streak.str,
  bomb:      CE.nuke.str,
  rocket:    CE.promotion.str,
  user:      CE.members.str,
  users:     CE.members.str,
  role:      CE.staff.str,
  channel:   CE.settings.str,
  ping:      CE.notifications.str,
  list:      CE.clipboard.str,
  clock:     CE.information.str,
  cal:       CE.information.str,
  msg:       CE.dm_sent.str,
  hammer:    CE.ban.str,
  tools:     CE.settings.str,
  gear:      CE.settings.str,
  ban:       CE.ban.str,
  mute:      CE.mute.str,
  unmute:    CE.check.str,
  kick:      CE.gun.str,
  bell:      CE.notifications.str,
  lock:      CE.locked.str,
  unlock:    CE.check.str,
  bot:       CE.settings.str,
  server:    CE.admin.str,
  globe:     CE.link.str,
  link:      CE.link.str,
  arrowUp:   CE.promotion.str,
  arrowDown: CE.demotion.str,
  bullet:    "•",
  dot:       "·",
  spark:     CE.success.str,
  trophy:    CE.trophy.str,
  graph:     CE.level.str,
  party:     CE.giveaway.str,
} as const;

export function buildBullets(items: { label: string; value: string }[]): string {
  return items.map(f => `> **${f.label}:** ${f.value}`).join("\n");
}

export interface PrettyEmbedOpts {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  fields?: APIEmbedField[];
  footer?: string;
  thumbnail?: string;
  author?: { name: string; iconURL?: string };
  timestamp?: boolean;
  url?: string;
  image?: string;
}

export function prettyEmbed(opts: PrettyEmbedOpts): EmbedBuilder {
  const e = new EmbedBuilder().setColor(opts.color ?? COLORS.primary);
  if (opts.title) {
    const cleanTitle = opts.title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
    if (cleanTitle) e.setTitle(cleanTitle);
  }
  if (opts.description) e.setDescription(opts.description);
  if (opts.fields && opts.fields.length > 0) e.addFields(opts.fields);
  
  // Marketing-driven emotionally resonant footer
  const finalFooter = getRandomMarketingFooter(opts.footer);
  e.setFooter({ text: finalFooter });

  if (opts.thumbnail) e.setThumbnail(opts.thumbnail);
  if (opts.author) {
    e.setAuthor({
      name: opts.author.name.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim(),
      iconURL: opts.author.iconURL,
    });
  }
  if (opts.url) e.setURL(opts.url);
  if (opts.image) e.setImage(opts.image);
  if (opts.timestamp !== false) e.setTimestamp(new Date());
  return e;
}

function formatBlockquote(text?: string): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith(">") || trimmed.startsWith("```")) return trimmed;
  return trimmed
    .split("\n")
    .map(l => l.trim() ? `> ${l.trim()}` : ">")
    .join("\n");
}

export function successEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.success.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.success.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.success,
  });
}

export function errorEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.error.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.error.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.danger,
  });
}

export function warnEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.warning.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.warning.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.warning,
  });
}

export function infoEmbed(title: string, description?: string): EmbedBuilder {
  const cleanTitle = title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const desc = description 
    ? `${CE.information.str}  **${cleanTitle}**\n\n${formatBlockquote(description)}`
    : `${CE.information.str}  **${cleanTitle}**`;

  return prettyEmbed({
    description: desc,
    color: COLORS.info,
  });
}

export interface ModActionOpts {
  action: string;
  target: { tag: string; id: string; displayAvatarURL: (opts?: any) => string };
  moderator?: { tag: string; id: string };
  reason?: string;
  duration?: string;
  color?: ColorResolvable;
  emoji?: string;
  extraFields?: { label: string; value: string }[];
}

export function modActionEmbed(opts: ModActionOpts): EmbedBuilder {
  const cleanAction = opts.action.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const e = new EmbedBuilder()
    .setAuthor({ name: `${cleanAction} | ${opts.target.tag}`, iconURL: opts.target.displayAvatarURL({ size: 128 }) })
    .setColor(opts.color ?? COLORS.danger)
    .setDescription(
      (opts.emoji ? `${opts.emoji}  **Action Executed: ${cleanAction}**\n\n` : `**Action Executed: ${cleanAction}**\n\n`) +
      buildBullets([
        { label: "Target", value: `<@${opts.target.id}> (\`${opts.target.id}\`)` },
        ...(opts.moderator ? [{ label: "Moderator", value: `<@${opts.moderator.id}>` }] : []),
        ...(opts.duration ? [{ label: "Duration", value: opts.duration }] : []),
        { label: "Reason", value: opts.reason || "No reason provided." },
        ...(opts.extraFields || [])
      ])
    )
    .setFooter({ text: getRandomMarketingFooter(`${getBotName()} • Moderation`) })
    .setTimestamp(new Date());
    
  return e;
}

export interface UserActionOpts {
  title: string;
  target: { tag: string; id: string; displayAvatarURL: (opts?: any) => string };
  description?: string;
  fields?: { label: string; value: string }[];
  color?: ColorResolvable;
  emoji?: string;
  footer?: string;
}

export function userActionEmbed(opts: UserActionOpts): EmbedBuilder {
  const cleanTitle = opts.title.replace(/<a?:[a-zA-Z0-9_]+:\d+>\s*/g, "").trim();
  const e = new EmbedBuilder()
    .setAuthor({ name: opts.target.tag, iconURL: opts.target.displayAvatarURL({ size: 128 }) })
    .setTitle(cleanTitle)
    .setColor(opts.color ?? COLORS.primary);
    
  let desc = "";
  if (opts.emoji) desc += `${opts.emoji}  **${cleanTitle}**\n\n`;
  if (opts.description) desc += opts.description + "\n\n";
  if (opts.fields && opts.fields.length > 0) {
    desc += buildBullets(opts.fields);
  }
  if (desc) e.setDescription(desc.trim());
  
  e.setFooter({ text: getRandomMarketingFooter(opts.footer) });
  e.setTimestamp(new Date());
  return e;
}
