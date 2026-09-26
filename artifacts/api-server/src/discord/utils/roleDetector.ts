import {
  type Guild,
  type Role,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} from "discord.js";
import { CE } from "./embedStyle";

export interface SmartRoleDetectionResult {
  mainMemberRole: Role | null;
  mainMemberCandidates: Role[];
  staffCommonRole: Role | null;
  staffCommonCandidates: Role[];
  staffHierarchy: Role[];
  allValidRoles: Role[];
}

/**
 * Common regular expression matching decorative/divider roles
 */
const SEPARATOR_REGEX = /^[\s\-_=─━~*•·#|/\\+–—\[\]()<>:;.,]+$/;

/**
 * Strips special symbols, decorative brackets, and emojis from a role name for fuzzy matching
 */
export function cleanRoleName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a role is a valid assignable user role (not @everyone, not managed bot role, not purely cosmetic separator)
 */
export function isValidAssignableRole(role: Role): boolean {
  if (!role || role.id === role.guild.id) return false; // @everyone
  if (role.managed) return false; // Bot/Integration managed
  if (role.tags?.botId || role.tags?.integrationId) return false;
  if (SEPARATOR_REGEX.test(role.name.trim())) return false;
  return true;
}

const MEMBER_KEYWORDS = [
  "member",
  "members",
  "verified",
  "verify",
  "citizen",
  "citizens",
  "community",
  "regular",
  "regulars",
  "user",
  "users",
  "general",
  "peeps",
  "official member",
  "people",
  "human",
  "novice",
];

const STAFF_KEYWORDS = [
  "staff team",
  "staff",
  "staffs",
  "team staff",
  "moderator",
  "moderators",
  "mod team",
  "mods",
  "mod",
  "administrator",
  "administrators",
  "admins",
  "admin",
  "management",
  "manager",
  "managers",
  "head mod",
  "senior mod",
  "junior mod",
  "trial mod",
  "support team",
  "support",
  "helper",
  "helpers",
  "community manager",
  "server staff",
  "owner",
  "co owner",
  "founder",
  "director",
  "executive",
];

/**
 * Evaluates how strongly a role matches a "Regular Member" role
 */
export function scoreMemberRole(role: Role, totalMembers: number): number {
  if (!isValidAssignableRole(role)) return -1000;

  let score = 0;
  const clean = cleanRoleName(role.name);

  // Severe penalty for elevated permissions (member roles should not have mod perms)
  const p = role.permissions;
  if (p.has(PermissionFlagsBits.Administrator)) return -1000;
  if (p.has(PermissionFlagsBits.ManageGuild)) return -500;
  if (p.has(PermissionFlagsBits.BanMembers)) return -400;
  if (p.has(PermissionFlagsBits.KickMembers)) return -300;
  if (p.has(PermissionFlagsBits.ModerateMembers)) return -300;
  if (p.has(PermissionFlagsBits.ManageRoles)) return -200;
  if (p.has(PermissionFlagsBits.ManageChannels)) return -200;
  if (p.has(PermissionFlagsBits.ManageMessages)) return -100;

  // Name matches
  for (const kw of MEMBER_KEYWORDS) {
    if (clean === kw) {
      score += 100;
      break;
    } else if (clean.includes(kw)) {
      score += 60;
    }
  }

  // Member count weighting (if 20%+ of server members have this role, highly likely to be the member role)
  if (totalMembers > 0 && role.members.size > 0) {
    const ratio = role.members.size / totalMembers;
    if (ratio > 0.5) score += 50;
    else if (ratio > 0.2) score += 30;
    else if (ratio > 0.05) score += 15;
  }

  // Position preference: Member roles are usually near the bottom above @everyone
  if (role.position <= 5) score += 10;

  return score;
}

/**
 * Evaluates how strongly a role matches a "Staff Common" or "Staff Hierarchy" role
 */
export function scoreStaffRole(role: Role): number {
  if (!isValidAssignableRole(role)) return -1000;

  let score = 0;
  const clean = cleanRoleName(role.name);
  const p = role.permissions;

  // Permission scoring (strongest indicator of staff authority)
  if (p.has(PermissionFlagsBits.Administrator)) score += 80;
  if (p.has(PermissionFlagsBits.ManageGuild)) score += 50;
  if (p.has(PermissionFlagsBits.BanMembers)) score += 40;
  if (p.has(PermissionFlagsBits.ModerateMembers)) score += 35;
  if (p.has(PermissionFlagsBits.KickMembers)) score += 30;
  if (p.has(PermissionFlagsBits.ManageRoles)) score += 25;
  if (p.has(PermissionFlagsBits.ManageChannels)) score += 20;
  if (p.has(PermissionFlagsBits.ManageMessages)) score += 20;
  if (p.has(PermissionFlagsBits.ViewAuditLog)) score += 15;

  // Keyword scoring
  for (const kw of STAFF_KEYWORDS) {
    if (clean === kw) {
      score += 60;
      break;
    } else if (clean.includes(kw)) {
      score += 40;
    }
  }

  // Hierarchy position: Higher position in Discord role list = higher staff standing
  score += Math.min(role.position * 2, 40);

  return score;
}

/**
 * Performs deep, intelligent scanning of all server roles to auto-detect
 * Member Roles, Staff Common Roles, and Staff Hierarchy in order.
 */
export async function detectSmartRoles(guild: Guild): Promise<SmartRoleDetectionResult> {
  await guild.roles.fetch().catch(() => {});
  await guild.members.fetch().catch(() => {});

  const totalMembers = guild.memberCount || guild.members.cache.size || 1;
  const allRoles = [...guild.roles.cache.values()];
  const validRoles = allRoles.filter(isValidAssignableRole);

  // 1. Score Member Roles
  const memberCandidates = validRoles
    .map((r) => ({ role: r, score: scoreMemberRole(r, totalMembers) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.role);

  const mainMemberRole = memberCandidates[0] || null;

  // 2. Score Staff Roles
  const staffCandidates = validRoles
    .map((r) => ({ role: r, score: scoreStaffRole(r) }))
    .filter((item) => item.score >= 20)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.role);

  // For Staff Common Role, prefer a generic role like "Staff Team" or "Staff" or "Moderators"
  let staffCommonRole: Role | null = null;
  const commonKeywords = ["staff team", "staff", "staffs", "team staff", "moderators", "moderator", "mod team", "team"];
  for (const cand of staffCandidates) {
    const clean = cleanRoleName(cand.name);
    if (commonKeywords.some((kw) => clean === kw || clean.includes(kw))) {
      staffCommonRole = cand;
      break;
    }
  }
  if (!staffCommonRole && staffCandidates.length > 0) {
    staffCommonRole = staffCandidates[0];
  }

  // 3. Build Staff Hierarchy (Ranked from Highest Discord Position down to Lowest)
  const staffHierarchy = [...staffCandidates].sort((a, b) => b.position - a.position);

  return {
    mainMemberRole,
    mainMemberCandidates: memberCandidates,
    staffCommonRole,
    staffCommonCandidates: staffCandidates,
    staffHierarchy,
    allValidRoles: validRoles,
  };
}
