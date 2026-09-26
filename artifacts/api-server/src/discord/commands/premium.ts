import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import {
  isPermanentOwner,
  PERMANENT_BOT_OWNER_ID,
  canAccessPremiumPanel,
  createPremiumCode,
  redeemPremiumCode,
  grantDirectPremium,
  removeDirectPremium,
  setPremiumRole,
  removePremiumRole,
  listActivePremiums,
  checkTargetPremium,
  sendStaffAndOwnerBriefing,
} from "../storage/premium";
import { sendPaginatedEmbed } from "../utils/paginator";
import { getUserPremiumTier, PREMIUM_TIER_NAMES, isNoPrefixEnabled, setNoPrefix } from "../storage/profile";
import { isUserPremium, isGuildPremium } from "../storage/premium";
import { CE, COLORS, prettyEmbed } from "../utils/embedStyle";

const SUPPORT_SERVER_URL = "https://discord.gg/gFgAfpSYdp";

export const premiumUserCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premium-user")
    .setDescription("Activate User-Based Premium using a license code.")
    .addStringOption((o) =>
      o
        .setName("code")
        .setDescription("Your premium license activation code")
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    const code = interaction.options.getString("code", true);
    const result = await redeemPremiumCode(code, interaction.user.id, "user");

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setTitle(`${CE.failure.str} Premium Activation Failed`)
        .setDescription(
          `${result.message}\n\nTo purchase a valid Premium License Code, please **join our Official Support Server and open a support ticket**: ${SUPPORT_SERVER_URL}`,
        )
        .setColor(0xed4245);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} User Premium Activated!`)
      .setDescription(result.message)
      .setColor(0x57f287);
    await interaction.reply({ embeds: [embed] });
  },
};

export const premiumServerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premium-server")
    .setDescription("Activate Guild-Based Premium using a license code.")
    .addStringOption((o) =>
      o
        .setName("code")
        .setDescription("Your guild premium license activation code")
        .setRequired(true),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used inside a server.", ephemeral: true });
      return;
    }
    const code = interaction.options.getString("code", true);
    const result = await redeemPremiumCode(code, interaction.guildId, "server");

    if (!result.success) {
      const embed = new EmbedBuilder()
        .setTitle(`${CE.failure.str} Premium Activation Failed`)
        .setDescription(
          `${result.message}\n\nTo purchase a valid Premium License Code, please **join our Official Support Server and open a support ticket**: ${SUPPORT_SERVER_URL}`,
        )
        .setColor(0xed4245);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Server Premium Activated!`)
      .setDescription(result.message)
      .setColor(0x57f287);
    await interaction.reply({ embeds: [embed] });
  },
};

export const premiumGenerateCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premium-generate")
    .setDescription("Bot Admin only: Generate a time-bounded premium license activation code.")
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Code type")
        .setRequired(true)
        .addChoices(
          { name: "User-Based", value: "user" },
          { name: "Guild-Based", value: "server" },
        ),
    )
    .addIntegerOption((o) =>
      o
        .setName("days")
        .setDescription("Duration in days")
        .setRequired(true)
        .setMinValue(1),
    )
    .addIntegerOption((o) =>
      o
        .setName("limit")
        .setDescription("Multi-guild limit quota (default 1)")
        .setRequired(false)
        .setMinValue(1),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isPermanentOwner(interaction.user.id)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can generate premium license codes.`,
        ephemeral: true,
      });
      return;
    }

    const type = interaction.options.getString("type", true) as "user" | "server";
    const days = interaction.options.getInteger("days", true);
    const limit = interaction.options.getInteger("limit") ?? 1;

    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const codeStr = `PREM-${type.toUpperCase()}-${randomString}`;

    const code = await createPremiumCode(codeStr, type, days, limit);

    const embed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Premium License Code Generated`)
      .setDescription(`Generated a new **${type.toUpperCase()}** premium code valid for **${days} days**.`)
      .addFields(
        { name: "Activation Code", value: `\`${code.code}\``, inline: false },
        { name: "Redemption Quota", value: `${code.guildLimit} activation(s)`, inline: true },
      )
      .setColor(0xF1C40F);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

/**
 * /premium-give: Bot Owner directly grants premium to a user or server with DM delivery
 */
export const premiumGiveCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premium-give")
    .setDescription("Bot Owner only: Directly grant Premium to any user or server with automatic DM notification.")
    .addStringOption((o) =>
      o
        .setName("target")
        .setDescription("User ID or @mention (or Server ID)")
        .setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("days")
        .setDescription("Duration in days (default: 30, enter 9999 for Lifetime)")
        .setRequired(false)
        .setMinValue(1),
    )
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("Grant type: user (default) or server")
        .setRequired(false)
        .addChoices(
          { name: "User-Based Premium", value: "user" },
          { name: "Server-Based Premium", value: "server" },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!isPermanentOwner(interaction.user.id)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can give premium to others.`,
        flags: 1 << 6,
      });
      return;
    }

    const rawTarget = interaction.options.getString("target", true).trim();
    const idMatch = rawTarget.match(/\d{17,20}/);
    const targetId = idMatch ? idMatch[0] : rawTarget;
    const days = interaction.options.getInteger("days") ?? 30;
    const type = (interaction.options.getString("type") ?? "user") as "user" | "server";

    await interaction.deferReply();

    const result = await grantDirectPremium(targetId, type, days);
    const isLifetime = result.expiresAt >= 4100000000000 || days >= 9999;
    let dmSent = false;

    if (type === "user") {
      try {
        const userObj = await interaction.client.users.fetch(targetId).catch(() => null);
        if (userObj) {
          const dmEmbed = new EmbedBuilder()
            .setTitle(`${CE.star.str} You Have Been Granted Relosta Premium!`)
            .setColor(0xF1C40F)
            .setDescription(
              `Hello! You have been granted **Relosta Premium** by the bot owner (<@${interaction.user.id}>)!\n\n` +
              `• **Duration:** ${isLifetime ? `${CE.star.str} **Lifetime Access**` : `\`${days}\` days (Active until <t:${Math.floor(result.expiresAt / 1000)}:F>)`}\n` +
              `• **Unlocked VIP Features:**\n` +
              `  ${CE.radio.str} **Remote VC Audio**: Play music into any voice channel without joining it (\`.play <song> <vc_or_user>\`)\n` +
              `  ${CE.music.str} **24/7 Voice Radio**: Keep the bot playing in your voice channel 24/7 (\`.24/7 <vc_or_user>\`)\n` +
              `  ${CE.promotion.str} **Global No-Prefix Mode**: Execute bot commands freely without prefix\n` +
              `  ${CE.level.str} **Priority Rates & Enhanced Privileges**\n\n` +
              `Thank you for being a valued part of the Relosta ecosystem!`,
            )
            .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
            .setFooter({ text: "Relosta Premium Experience" })
            .setTimestamp();
          await userObj.send({ embeds: [dmEmbed] });
          dmSent = true;
        }
      } catch {
        dmSent = false;
      }
    }

    const replyEmbed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Premium Granted Successfully!`)
      .setColor(0x57f287)
      .setDescription(
        `Successfully granted **${isLifetime ? `${CE.star.str} Lifetime` : `${days} days`}** of **${type.toUpperCase()}** Premium to ${type === "user" ? `<@${targetId}> (\`${targetId}\`)` : `Server \`${targetId}\``}!\n\n` +
        `• **Expiration Date:** ${isLifetime ? `${CE.star.str} **Lifetime**` : `<t:${Math.floor(result.expiresAt / 1000)}:F>`}\n` +
        `• **Direct Message Notification:** ${
          type === "user"
            ? dmSent
              ? `${CE.chat.str} User notified successfully via DM!`
              : `${CE.warning.str} User has direct messages closed or blocked.`
            : "N/A (Server License)"
        }`,
      )
      .addFields(
        { name: "Target ID", value: `\`${targetId}\``, inline: true },
        { name: "Type", value: `\`${type.toUpperCase()}\``, inline: true },
        { name: "Duration", value: isLifetime ? `${CE.star.str} Lifetime` : `${days} Days`, inline: true },
      )
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
      .setFooter({ text: `Granted by Bot Owner: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [replyEmbed] });
  },
};

/**
 * /premium-panel: Interactive executive management panel for Bot Owners
 */
export const premiumPanelCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premium-panel")
    .setDescription("Bot Owner only: Executive Premium Management Panel with interactive controls."),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await canAccessPremiumPanel(interaction.user.id, interaction.guild?.ownerId))) {
      // Strictly do not reply if not an authorized owner or bot staff
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`${CE.owner.str} Executive Premium Management Panel`)
      .setColor(0xF1C40F)
      .setDescription(
        `Welcome to the **Relosta Premium Executive Control Panel**.\n\n` +
        `Use the interactive controls below to directly manage premium subscriptions, configure server-wide premium roles, or check subscription status.\n\n` +
        `• **Give User Premium**: *(Permanent Owner only)* Grants VIP privileges and delivers a formatted DM\n` +
        `• **Give Server Premium**: *(Permanent Owner only)* Upgrades an entire guild\n` +
        `• **Remove Premium**: Revokes premium privileges from a user or server\n` +
        `• **Set Premium Role**: Assign a server role that automatically grants global user premium to members holding it\n` +
        `• **Remove Premium Role**: Unset a configured server premium role\n` +
        `• **Check Premium**: Verify real-time status and VIP perks for any user or server\n` +
        `• **Active Premiums**: Lists current subscribers, expiration dates, and active premium roles`,
      )
      .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
      .setFooter({ text: `Relosta Owner Dashboard • Operator: ${interaction.user.tag}` })
      .setTimestamp();

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prem:panel:give_user")
        .setLabel("Give User Premium")
        .setEmoji(CE.star.id)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("prem:panel:give_server")
        .setLabel("Give Server Premium")
        .setEmoji(CE.admin.id)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("prem:panel:remove")
        .setLabel("Remove Premium")
        .setEmoji(CE.trash.id)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("prem:panel:list")
        .setLabel("Active Premiums")
        .setEmoji(CE.information.id)
        .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prem:panel:set_role")
        .setLabel("Set Premium Role")
        .setEmoji(CE.owner.id)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("prem:panel:remove_role")
        .setLabel("Remove Role")
        .setEmoji(CE.failure.id)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("prem:panel:check")
        .setLabel("Check Premium")
        .setEmoji(CE.clipboard.id)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("prem:panel:gen_code")
        .setLabel("Generate Code")
        .setEmoji(CE.giveaway.id)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("prem:panel:brief_staff")
        .setLabel("Staff Briefing")
        .setEmoji(CE.announce.id)
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  },
};

/**
 * Handles button and modal interactions for the Premium Management Panel
 */
export async function handlePremiumInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<void> {
  // Public user buttons on /premium panel
  if (interaction.isButton()) {
    if (interaction.customId === "btn:prem:enable_noprefix") {
      setNoPrefix(interaction.user.id, "user", true);
      await interaction.reply({
        content: `⚡ **No-Prefix Execution ENABLED for <@${interaction.user.id}>!** You can now run all commands directly without typing a prefix.`,
        flags: 1 << 6,
      }).catch(() => {});
      return;
    }

    if (interaction.customId === "btn:prem:disable_noprefix") {
      setNoPrefix(interaction.user.id, "user", false);
      await interaction.reply({
        content: `🚫 **No-Prefix Execution DISABLED for <@${interaction.user.id}>!** Standard prefix or slash commands are now required.`,
        flags: 1 << 6,
      }).catch(() => {});
      return;
    }

    if (interaction.customId === "btn:prem:check_noprefix") {
      const npOn = await isNoPrefixEnabled(interaction.user.id, interaction.guildId || undefined);
      await interaction.reply({
        content: npOn
          ? `⚡ **No-Prefix Status:** \`ENABLED\` for <@${interaction.user.id}>. Commands execute without prefix!`
          : `🚫 **No-Prefix Status:** \`DISABLED\` for <@${interaction.user.id}>. Standard prefix required.`,
        flags: 1 << 6,
      }).catch(() => {});
      return;
    }

    if (interaction.customId === "btn:prem:toggle_noprefix") {
      const current = await isNoPrefixEnabled(interaction.user.id);
      setNoPrefix(interaction.user.id, "user", !current);
      const newState = !current;
      await interaction.reply({
        content: `${newState ? "⚡" : "🚫"} **No-Prefix Mode is now ${newState ? "`ENABLED` (Commands run without prefix)" : "`DISABLED` (Prefix required)"}!**`,
        flags: 1 << 6,
      }).catch(() => {});
      return;
    }

    if (interaction.customId === "btn:prem:check_status" || interaction.customId === "btn:prem:check") {
      const uPrem = await isUserPremium(interaction.user.id);
      const gPrem = interaction.guildId ? await isGuildPremium(interaction.guildId) : false;
      const tier = await getUserPremiumTier(interaction.user.id, interaction.guildId || undefined);
      const tierName = PREMIUM_TIER_NAMES[tier] || "Free Standard Tier";

      const embed = prettyEmbed({
        title: "VIP Status Check",
        color: tier > 0 ? 0xf1c40f : COLORS.primary,
        description:
          `### 👑 **VIP Subscription Status**\n\n` +
          `**User:** <@${interaction.user.id}>\n` +
          `**User License:** ${uPrem ? "👑 `ACTIVE USER PREMIUM`" : "`FREE USER`"}\n` +
          `**Server License:** ${gPrem ? "👑 `ACTIVE SERVER PREMIUM`" : "`FREE GUILD`"}\n` +
          `**Current Tier:** \`${tierName}\`\n` +
          `**No-Prefix Commands:** ${(await isNoPrefixEnabled(interaction.user.id)) ? "⚡ `ACTIVE`" : "🚫 `INACTIVE`"}`,
      });
      await interaction.reply({ embeds: [embed], flags: 1 << 6 }).catch(() => {});
      return;
    }

    if (interaction.customId === "btn:prem:claim_top_tier") {
      const uPrem = await isUserPremium(interaction.user.id);
      const gPrem = interaction.guildId ? await isGuildPremium(interaction.guildId) : false;
      if (uPrem || gPrem) {
        const { setUserPremiumTier } = await import("../storage/profile");
        setUserPremiumTier(interaction.user.id, 4);
        setNoPrefix(interaction.user.id, "user", true);
        await interaction.reply({
          content: `👑 ${CE.star.str} **Top Tier 4 (Ultimate Relosta Apex)** & **Global No-Prefix** successfully unlocked and claimed for <@${interaction.user.id}>!`,
          flags: 1 << 6,
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: `${CE.failure.str} You need an active Premium License to claim Top Tier Apex. Upgrade at: ${SUPPORT_SERVER_URL}`,
          flags: 1 << 6,
        }).catch(() => {});
      }
      return;
    }

    if (interaction.customId === "btn:prem:redeem" || interaction.customId === "btn:prem:redeem_code") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:redeem_code")
        .setTitle("Activate Premium License Code");

      const codeInput = new TextInputBuilder()
        .setCustomId("activation_code")
        .setLabel("Enter Premium License Activation Code")
        .setPlaceholder("PREM-USER-XXXX-XXXX")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput));
      await interaction.showModal(modal);
      return;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === "prem:modal:redeem_code") {
    const code = interaction.fields.getTextInputValue("activation_code").trim();
    const result = await redeemPremiumCode(code, interaction.user.id, "user");
    await interaction.reply({
      content: result.success ? `${CE.success.str} ${result.message}` : `${CE.failure.str} ${result.message}`,
      flags: 1 << 6,
    }).catch(() => {});
    return;
  }

  if (!(await canAccessPremiumPanel(interaction.user.id, interaction.guild?.ownerId))) {
    if (interaction.isRepliable()) {
      await interaction.reply({
        content: `${CE.failure.str} Only authorized Bot Owners and Bot Staff can use executive controls.`,
        flags: 1 << 6,
      }).catch(() => {});
    }
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === "prem:panel:give_user") {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can give premium to users.`,
          flags: 1 << 6,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("prem:modal:give_user")
        .setTitle("Grant User Premium");

      const userInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("Target User ID or @Mention")
        .setPlaceholder("e.g. 1181221352393420856 or @username")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const daysInput = new TextInputBuilder()
        .setCustomId("duration_days")
        .setLabel("Duration in Days (enter 9999 for Lifetime)")
        .setPlaceholder("30")
        .setValue("30")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(userInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:give_server") {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can give premium to servers.`,
          flags: 1 << 6,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId("prem:modal:give_server")
        .setTitle("Grant Server Premium");

      const serverInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("Target Server / Guild ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const daysInput = new TextInputBuilder()
        .setCustomId("duration_days")
        .setLabel("Duration in Days (enter 9999 for Lifetime)")
        .setPlaceholder("30")
        .setValue("30")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(serverInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:remove") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:remove")
        .setTitle("Remove Premium Subscription");

      const targetInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID, @mention, or Server ID")
        .setPlaceholder("e.g. 1181221352393420856")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const typeInput = new TextInputBuilder()
        .setCustomId("target_type")
        .setLabel("Type: 'user' or 'server'")
        .setPlaceholder("user")
        .setValue("user")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(targetInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput),
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:set_role") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:set_role")
        .setTitle("Set Server Premium Role");

      const guildInput = new TextInputBuilder()
        .setCustomId("guild_id")
        .setLabel("Server ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setValue(interaction.guildId ?? "")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const roleInput = new TextInputBuilder()
        .setCustomId("role_id")
        .setLabel("Role ID or Role Mention")
        .setPlaceholder("e.g. 123456789012345678 or @VIP")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(guildInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput),
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:remove_role") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:remove_role")
        .setTitle("Remove Server Premium Role");

      const guildInput = new TextInputBuilder()
        .setCustomId("guild_id")
        .setLabel("Server ID")
        .setPlaceholder("e.g. 1488637779305955413")
        .setValue(interaction.guildId ?? "")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const roleInput = new TextInputBuilder()
        .setCustomId("role_id")
        .setLabel("Role ID or Role Mention to remove")
        .setPlaceholder("e.g. 123456789012345678")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(guildInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(roleInput),
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:list") {
      await interaction.deferReply({ flags: 1 << 6 });
      const { users, guilds, roles } = await listActivePremiums();

      const userLines =
        users.length > 0
          ? users
              .slice(0, 15)
              .map((u) => `• <@${u.id}> (\`${u.id}\`) — ${u.expiresAt >= 4100000000000 ? `${CE.star.str} **Lifetime**` : `Expires: <t:${Math.floor(u.expiresAt / 1000)}:R>`}`)
              .join("\n")
          : "*No active user subscriptions.*";

      const guildLines =
        guilds.length > 0
          ? guilds
              .slice(0, 15)
              .map((g) => `• Server \`${g.id}\` — ${g.expiresAt >= 4100000000000 ? `${CE.star.str} **Lifetime**` : `Expires: <t:${Math.floor(g.expiresAt / 1000)}:R>`}`)
              .join("\n")
          : "*No active server subscriptions.*";

      const roleLines =
        roles && roles.length > 0
          ? roles
              .slice(0, 15)
              .map((r) => `• Server \`${r.guildId}\` ➔ <@&${r.roleId}> (\`${r.roleId}\`)`)
              .join("\n")
          : "*No premium roles configured.*";

      const listEmbed = new EmbedBuilder()
        .setTitle(`${CE.information.str} Active Premium Registry`)
        .setColor(0xF1C40F)
        .addFields(
          { name: `${CE.star.str} Active Users (${users.length})`, value: userLines },
          { name: `${CE.admin.str} Active Servers (${guilds.length})`, value: guildLines },
          { name: `${CE.owner.str} Premium Roles (${roles?.length ?? 0})`, value: roleLines },
        )
        .setFooter({ text: "Relosta Premium Registry" });

      await interaction.editReply({ embeds: [listEmbed] });
      return;
    }

    if (interaction.customId === "prem:panel:gen_code") {
      if (!isPermanentOwner(interaction.user.id)) {
        await interaction.reply({
          content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can generate premium license codes.`,
          flags: 1 << 6,
        });
        return;
      }

      const codeStr = `PREM-USER-${Math.random().toString(36).substring(2, 7).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const code = await createPremiumCode(codeStr, "user", 30, 1);

      const embed = new EmbedBuilder()
        .setTitle(`${CE.success.str} Quick Premium Code Generated`)
        .setDescription(`Generated a 1-time 30-day user license code:\n\n\`${code.code}\``)
        .setColor(0x57f287);

      await interaction.reply({ embeds: [embed], flags: 1 << 6 });
      return;
    }

    if (interaction.customId === "prem:panel:check") {
      const modal = new ModalBuilder()
        .setCustomId("prem:modal:check")
        .setTitle("Verify Premium Status");

      const targetInput = new TextInputBuilder()
        .setCustomId("target_id")
        .setLabel("User ID, @Mention, or Server ID")
        .setPlaceholder("e.g. 1181221352393420856")
        .setValue(interaction.user.id)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(targetInput));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.customId === "prem:panel:brief_staff") {
      await interaction.deferReply({ flags: 1 << 6 });
      const res = await sendStaffAndOwnerBriefing(interaction.client, interaction.user.id);
      await interaction.editReply({
        content: `${CE.success.str} Executive Staff Directive sent to direct messages! (Delivered to \`${res.notifiedCount}\` user${res.notifiedCount === 1 ? "" : "s"})`,
      });
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "prem:modal:check") {
      const rawTarget = interaction.fields.getTextInputValue("target_id").trim();
      const match = rawTarget.match(/\d{17,20}/);
      const targetId = match ? match[0] : rawTarget;

      await interaction.deferReply({ flags: 1 << 6 });
      const info = await checkTargetPremium(targetId, interaction.client);

      let targetName = targetId;
      let isUserObject = false;
      try {
        const u = await interaction.client.users.fetch(targetId).catch(() => null);
        if (u) {
          targetName = `${u.tag} (${u.id})`;
          isUserObject = true;
        }
      } catch {}

      const embed = new EmbedBuilder()
        .setTitle(`👑 Premium Status Verification`)
        .setTimestamp()
        .setFooter({ text: `Relosta Executive Registry • Checked by ${interaction.user.tag}` });

      if (info.isActive) {
        embed.setColor(0xF1C40F);
        embed.setDescription(
          `### Target: ${isUserObject ? `<@${targetId}>` : `\`${targetName}\``}\n` +
          `**Classification**: \`${info.type.toUpperCase()}\` • **Current Tier**: **${info.overallPlan}**\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `### ${CE.star.str} Subscription Details\n` +
          (info.isPermanentOwner ? `• **Authorization**: Hardcoded Permanent Bot Owner\n• **Expiration**: \`Never (Lifetime Access)\`\n` : "") +
          (info.isBotAdmin && !info.isPermanentOwner ? `• **Authorization**: Appointed Bot Administrator\n• **Expiration**: \`Never (Lifetime Access)\`\n` : "") +
          (info.isBotStaff ? `• **Staff Ranking**: \`${info.staffRole?.toUpperCase() ?? "STAFF"}\`\n` : "") +
          (info.userExpiry ? (
            info.isUserLifetime
              ? `• **User Plan**: ${CE.star.str} **Lifetime VIP Access**\n• **Valid Until**: \`Permanent\`\n`
              : `• **User Plan**: **Active**\n• **Remaining Time**: \`${info.userDaysLeft} day(s)\`\n• **Expires On**: <t:${Math.floor(info.userExpiry / 1000)}:F>\n`
          ) : "") +
          (info.guildExpiry ? (
            info.isGuildLifetime
              ? `• **Server Plan**: ${CE.star.str} **Lifetime Server VIP**\n• **Valid Until**: \`Permanent\`\n`
              : `• **Server Plan**: **Active**\n• **Remaining Time**: \`${info.guildDaysLeft} day(s)\`\n• **Expires On**: <t:${Math.floor(info.guildExpiry / 1000)}:F>\n`
          ) : "") +
          (info.rolePremiums.length > 0 ? (
            `• **Role-Based Premium**: Active via **${info.rolePremiums.length}** configured server role(s):\n` +
            info.rolePremiums.map((r) => `  - <@&${r.roleId}> in **${r.guildName ?? r.guildId}**`).join("\n") + "\n"
          ) : "") +
          `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `### ${CE.star.str} Unlocked VIP Privileges\n` +
          `• ${CE.music.str} **Remote VC Audio**: Stream audio directly into any voice channel without joining (\`.play <song> <vc_or_user>\`)\n` +
          `• ${CE.radio.str} **24/7 Voice Radio**: Keep the bot in voice 24/7 with auto-reconnect (\`.24/7 <vc_or_user>\`)\n` +
          `• ${CE.promotion.str} **Global No-Prefix Mode**: Run any bot command freely with no prefix\n` +
          `• ${CE.star.str} **Priority Audio Bitrate & Processing Speed**\n`
        );
      } else {
        embed.setColor(0xED4245);
        embed.setDescription(
          `### Target: ${isUserObject ? `<@${targetId}>` : `\`${targetName}\``}\n` +
          `**Status**: ${CE.failure.str} **No Active Premium Subscription Found**\n\n` +
          `This user or server does not currently hold an active premium subscription, lifetime grant, or server-configured premium role.`
        );
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.customId === "prem:modal:remove") {
      const rawTarget = interaction.fields.getTextInputValue("target_id").trim();
      const idMatch = rawTarget.match(/\d{17,20}/);
      const targetId = idMatch ? idMatch[0] : rawTarget;
      const rawType = interaction.fields.getTextInputValue("target_type").trim().toLowerCase();
      const targetType: "user" | "server" = rawType.includes("serv") || rawType.includes("guild") ? "server" : "user";

      await interaction.deferReply();
      const result = await removeDirectPremium(targetId, targetType);

      const embed = new EmbedBuilder()
        .setTitle(result.success && result.removed ? `${CE.success.str} Premium Removed` : `${CE.warning.str} Premium Removal`)
        .setColor(result.success && result.removed ? 0x57f287 : 0xfee75c)
        .setDescription(result.message)
        .setFooter({ text: `Action by Bot Owner: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.customId === "prem:modal:set_role") {
      const rawGuild = interaction.fields.getTextInputValue("guild_id").trim();
      const guildIdMatch = rawGuild.match(/\d{17,20}/);
      const guildId = guildIdMatch ? guildIdMatch[0] : rawGuild;

      const rawRole = interaction.fields.getTextInputValue("role_id").trim();
      const roleIdMatch = rawRole.match(/\d{17,20}/);
      const roleId = roleIdMatch ? roleIdMatch[0] : rawRole;

      await interaction.deferReply();
      const result = await setPremiumRole(guildId, roleId, interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle(`${CE.success.str} Premium Role Configured`)
        .setColor(0x57f287)
        .setDescription(result.message)
        .addFields(
          { name: "Server ID", value: `\`${guildId}\``, inline: true },
          { name: "Role", value: `<@&${roleId}> (\`${roleId}\`)`, inline: true },
        )
        .setFooter({ text: `Set by Bot Owner: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.customId === "prem:modal:remove_role") {
      const rawGuild = interaction.fields.getTextInputValue("guild_id").trim();
      const guildIdMatch = rawGuild.match(/\d{17,20}/);
      const guildId = guildIdMatch ? guildIdMatch[0] : rawGuild;

      const rawRole = interaction.fields.getTextInputValue("role_id").trim();
      const roleIdMatch = rawRole.match(/\d{17,20}/);
      const roleId = roleIdMatch ? roleIdMatch[0] : rawRole;

      await interaction.deferReply();
      const result = await removePremiumRole(guildId, roleId);

      const embed = new EmbedBuilder()
        .setTitle(result.removed ? `${CE.success.str} Premium Role Removed` : `${CE.warning.str} Premium Role`)
        .setColor(result.removed ? 0x57f287 : 0xfee75c)
        .setDescription(result.message)
        .setFooter({ text: `Action by Bot Owner: ${interaction.user.tag}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (!isPermanentOwner(interaction.user.id)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Restricted: Only the Hardcoded Permanent Bot Owner (<@${PERMANENT_BOT_OWNER_ID}>) can grant premium subscriptions.`,
        flags: 1 << 6,
      });
      return;
    }

    const rawTarget = interaction.fields.getTextInputValue("target_id").trim();
    const idMatch = rawTarget.match(/\d{17,20}/);
    const targetId = idMatch ? idMatch[0] : rawTarget;
    const days = parseInt(interaction.fields.getTextInputValue("duration_days").trim(), 10) || 30;
    const isUser = interaction.customId === "prem:modal:give_user";
    const type: "user" | "server" = isUser ? "user" : "server";

    await interaction.deferReply();

    const result = await grantDirectPremium(targetId, type, days);
    const isLifetime = result.expiresAt >= 4100000000000 || days >= 9999;
    let dmSent = false;

    if (isUser) {
      try {
        const userObj = await interaction.client.users.fetch(targetId).catch(() => null);
        if (userObj) {
          const dmEmbed = new EmbedBuilder()
            .setTitle(`🎉 You Have Been Granted Relosta Premium!`)
            .setColor(0xF1C40F)
            .setDescription(
              `Hello! You have been granted **Relosta Premium** by the bot owner (<@${interaction.user.id}>)!\n\n` +
              `• **Duration:** ${isLifetime ? `${CE.star.str} **Lifetime Access**` : `\`${days}\` days (Active until <t:${Math.floor(result.expiresAt / 1000)}:F>)`}\n` +
              `• **Unlocked VIP Features:**\n` +
              `  ${CE.radio.str} **Remote VC Audio**: Play music into any voice channel without joining it (\`.play <song> <vc_or_user>\`)\n` +
              `  ${CE.music.str} **24/7 Voice Radio**: Keep the bot playing in your voice channel 24/7 (\`.24/7 <vc_or_user>\`)\n` +
              `  ${CE.promotion.str} **Global No-Prefix Mode**: Execute bot commands freely without prefix\n` +
              `  ${CE.level.str} **Priority Rates & Enhanced Privileges**\n\n` +
              `Thank you for being a valued part of the Relosta ecosystem!`,
            )
            .setThumbnail("https://cdn-icons-png.flaticon.com/512/9446/9446755.png")
            .setFooter({ text: "Relosta Premium Experience" })
            .setTimestamp();
          await userObj.send({ embeds: [dmEmbed] });
          dmSent = true;
        }
      } catch {
        dmSent = false;
      }
    }

    const replyEmbed = new EmbedBuilder()
      .setTitle(`${CE.success.str} Premium Granted Successfully!`)
      .setColor(0x57f287)
      .setDescription(
        `Successfully granted **${isLifetime ? `${CE.star.str} Lifetime` : `${days} days`}** of **${type.toUpperCase()}** Premium to ${isUser ? `<@${targetId}> (\`${targetId}\`)` : `Server \`${targetId}\``}!\n\n` +
        `• **Expiration:** ${isLifetime ? `${CE.star.str} **Lifetime**` : `<t:${Math.floor(result.expiresAt / 1000)}:F>`}\n` +
        `• **DM Status:** ${
          isUser
            ? dmSent
              ? `${CE.chat.str} User was directly notified via DM!`
              : `${CE.warning.str} User has direct messages closed or blocked.`
            : "N/A (Server License)"
        }`,
      )
      .setFooter({ text: `Granted by Bot Owner: ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [replyEmbed] });
  }
}

/**
 * /premium command: Interactive 5-Page VIP Studio & Premium Catalog Hub
 */
export const premiumCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("View VIP Studio status, 4-tier commands & features, No-Prefix controls & redemption hub"),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId || undefined;

    const userTier = await getUserPremiumTier(userId, guildId);
    const tierName = PREMIUM_TIER_NAMES[userTier] || "Free Standard Tier";
    const noPrefixOn = await isNoPrefixEnabled(userId, guildId);
    const isUserPrem = await isUserPremium(userId);
    const isGuildPrem = guildId ? await isGuildPremium(guildId) : false;

    // Page 1: Collective Overview & VIP Status
    const page1 = prettyEmbed({
      title: "Relosta Premium VIP Studio • Collective Overview",
      color: userTier > 0 ? 0xf1c40f : COLORS.primary,
      description:
        `### 👑 **Welcome to Relosta Premium VIP Control Engine**\n\n` +
        `**User Status:** ${isUserPrem ? "👑 `ACTIVE USER PREMIUM`" : "`STANDARD FREE USER`"}\n` +
        `**Guild Status:** ${isGuildPrem ? "👑 `ACTIVE GUILD PREMIUM`" : "`STANDARD GUILD`"}\n` +
        `**Current Tier:** \`${tierName}\`\n` +
        `**No-Prefix Commands:** ${noPrefixOn ? "⚡ `ENABLED`" : "🚫 `DISABLED`"}\n\n` +
        `> 🌟 **Top Tier Privilege:** All active Premium members automatically receive **Top Tier 4 (Ultimate Relosta Apex)** access with **Global No-Prefix** included by default!\n\n` +
        `Use the page buttons (\`⏪ ◀️ ❌ ▶️ ⏩\`) below to navigate through the 4 Premium Tiers and inspect their exclusive commands & features!`,
      fields: [
        { name: "⚡ No-Prefix Mode", value: noPrefixOn ? "`ACTIVE (Commands run without prefix)`" : "`INACTIVE (Prefix required)`", inline: true },
        { name: "🎶 High-Fi Audio DSP", value: userTier >= 1 ? "`320kbps / 384kbps FLAC`" : "`Standard 128kbps`", inline: true },
        { name: "📻 24/7 Dedicated Node", value: userTier >= 2 ? "`UNLIMITED`" : "`Requires Tier 2+`", inline: true },
      ],
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop",
    });

    // Page 2: Tier 1: VIP Supporter (Commands & Features)
    const page2 = prettyEmbed({
      title: "Tier 1: VIP Supporter • Commands & Features Catalog",
      color: 0x3498db,
      description:
        `### 🏆 **Tier 1: VIP Supporter Features (10 Perks)**\n\n` +
        `1. ⚡ **Global No-Prefix Execution** — Run commands without typing \`.\` or \`/\` (\`play\`, \`skip\`, \`queue\`)\n` +
        `2. 🎶 **Audio Source Switcher** — \`/source\` (\`.source\`) to swap audio mirrors in real-time\n` +
        `3. 🎧 **320kbps Lossless Audio Resolution** — High-bitrate audio pipeline\n` +
        `4. 🎛️ **14 Studio EQ Filters** — \`/eq\` (\`.eq\`) bassboost, superbass, treble, pop, rock, electronic\n` +
        `5. 🔊 **Heavy Bass Boost DSP** — \`/bassboost\` club sub-woofer punch\n` +
        `6. 📝 **Paginated Lyrics Reader** — \`/lyrics\` interactive multi-page lyrics viewer\n` +
        `7. 🔀 **Queue Shuffle & Reorder** — \`/shuffle\` & \`/move\` track queue manager\n` +
        `8. ⚡ **Custom Playback Speed** — \`/speed\` adjust tempo & pitch from 0.5x to 2.0x\n` +
        `9. 🎨 **Canvas Profile Graphic Cards** — \`/profile\` custom dynamic user card\n` +
        `10. 💬 **Personal Bio Customization** — \`/setbio\` persistent bio text quote`,
    });

    // Page 3: Tier 2: Pro Master (Commands & Features)
    const page3 = prettyEmbed({
      title: "Tier 2: Pro Master • Commands & Features Catalog",
      color: 0x2ecc71,
      description:
        `### 🏆 **Tier 2: Pro Master Features (10 Perks)**\n\n` +
        `*Includes ALL Tier 1 Perks +*\n\n` +
        `1. 📻 **24/7 Dedicated Voice Radio Node** — \`/247\` (\`.247\`) continuous non-stop music\n` +
        `2. 🔄 **Dual 24/7 Modes** — \`247 full\` (complete track) vs \`247 main\` (90s chorus highlight)\n` +
        `3. 🤖 **AI Autoplay Smart Engine** — \`/autoplay\` automatic recommendation queue\n` +
        `4. 🛠️ **Per-Server Custom Prefix** — \`/config\` persistent per-server custom prefix\n` +
        `5. 📚 **Custom Server Playlist Storage** — \`/playlist\` save & load server playlists\n` +
        `6. 🎙️ **Voice Listener Controls** — \`/vcmute\` & \`/vcdeafen\` bulk channel actions\n` +
        `7. 🎯 **Direct Track Skip-To** — \`/skipto\` jump to any position in queue\n` +
        `8. 🔊 **Nightcore, Vaporwave & 8D DSP** — Spatial 3D audio filters\n` +
        `9. 📊 **Voice Cluster Latency Inspector** — Real-time latency analytics\n` +
        `10. ⭐ **Priority Support Ticket Clearance** — VIP support channel access`,
    });

    // Page 4: Tier 3: Enterprise God Mode (Commands & Features)
    const page4 = prettyEmbed({
      title: "Tier 3: Enterprise God Mode • Commands & Features Catalog",
      color: 0xe67e22,
      description:
        `### 🏆 **Tier 3: Enterprise God Mode Features (10 Perks)**\n\n` +
        `*Includes ALL Tier 1 & Tier 2 Perks +*\n\n` +
        `1. 🛡️ **Enterprise Anti-Nuke Protection** — \`/antinuke\` god-mode anti-raid guard\n` +
        `2. ⚡ **Mass-Action Mitigation** — Intercepts malicious channel/role deletions\n` +
        `3. 🎧 **384kbps FLAC Studio Engine** — \`/highfi\` uncompressed studio audio\n` +
        `4. 🌐 **Cross-Server Broadcast Node** — \`/connect-servers\` multi-guild live node\n` +
        `5. 📁 **Unlimited Server Playlists** — Unlimited cloud playlist storage\n` +
        `6. 🔒 **Role & Channel Shielding** — Protection immunity list\n` +
        `7. ⚡ **Zero-Delay Command Processing** — Bypass standard spam cooldowns\n` +
        `8. 📝 **Comprehensive Audit Logging** — Real-time security webhook sync\n` +
        `9. 💎 **VIP Branding & Ads Bypass** — Completely removes promotional ads\n` +
        `10. 🛡️ **Staff & Owner Protection** — Hardcoded immunity enforcement`,
    });

    // Page 5: Tier 4: Ultimate Relosta Apex (Top Tier)
    const page5 = prettyEmbed({
      title: "Tier 4: Ultimate Relosta Apex • Top Rank Catalog",
      color: 0xf1c40f,
      description:
        `### 🏆 **Tier 4: Ultimate Relosta Apex Features (Top Rank)**\n\n` +
        `*Includes ALL Tier 1, Tier 2, Tier 3 Perks +*\n\n` +
        `1. 🚀 **Priority High-Speed Cluster Processing Node** — Zero audio stutters\n` +
        `2. 🤖 **AI Autopilot DJ Recommendation Engine** — Smart song queueing\n` +
        `3. 👑 **ALL 4 Tiers & 40+ VIP Perks Fully Unlocked**\n` +
        `4. ⚡ **Permanent Unlimited Global No-Prefix Execution**\n` +
        `5. 🎨 **Priority High-Res Canvas Profile Card Renderer**\n` +
        `6. 👑 **Apex VIP Prestige Badge on Profile Graphic**\n\n` +
        `> 🌟 **Note:** All active Premium subscribers automatically receive **Top Rank Tier 4** access!`,
    });

    // Action Control Button Rows (Separate buttons for adding, removing, checking No-Prefix & Top Tier)
    const actionRow1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("btn:prem:enable_noprefix")
        .setLabel("Add No-Prefix")
        .setEmoji(CE.promotion.id)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("btn:prem:disable_noprefix")
        .setLabel("Remove No-Prefix")
        .setEmoji(CE.failure.id)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("btn:prem:check_noprefix")
        .setLabel("Check No-Prefix")
        .setEmoji(CE.information.id)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("btn:prem:check_status")
        .setLabel("Check VIP Status")
        .setEmoji(CE.owner.id)
        .setStyle(ButtonStyle.Primary)
    );

    const actionRow2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("btn:prem:redeem_code")
        .setLabel("Redeem Code")
        .setEmoji(CE.key_icon.id)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("btn:prem:claim_top_tier")
        .setLabel("Claim Top Tier Apex")
        .setEmoji(CE.star.id)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setLabel("Get VIP Pass")
        .setEmoji(CE.star.id)
        .setStyle(ButtonStyle.Link)
        .setURL(SUPPORT_SERVER_URL)
    );

    await sendPaginatedEmbed(interaction, [page1, page2, page3, page4, page5], {
      footerPrefix: "Relosta Audio VIP Engine • Upgrade: discord.gg/gFgAfpSYdp",
      extraRows: [actionRow1 as any, actionRow2 as any],
    });
  },
};
