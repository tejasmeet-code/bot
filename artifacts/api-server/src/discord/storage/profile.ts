import { createCanvas, loadImage } from "@napi-rs/canvas";
import { isUserPremium, isGuildPremium, isPermanentOwner } from "./premium";
import { getBotStaff } from "./botStaff";
import { logger } from "../../lib/logger";

export interface UserProfileData {
  userId: string;
  username: string;
  avatarUrl: string;
  bio: string;
  premiumTier: number; // 0 to 4
  premiumTierName: string;
  noPrefixEnabled: boolean;
  isBotStaff: boolean;
}

// Memory stores backed by persistent sync
const userBios = new Map<string, string>();
const noPrefixUsers = new Set<string>();
const noPrefixGuilds = new Set<string>();
const userPremiumTiers = new Map<string, number>();

/**
 * Gets or sets user bio
 */
export function getUserBio(userId: string): string {
  return userBios.get(userId) || "Passionate audio lover & Relosta community member.";
}

export function setUserBio(userId: string, bio: string): string {
  const sanitized = bio.trim().slice(0, 160);
  userBios.set(userId, sanitized);
  return sanitized;
}

/**
 * Checks if No-Prefix is enabled for a user or guild
 */
export async function isNoPrefixEnabled(userId: string, guildId?: string): Promise<boolean> {
  if (noPrefixUsers.has(userId)) return true;
  if (guildId && noPrefixGuilds.has(guildId)) return true;
  // Premium users automatically get No-Prefix enabled by default
  const uPrem = await isUserPremium(userId);
  if (uPrem) return true;
  if (guildId) {
    const gPrem = await isGuildPremium(guildId);
    if (gPrem) return true;
  }
  return false;
}

export function setNoPrefix(targetId: string, type: "user" | "guild", enabled: boolean): void {
  if (type === "user") {
    if (enabled) noPrefixUsers.add(targetId);
    else noPrefixUsers.delete(targetId);
  } else {
    if (enabled) noPrefixGuilds.add(targetId);
    else noPrefixGuilds.delete(targetId);
  }
}

/**
 * Gets Premium Tier for a user (0: Free, 1: VIP Supporter, 2: Pro Master, 3: Enterprise God, 4: Ultimate Apex)
 */
export async function getUserPremiumTier(userId: string, guildId?: string): Promise<number> {
  if (userPremiumTiers.has(userId)) {
    return userPremiumTiers.get(userId)!;
  }
  // All existing premium users automatically get top Tier 4!
  const uPrem = await isUserPremium(userId);
  const gPrem = guildId ? await isGuildPremium(guildId) : false;
  if (uPrem || gPrem) {
    return 4; // Top Tier
  }
  return 0;
}

export function setUserPremiumTier(userId: string, tier: number): void {
  const bounded = Math.max(0, Math.min(4, tier));
  userPremiumTiers.set(userId, bounded);
}

export const PREMIUM_TIER_NAMES: Record<number, string> = {
  0: "Standard Free Tier",
  1: "Tier 1: VIP Supporter",
  2: "Tier 2: Pro Master",
  3: "Tier 3: Enterprise God Mode",
  4: "Tier 4: Ultimate Relosta Apex",
};

/**
 * Renders an AI Studio custom high-fidelity dynamic profile image card using Canvas
 */
export async function renderProfileCard(data: UserProfileData): Promise<Buffer> {
  const width = 1000;
  const height = 560;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // 1. Deep Cyber Obsidian Gradient Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, "#080b12");
  bgGrad.addColorStop(0.4, "#0f1629");
  bgGrad.addColorStop(0.8, "#141126");
  bgGrad.addColorStop(1, "#090a12");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. High-Tech Equalizer Glowing Audio Grid Lines
  ctx.save();
  ctx.globalAlpha = 0.12;
  const barCount = 52;
  const barWidth = 12;
  const spacing = 6;
  for (let i = 0; i < barCount; i++) {
    const x = 30 + i * (barWidth + spacing);
    const barHeight = Math.sin(i * 0.35) * 140 + Math.cos(i * 0.6) * 90 + 160;
    const y = height - barHeight;
    const waveGrad = ctx.createLinearGradient(x, y, x, height);
    waveGrad.addColorStop(0, data.premiumTier > 0 ? "#f1c40f" : "#5865f2");
    waveGrad.addColorStop(1, "#3b82f6");
    ctx.fillStyle = waveGrad;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
  ctx.restore();

  // 3. Main Glassmorphic Outer Card Container
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  ctx.strokeStyle = data.premiumTier > 0 ? "rgba(241, 196, 15, 0.35)" : "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2.5;
  const rx = 35;
  const ry = 35;
  const rw = width - 70;
  const rh = height - 70;
  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, 28);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. Avatar Image with Double Glowing Ring
  const avatarX = 75;
  const avatarY = 75;
  const avatarSize = 150;

  try {
    const avatarImg = await loadImage(data.avatarUrl);
    ctx.save();
    // Avatar Outer Glow Ring
    ctx.shadowColor = data.premiumTier > 0 ? "#f1c40f" : "#5865f2";
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
    ctx.fillStyle = data.premiumTier > 0 ? "#f1c40f" : "#5865f2";
    ctx.fill();

    // Clip Avatar Circle
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
  } catch (err) {
    logger.debug({ err }, "Could not load avatar for canvas profile card");
  }

  // 5. Header Typography (Username & User ID)
  const textX = 260;

  ctx.font = "bold 42px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.username, textX, 120);

  ctx.font = "16px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.fillText(`ID: ${data.userId}`, textX, 150);

  // 6. Status Cards Grid (3 Structured Cards Inside Image)
  const gridY = 185;
  const isPrem = data.premiumTier > 0;

  // Card 1: Premium Rank
  ctx.save();
  ctx.fillStyle = isPrem ? "rgba(241, 196, 15, 0.12)" : "rgba(255, 255, 255, 0.05)";
  ctx.strokeStyle = isPrem ? "rgba(241, 196, 15, 0.6)" : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(textX, gridY, 215, 75, 14);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = isPrem ? "#f1c40f" : "#95a5a6";
  ctx.fillText("PREMIUM RANK", textX + 16, gridY + 26);

  ctx.font = "bold 15px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(isPrem ? `${data.premiumTierName}` : "Standard Free", textX + 16, gridY + 54);
  ctx.restore();

  // Card 2: No-Prefix Execution
  ctx.save();
  const npColor = data.noPrefixEnabled ? "#2ecc71" : "#e74c3c";
  ctx.fillStyle = data.noPrefixEnabled ? "rgba(46, 204, 113, 0.12)" : "rgba(231, 76, 60, 0.12)";
  ctx.strokeStyle = data.noPrefixEnabled ? "rgba(46, 204, 113, 0.6)" : "rgba(231, 76, 60, 0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(textX + 230, gridY, 215, 75, 14);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = npColor;
  ctx.fillText("NO-PREFIX MODE", textX + 246, gridY + 26);

  ctx.font = "bold 15px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.noPrefixEnabled ? "ACTIVE (ON)" : "INACTIVE (OFF)", textX + 246, gridY + 54);
  ctx.restore();

  // Card 3: Bot Staff Verification
  ctx.save();
  const staffColor = data.isBotStaff ? "#9b59b6" : "#7f8c8d";
  ctx.fillStyle = data.isBotStaff ? "rgba(155, 89, 182, 0.15)" : "rgba(255, 255, 255, 0.05)";
  ctx.strokeStyle = data.isBotStaff ? "rgba(155, 89, 182, 0.6)" : "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(textX + 460, gridY, 210, 75, 14);
  ctx.fill();
  ctx.stroke();

  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = staffColor;
  ctx.fillText("BOT STAFF VERIFIED", textX + 476, gridY + 26);

  ctx.font = "bold 15px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.isBotStaff ? "OFFICIAL STAFF" : "MEMBER", textX + 476, gridY + 54);
  ctx.restore();

  // 7. Custom User Bio Panel Box Inside Image
  const bioY = 285;
  const bioW = width - 150;
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(75, bioY, bioW, 160, 18);
  ctx.fill();
  ctx.stroke();

  // Accent Bar on Left of Bio
  ctx.fillStyle = isPrem ? "#f1c40f" : "#5865f2";
  ctx.beginPath();
  ctx.roundRect(85, bioY + 15, 5, 130, 3);
  ctx.fill();

  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = isPrem ? "#f1c40f" : "#7289da";
  ctx.fillText("USER BIO & ABOUT", 108, bioY + 38);

  ctx.font = "italic 19px sans-serif";
  ctx.fillStyle = "#e2e8f0";

  // Wrap bio text cleanly inside card
  const maxBioWidth = bioW - 60;
  const words = data.bio.split(" ");
  let currentLine = "";
  let lineY = bioY + 75;

  for (let w = 0; w < words.length; w++) {
    const testLine = currentLine + words[w] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxBioWidth && w > 0) {
      ctx.fillText(currentLine, 108, lineY);
      currentLine = words[w] + " ";
      lineY += 30;
      if (lineY > bioY + 140) break;
    } else {
      currentLine = testLine;
    }
  }
  if (lineY <= bioY + 140) {
    ctx.fillText(currentLine, 108, lineY);
  }
  ctx.restore();

  // 8. Footer Branding Line Inside Image
  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.fillText("RELOSTA VIP AUDIO ENGINE • OFFICIAL DISCORD USER PROFILE", 75, height - 42);

  return canvas.toBuffer("image/png");
}
