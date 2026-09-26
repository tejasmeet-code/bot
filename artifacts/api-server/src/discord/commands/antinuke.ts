import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from "discord.js";
import type { SlashCommand } from "../types";
import { getGuildConfig, updateGuildConfig, getAntiNukeConfig } from "../storage/config";
import { CE } from "../utils/embedStyle";
import { isBotAdmin } from "../storage/premium";

function canAccessAntiNuke(interaction: ChatInputCommandInteraction, cfg: any): boolean {
  if (!interaction.guild) return false;
  if (interaction.guild.ownerId === interaction.user.id) return true;
  if (isBotAdmin(interaction.user.id)) return true;
  if (cfg.serverOwnerWhitelistUserIds?.includes(interaction.user.id)) return true;
  return false;
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Manage Anti-Nuke rules and whitelists")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((g) =>
      g
        .setName("whitelist")
        .setDescription("Manage global Anti-Nuke whitelists")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Add a user, role, channel, or category to Anti-Nuke whitelist")
            .addUserOption((o) => o.setName("user").setDescription("User to whitelist").setRequired(false))
            .addRoleOption((o) => o.setName("role").setDescription("Role to whitelist").setRequired(false))
            .addChannelOption((o) => o.setName("channel").setDescription("Text Channel to whitelist").setRequired(false))
            .addChannelOption((o) => o.setName("category").setDescription("Category to whitelist").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("Remove a user, role, channel, or category from Anti-Nuke whitelist")
            .addUserOption((o) => o.setName("user").setDescription("User to remove").setRequired(false))
            .addRoleOption((o) => o.setName("role").setDescription("Role to remove").setRequired(false))
            .addChannelOption((o) => o.setName("channel").setDescription("Text Channel to remove").setRequired(false))
            .addChannelOption((o) => o.setName("category").setDescription("Category to remove").addChannelTypes(ChannelType.GuildCategory).setRequired(false))
        )
        .addSubcommand((sub) =>
          sub.setName("list").setDescription("List all currently whitelisted users, roles, channels, and categories in Anti-Nuke")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("One-click Auto Setup for Anti-Nuke protection (aliases: .an st, .an setup)")
        .addStringOption((o) =>
          o
            .setName("punishment")
            .setDescription("Punishment for unauthorized nuke actions")
            .setRequired(false)
            .addChoices(
              { name: "Ban Immediately", value: "ban" },
              { name: "Kick Member", value: "kick" },
              { name: "Strip Roles", value: "strip_roles" },
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName("enable").setDescription("Enable Anti-Nuke security system"))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disable Anti-Nuke security system"))
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("View current Anti-Nuke status and rules")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: 1 << 6 });
      return;
    }

    const cfg = await getGuildConfig(interaction.guildId);
    if (!canAccessAntiNuke(interaction, cfg)) {
      await interaction.reply({
        content: `${CE.failure.str} Access Denied: Only the **Server Owner** and **Bot Owner** can access Anti-Nuke commands.`,
        flags: 1 << 6,
      });
      return;
    }

    const group = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();

    if (group === "whitelist") {
      if (sub === "add") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");
        const channel = interaction.options.getChannel("channel");
        const category = interaction.options.getChannel("category");

        if (!user && !role && !channel && !category) {
          await interaction.reply({ content: `${CE.failure.str} Please specify at least one user, role, channel, or category to whitelist.`, flags: 1 << 6 });
          return;
        }

        const added: string[] = [];
        await updateGuildConfig(interaction.guildId, (cfg) => {
          const an = getAntiNukeConfig(cfg);
          if (user && !an.globalWhitelistUserIds.includes(user.id)) {
            an.globalWhitelistUserIds.push(user.id);
            added.push(`User: ${user}`);
          }
          if (role && !an.globalWhitelistRoleIds.includes(role.id)) {
            an.globalWhitelistRoleIds.push(role.id);
            added.push(`Role: ${role}`);
          }
          if (channel && !an.globalWhitelistChannelIds.includes(channel.id)) {
            an.globalWhitelistChannelIds.push(channel.id);
            added.push(`Channel: ${channel}`);
          }
          if (category && !an.globalWhitelistCategoryIds.includes(category.id)) {
            an.globalWhitelistCategoryIds.push(category.id);
            added.push(`Category: ${category}`);
          }
          cfg.antiNukeConfig = an;
          return cfg;
        });

        const embed = new EmbedBuilder()
          .setTitle(`${CE.success.str} Anti-Nuke Whitelist Added`)
          .setDescription(added.length > 0 ? added.join("\n") : "Specified items were already whitelisted.")
          .setColor(0x57f287);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "remove") {
        const user = interaction.options.getUser("user");
        const role = interaction.options.getRole("role");
        const channel = interaction.options.getChannel("channel");
        const category = interaction.options.getChannel("category");

        if (!user && !role && !channel && !category) {
          await interaction.reply({ content: `${CE.failure.str} Please specify at least one user, role, channel, or category to remove.`, flags: 1 << 6 });
          return;
        }

        const removed: string[] = [];
        await updateGuildConfig(interaction.guildId, (cfg) => {
          const an = getAntiNukeConfig(cfg);
          if (user && an.globalWhitelistUserIds.includes(user.id)) {
            an.globalWhitelistUserIds = an.globalWhitelistUserIds.filter((id) => id !== user.id);
            removed.push(`User: ${user}`);
          }
          if (role && an.globalWhitelistRoleIds.includes(role.id)) {
            an.globalWhitelistRoleIds = an.globalWhitelistRoleIds.filter((id) => id !== role.id);
            removed.push(`Role: ${role}`);
          }
          if (channel && an.globalWhitelistChannelIds.includes(channel.id)) {
            an.globalWhitelistChannelIds = an.globalWhitelistChannelIds.filter((id) => id !== channel.id);
            removed.push(`Channel: ${channel}`);
          }
          if (category && an.globalWhitelistCategoryIds.includes(category.id)) {
            an.globalWhitelistCategoryIds = an.globalWhitelistCategoryIds.filter((id) => id !== category.id);
            removed.push(`Category: ${category}`);
          }
          cfg.antiNukeConfig = an;
          return cfg;
        });

        const embed = new EmbedBuilder()
          .setTitle(`${CE.success.str} Anti-Nuke Whitelist Removed`)
          .setDescription(removed.length > 0 ? removed.join("\n") : "Specified items were not in the whitelist.")
          .setColor(0x57f287);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "list") {
        const cfg = await getGuildConfig(interaction.guildId);
        const an = getAntiNukeConfig(cfg);

        const users = an.globalWhitelistUserIds.map((id) => `<@${id}>`).join(", ") || "*None*";
        const roles = an.globalWhitelistRoleIds.map((id) => `<@&${id}>`).join(", ") || "*None*";
        const channels = an.globalWhitelistChannelIds.map((id) => `<#${id}>`).join(", ") || "*None*";
        const categories = an.globalWhitelistCategoryIds.map((id) => `<#${id}>`).join(", ") || "*None*";

        const embed = new EmbedBuilder()
          .setTitle(`${CE.admin.str} Anti-Nuke Whitelist`)
          .setColor(0x2b2d31)
          .addFields(
            { name: "Users", value: users, inline: false },
            { name: "Roles", value: roles, inline: false },
            { name: "Channels", value: channels, inline: false },
            { name: "Categories", value: categories, inline: false }
          );
        await interaction.reply({ embeds: [embed] });
        return;
      }
    }

    if (sub === "setup") {
      const punishmentChoice = (interaction.options.getString("punishment") as any) || "ban";
      await updateGuildConfig(interaction.guildId, (cfg) => {
        const an = getAntiNukeConfig(cfg);
        an.enabled = true;
        an.commonPunishment = punishmentChoice;
        // Auto-whitelist guild owner and setup runner
        if (interaction.guild?.ownerId && !an.globalWhitelistUserIds.includes(interaction.guild.ownerId)) {
          an.globalWhitelistUserIds.push(interaction.guild.ownerId);
        }
        if (!an.globalWhitelistUserIds.includes(interaction.user.id)) {
          an.globalWhitelistUserIds.push(interaction.user.id);
        }
        cfg.antiNukeConfig = an;
        return cfg;
      });

      const embed = new EmbedBuilder()
        .setTitle(`${CE.nuke.str} Anti-Nuke Auto Setup Complete!`)
        .setColor(0x57f287)
        .setDescription(
          `**Anti-Nuke Protection System is now 100% ARMED and ACTIVE!**\n\n` +
          `• **Status:** \`ACTIVE & MONITORING\`\n` +
          `• **Enforcement Punishment:** \`${punishmentChoice.toUpperCase()}\`\n` +
          `• **Server Owner Whitelisted:** <@${interaction.guild.ownerId}>\n` +
          `• **Setup Admin Whitelisted:** <@${interaction.user.id}>\n\n` +
          `Any unauthorized mass kicks, bans, channel deletions, role deletions, bot additions, or rogue webhooks will be immediately countered.`,
        )
        .addFields(
          { name: `${CE.locked.str} Channel Protection`, value: "Max 2 deletions / 10s", inline: true },
          { name: `${CE.locked.str} Role Protection`, value: "Max 2 deletions / 10s", inline: true },
          { name: `${CE.ban.str} Mass Ban / Kick`, value: "Max 3 punishments / 10s", inline: true },
          { name: `${CE.nuke.str} Webhook & Bot Adds`, value: "Instant block & quarantine", inline: true },
        )
        .setImage("https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1200&auto=format&fit=crop")
        .setFooter({ text: "Relosta Sentinel Engine • Use .an wl to add additional trusted admins" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === "enable") {
      await updateGuildConfig(interaction.guildId, (cfg) => {
        const an = getAntiNukeConfig(cfg);
        an.enabled = true;
        cfg.antiNukeConfig = an;
        return cfg;
      });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.success.str} Anti-Nuke Enabled`)
            .setColor(0x57f287)
            .setDescription("Anti-Nuke monitoring is now **ENABLED** on this server."),
        ],
      });
      return;
    }

    if (sub === "disable") {
      await updateGuildConfig(interaction.guildId, (cfg) => {
        const an = getAntiNukeConfig(cfg);
        an.enabled = false;
        cfg.antiNukeConfig = an;
        return cfg;
      });
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE.warning.str} Anti-Nuke Disabled`)
            .setColor(0xed4245)
            .setDescription("Anti-Nuke monitoring has been **DISABLED**. Server is no longer protected against mass deletions."),
        ],
      });
      return;
    }

    if (sub === "status") {
      const cfg = await getGuildConfig(interaction.guildId);
      const an = getAntiNukeConfig(cfg);

      const embed = new EmbedBuilder()
        .setTitle(`${CE.nuke.str} Anti-Nuke Configuration`)
        .setColor(an.enabled ? 0x57f287 : 0xed4245)
        .setDescription(
          an.enabled
            ? `${CE.check_yes.str} **Anti-Nuke is ENABLED** (Punishment: \`${an.commonPunishment}\`)`
            : `${CE.check_no.str} **Anti-Nuke is DISABLED**`
        )
        .addFields(
          {
            name: "Whitelisted",
            value: `**Users:** ${an.globalWhitelistUserIds.length}\n**Roles:** ${an.globalWhitelistRoleIds.length}\n**Channels:** ${an.globalWhitelistChannelIds.length}\n**Categories:** ${an.globalWhitelistCategoryIds.length}`,
            inline: false,
          }
        );
      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
