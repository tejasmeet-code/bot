import { dataFile } from "../../lib/paths";
import { loadPersistentJson, persistPersistentJson } from "./persistentJson";
import { Client, EmbedBuilder, User } from "discord.js";
import { CE, COLORS } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

const STORE = "bot_staff_store";
const FILE = () => dataFile("bot_staff_store.json");

export type BotStaffRole = "owner" | "co_owner" | "admin" | "mod" | "help";

export interface BotStaffMember {
  userId: string;
  role: BotStaffRole;
  assignedAt: number;
  assignedBy: string;
}

export interface BotStaffStore {
  staff: Record<string, BotStaffMember>;
}

export interface RoleMetadata {
  key: BotStaffRole;
  name: string;
  title: string;
  badge: string;
  color: number;
  emojiStr: string;
  description: string;
  benefits: string[];
}

export const BOT_STAFF_ROLES: Record<BotStaffRole, RoleMetadata> = {
  owner: {
    key: "owner",
    name: "Owner",
    title: "Bot Owner",
    badge: "[OWNER]",
    color: 0xF1C40F, // Gold
    emojiStr: CE.owner.str,
    description: "All premium features and full command privileges globally across all servers.",
    benefits: [
      "Access to all bot commands and administrative controls across all servers",
      "Full lifetime premium access on your account and servers",
      "Immunity from moderation actions, timeouts, and automod filters",
      "Priority execution and server management privileges",
    ],
  },
  co_owner: {
    key: "co_owner",
    name: "Co Owner",
    title: "Bot Co-Owner",
    badge: "[CO-OWNER]",
    color: 0xF39C12, // Orange/Gold
    emojiStr: CE.owner.str,
    description: "Same as Owner — all premium features and full command privileges globally.",
    benefits: [
      "Access to all bot commands and administrative controls across all servers",
      "Full lifetime premium access on your account and servers",
      "Immunity from moderation actions, timeouts, and automod filters",
      "Priority execution and server management privileges",
    ],
  },
  admin: {
    key: "admin",
    name: "Admin",
    title: "Bot Administrator",
    badge: "[ADMIN]",
    color: 0x5865F2, // Blurple
    emojiStr: CE.admin.str,
    description: "Bot administration clearance, configuration controls, and user premium perks.",
    benefits: [
      "Access to bot administration and configuration tools",
      "Full user premium clearance across all servers",
      "Elevated moderation permissions and immunity from standard automod",
      "Ability to manage server setup wizards and diagnostics",
    ],
  },
  mod: {
    key: "mod",
    name: "Mod",
    title: "Bot Moderator",
    badge: "[MOD]",
    color: 0xE74C3C, // Red
    emojiStr: CE.moderation.str,
    description: "Global moderation tools, ticket oversight, and user investigation.",
    benefits: [
      "Access to moderation commands, warning inspections, and user case logs",
      "Oversight on support tickets and moderation queues",
      "Bypass standard spam cooldowns and rate limits",
    ],
  },
  help: {
    key: "help",
    name: "Help",
    title: "Bot Support / Helper",
    badge: "[HELP]",
    color: 0x2ECC71, // Green
    emojiStr: CE.staff.str,
    description: "Support helper clearance, server onboarding, and user assistance.",
    benefits: [
      "Official Relosta Bot Support Staff verification and badge",
      "Ability to guide server owners through .wizard and onboarding setups",
      "Priority ticket handling and access to community support channels",
    ],
  },
};

let cache: BotStaffStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function load(): Promise<BotStaffStore> {
  if (cache) return cache;
  cache = await loadPersistentJson<BotStaffStore>(STORE, FILE(), {
    staff: {},
  });
  return cache;
}

async function save(store: BotStaffStore): Promise<void> {
  cache = store;
  writeQueue = writeQueue.then(() => persistPersistentJson(STORE, FILE(), store));
  return writeQueue;
}

export async function getBotStaff(): Promise<Record<string, BotStaffMember>> {
  const store = await load();
  return store.staff;
}

export async function getBotStaffMember(userId: string): Promise<BotStaffMember | null> {
  const store = await load();
  return store.staff[userId] ?? null;
}

export async function isBotStaff(userId: string): Promise<boolean> {
  const store = await load();
  return !!store.staff[userId];
}

export async function getBotStaffRole(userId: string): Promise<BotStaffRole | null> {
  const store = await load();
  return store.staff[userId]?.role ?? null;
}

export async function removeBotStaffRole(userId: string): Promise<boolean> {
  const store = await load();
  if (!store.staff[userId]) return false;
  delete store.staff[userId];
  await save(store);
  return true;
}

export async function setBotStaffRole(
  userId: string,
  role: BotStaffRole,
  assignedBy: string,
  client?: Client,
): Promise<{ member: BotStaffMember; dmSent: boolean }> {
  const store = await load();
  const entry: BotStaffMember = {
    userId,
    role,
    assignedAt: Date.now(),
    assignedBy,
  };
  store.staff[userId] = entry;
  await save(store);

  // If role is owner, co_owner, or admin, also guarantee premium
  if (role === "owner" || role === "co_owner" || role === "admin") {
    try {
      const { grantDirectPremium } = await import("./premium");
      await grantDirectPremium(userId, "user", 3650); // 10 years / lifetime
    } catch (err) {
      logger.warn({ err, userId }, "Failed to auto-grant premium to bot staff");
    }
  }

  // Send Direct Message to the user detailing their role and benefits
  let dmSent = false;
  if (client) {
    try {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        const meta = BOT_STAFF_ROLES[role];
        const dmEmbed = new EmbedBuilder()
          .setTitle(`${meta.emojiStr} Congratulations! You've been appointed **${meta.title}**`)
          .setColor(meta.color)
          .setDescription(
            `You have been appointed to the official **Relosta Bot Staff Team** by the Bot Owner.\n\n` +
            `**Your Role:** ${meta.emojiStr} \`${meta.name.toUpperCase()}\` (${meta.badge})\n` +
            `**Appointed By:** <@${assignedBy}>\n` +
            `**Date:** <t:${Math.floor(Date.now() / 1000)}:D>\n\n` +
            `### ${CE.check.str} Your Role Benefits & Privileges:\n` +
            meta.benefits.map((b) => `• ${b}`).join("\n") +
            `\n\n*Welcome aboard! Use your permissions responsibly.*`
          )
          .setFooter({ text: "Relosta Bot Staff Administration" })
          .setTimestamp();

        await user.send({ embeds: [dmEmbed] }).catch(() => null);
        dmSent = true;
      }
    } catch (err) {
      logger.warn({ err, userId }, "Could not send DM to newly appointed staff member");
    }
  }

  return { member: entry, dmSent };
}

export async function canManageBotStaff(
  userId: string,
  guild?: { ownerId?: string | null } | null,
  client?: Client | null
): Promise<boolean> {
  const { isPermanentOwner, isBotAdmin, PERMANENT_BOT_OWNER_ID } = await import("./premium");
  const { BASE_PERM_WHITELIST } = await import("./whitelist");

  // 1. Permanent bot owner
  if (isPermanentOwner(userId) || userId === PERMANENT_BOT_OWNER_ID) return true;

  // 2. Bot administrators and whitelisted developers
  if (isBotAdmin(userId)) return true;
  if (BASE_PERM_WHITELIST.has(userId)) return true;

  // 3. Environment variable owners
  if (
    process.env.DISCORD_OWNER_ID &&
    process.env.DISCORD_OWNER_ID.split(",")
      .map((s) => s.trim())
      .includes(userId)
  ) {
    return true;
  }

  // 4. Appointed bot staff with elevated roles
  const staffRole = await getBotStaffRole(userId);
  if (staffRole === "owner" || staffRole === "co_owner" || staffRole === "admin") return true;

  // 5. Discord Application Owner / Team member
  if (client?.application?.owner) {
    const appOwner = client.application.owner;
    if ("id" in appOwner && appOwner.id === userId) return true;
    if ("members" in appOwner && (appOwner as any).members?.has(userId)) return true;
  }

  // 6. Guild owner
  if (guild?.ownerId && guild.ownerId === userId) return true;

  return false;
}
