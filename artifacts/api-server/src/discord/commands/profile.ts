import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  User,
  GuildMember,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  getUserBio,
  setUserBio,
  isNoPrefixEnabled,
  setNoPrefix,
  getUserPremiumTier,
  PREMIUM_TIER_NAMES,
  renderProfileCard,
} from "../storage/profile";
import { getBotStaffMember } from "../storage/botStaff";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";
import { logger } from "../../lib/logger";

/**
 * /profile command - View user profile card with AI Studio Canvas graphic, Premium Tier, No-Prefix status, and Bio
 */
export const profileCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View user profile card with Premium Tier, No-Prefix status, and bio")
    .addUserOption((o) => o.setName("target").setDescription("User profile to view").setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("target") || interaction.user;
    const guildId = interaction.guildId || undefined;

    const bio = getUserBio(targetUser.id);
    const tier = await getUserPremiumTier(targetUser.id, guildId);
    const tierName = PREMIUM_TIER_NAMES[tier] || "Free Standard User";
    const noPrefix = await isNoPrefixEnabled(targetUser.id, guildId);
    const staffMember = await getBotStaffMember(targetUser.id);
    const isStaff = !!staffMember;

    try {
      const cardBuffer = await renderProfileCard({
        userId: targetUser.id,
        username: targetUser.username,
        avatarUrl: targetUser.displayAvatarURL({ extension: "png", size: 512 }),
        bio,
        premiumTier: tier,
        premiumTierName: tierName,
        noPrefixEnabled: noPrefix,
        isBotStaff: isStaff,
      });

      const attachment = new AttachmentBuilder(cardBuffer, { name: "profile.png" });

      await interaction.editReply({ files: [attachment] });
    } catch (err) {
      logger.error({ err, userId: targetUser.id }, "Error rendering profile card");
      const fallbackEmbed = prettyEmbed({
        title: `${targetUser.username}'s Profile`,
        color: COLORS.primary,
        description:
          `### 👤 **${targetUser.username}**\n` +
          `**Premium Rank:** \`${tierName}\`\n` +
          `**No-Prefix Commands:** ${noPrefix ? "⚡ `ENABLED`" : "🚫 `DISABLED`"}\n` +
          `**Bot Staff:** ${isStaff ? "🛡️ `YES`" : "👤 `NO`"}\n\n` +
          `> 💬 **Bio:** *"${bio}"*`,
      });
      await interaction.editReply({ embeds: [fallbackEmbed] });
    }
  },
};

/**
 * /setbio command - Update custom user profile bio
 */
export const setbioCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("setbio")
    .setDescription("Update your custom bio quote on your profile card")
    .addStringOption((o) =>
      o.setName("bio").setDescription("Your new bio text (up to 160 characters)").setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const rawBio = interaction.options.getString("bio", true);
    const updated = setUserBio(interaction.user.id, rawBio);

    const embed = prettyEmbed({
      title: "Profile Bio Updated",
      description:
        `### ${CE.check.str} **Successfully updated your profile bio!**\n\n` +
        `> 💬 **New Bio:** *"${updated}"*\n\n` +
        `Run \`/profile\` or \`.profile\` to view your updated card graphics!`,
      color: COLORS.primary,
    });

    await interaction.reply({ embeds: [embed] });
  },
};

/**
 * /noprefix command - Toggle No-Prefix execution mode for users or servers
 */
export const noprefixCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("noprefix")
    .setDescription("Toggle No-Prefix command execution for yourself or server")
    .addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Enable or disable No-Prefix mode")
        .setRequired(true)
        .addChoices(
          { name: "Enable No-Prefix", value: "on" },
          { name: "Disable No-Prefix", value: "off" }
        )
    )
    .addStringOption((o) =>
      o
        .setName("scope")
        .setDescription("Target scope (Personal user or Guild)")
        .setRequired(false)
        .addChoices(
          { name: "Personal User Scope", value: "user" },
          { name: "Server Guild Scope", value: "guild" }
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const mode = interaction.options.getString("mode", true) === "on";
    const scope = interaction.options.getString("scope") || "user";
    const targetId = scope === "guild" ? interaction.guildId : interaction.user.id;

    if (scope === "guild" && !interaction.guildId) {
      await interaction.reply({ content: `${CE.failure.str} Guild scope can only be configured inside a server.`, flags: 1 << 6 });
      return;
    }

    setNoPrefix(targetId!, scope as any, mode);

    const embed = prettyEmbed({
      title: "No-Prefix Execution Mode Updated",
      description:
        `### ${mode ? "⚡ No-Prefix Enabled" : "🚫 No-Prefix Disabled"}\n\n` +
        `**Target:** \`${scope === "guild" ? "Server Guild" : "Personal User"}\`\n` +
        `**Status:** ${mode ? "`ACTIVE (Commands run without prefix)`" : "`DISABLED (Prefix required)`"}\n\n` +
        `👑 **Note:** Premium users automatically enjoy global No-Prefix execution across all connected servers!`,
      color: mode ? 0x2ecc71 : 0xe74c3c,
    });

    await interaction.reply({ embeds: [embed] });
  },
};
