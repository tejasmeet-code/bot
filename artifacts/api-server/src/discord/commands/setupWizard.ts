import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type RoleSelectMenuInteraction,
} from "discord.js";
import type { SlashCommand } from "../types";
import { updateGuildConfig } from "../storage/config";
import {
  runAutoSetupWizard,
  runAllSetupWizard,
  runSpecificSetup,
} from "../utils/autoSetupWizard";
import { detectSmartRoles } from "../utils/roleDetector";
import { CE } from "../utils/embedStyle";

interface WizardState {
  step: number;
  mainRoleId?: string;
  staffCommonRoleId?: string;
  staffRoleHierarchy?: string[];
}

const activeWizards = new Map<string, WizardState>();

export async function startSetupWizard(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    const msg = { content: "This command can only be used inside a server.", flags: 1 << 6 };
    if (interaction.isButton()) await interaction.reply(msg);
    else await interaction.reply(msg);
    return;
  }

  const detection = await detectSmartRoles(interaction.guild);
  const state: WizardState = {
    step: 1,
    mainRoleId: detection.mainMemberRole?.id,
    staffCommonRoleId: detection.staffCommonRole?.id,
    staffRoleHierarchy: detection.staffHierarchy.map((r) => r.id),
  };
  activeWizards.set(`${interaction.guildId}:${interaction.user.id}`, state);

  const suggestedText = detection.mainMemberRole
    ? `<@&${detection.mainMemberRole.id}> (\`${detection.mainMemberRole.name}\`)`
    : "*No obvious member role detected*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.settings.str} Smart Server Setup — Step 1/3: Main Member Role`)
    .setDescription(
      "Configure the **Main Member Role** given to standard community members.\n\n" +
      `${CE.star.str} **Smart Suggested Role**: ${suggestedText}\n\n` +
      "• Click the **suggested button** below for instant 1-click selection\n" +
      "• Or use the **dropdown menu** to pick any role in your server\n" +
      "• Or click **1-Click Auto Setup** to automatically configure roles, logs, and protections!",
    )
    .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
    .setColor(0x2b2d31);

  const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("wiz:step1:select")
      .setPlaceholder("Select Main Member Role...")
      .setMinValues(1)
      .setMaxValues(1),
  );

  const btnRow = new ActionRowBuilder<ButtonBuilder>();
  if (detection.mainMemberRole) {
    btnRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`wiz:step1:suggested:${detection.mainMemberRole.id}`)
        .setLabel(`Use @${detection.mainMemberRole.name.slice(0, 20)} (Suggested)`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(CE.star.id),
    );
  }
  btnRow.addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step1:auto")
      .setLabel("1-Click Auto Setup")
      .setEmoji(CE.check.id)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:step1:skip")
      .setLabel("Skip Step 1")
      .setStyle(ButtonStyle.Secondary),
  );

  if (interaction.isButton()) {
    await interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
  } else {
    await interaction.reply({ embeds: [embed], components: [selectRow, btnRow] });
  }
}

export async function showSmartRolesOverview(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply();

  const detection = await detectSmartRoles(interaction.guild);

  const memberStr = detection.mainMemberRole
    ? `<@&${detection.mainMemberRole.id}> (\`${detection.mainMemberRole.name}\`)`
    : "*None detected*";
  const staffStr = detection.staffCommonRole
    ? `<@&${detection.staffCommonRole.id}> (\`${detection.staffCommonRole.name}\`)`
    : "*None detected*";
  const hierarchyStr =
    detection.staffHierarchy.length > 0
      ? detection.staffHierarchy
          .slice(0, 8)
          .map((r, i) => `\`${i + 1}.\` <@&${r.id}> (Pos: ${r.position})`)
          .join("\n")
      : "*No staff hierarchy roles found*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.star.str} Smart Role Detection Report — ${interaction.guild.name}`)
    .setColor(0x57f287)
    .setDescription(
      "Relosta Engine has analyzed your server permissions, positions, and role structures.\n" +
      "Click **Apply Detected Roles** to instantly sync these roles across all bot modules.",
    )
    .addFields(
      { name: `${CE.user.str} Main Member Role`, value: memberStr, inline: true },
      { name: `${CE.moderation.str} Staff Common Role`, value: staffStr, inline: true },
      { name: `${CE.manager.str} Staff Hierarchy (${detection.staffHierarchy.length} Roles Ranked)`, value: hierarchyStr, inline: false },
    )
    .setFooter({ text: "Use /setup to customize each role individually or run 1-Click Auto Setup." })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step1:auto")
      .setLabel("Apply Detected Roles")
      .setEmoji(CE.check.id)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:wizard:start")
      .setLabel("Interactive Setup Wizard")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export const setupWizardCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure key roles, staff hierarchy, automod, and server security.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o
        .setName("module")
        .setDescription("Specific setup module: all, roles, antinuke, automod, staff, logs, verify")
        .setRequired(false)
        .addChoices(
          { name: "all (Setup Everything: Anti-Nuke, AutoMod, Staff, Channels)", value: "all" },
          { name: "roles (Smart Role Detection & Hierarchy Preview)", value: "roles" },
          { name: "antinuke (Anti-Nuke Protection & Whitelisting)", value: "antinuke" },
          { name: "automod (AutoMod & Moderation System)", value: "automod" },
          { name: "staff (Staff Hierarchy & Management)", value: "staff" },
          { name: "logs (Designated Logging Channels)", value: "logs" },
          { name: "verify (Member Verification)", value: "verify" },
        ),
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      await interaction.reply({ content: "This command can only be used inside a server.", flags: 1 << 6 });
      return;
    }

    const moduleOption = interaction.options.getString("module");
    if (moduleOption) {
      if (moduleOption === "roles") {
        await showSmartRolesOverview(interaction);
        return;
      }
      if (moduleOption === "all") {
        await interaction.deferReply();
        const { embed } = await runAllSetupWizard(interaction.guild, interaction.user.id);
        await interaction.editReply({ embeds: [embed] });
        return;
      }
      const { embed } = await runSpecificSetup(interaction.guild, moduleOption, interaction.user.id);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    await startSetupWizard(interaction);
  },
};

export async function handleWizardSelect(interaction: RoleSelectMenuInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) return;
  const key = `${guildId}:${interaction.user.id}`;
  const state = activeWizards.get(key) ?? { step: 1 };

  if (interaction.customId === "wiz:step1:select") {
    state.mainRoleId = interaction.values[0];
    state.step = 2;
    activeWizards.set(key, state);
    await showStep2(interaction);
  } else if (interaction.customId === "wiz:step2:select") {
    state.staffCommonRoleId = interaction.values[0];
    state.step = 3;
    activeWizards.set(key, state);
    await showStep3(interaction);
  } else if (interaction.customId === "wiz:step3:multiselect") {
    state.staffRoleHierarchy = interaction.values;
    await finishWizard(interaction, state);
  }
}

export async function handleWizardButton(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId || !interaction.guild) return;
  const key = `${guildId}:${interaction.user.id}`;
  const state = activeWizards.get(key) ?? { step: 1 };

  if (interaction.customId === "wiz:wizard:start") {
    await startSetupWizard(interaction);
    return;
  }

  if (interaction.customId.startsWith("wiz:step1:suggested:")) {
    const roleId = interaction.customId.split(":")[3];
    state.mainRoleId = roleId;
    state.step = 2;
    activeWizards.set(key, state);
    await showStep2(interaction);
    return;
  }

  if (interaction.customId === "wiz:step1:auto") {
    const { embed } = await runAutoSetupWizard(interaction.guild, interaction.user.id);
    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (interaction.customId === "wiz:step1:skip") {
    state.mainRoleId = undefined;
    state.step = 2;
    activeWizards.set(key, state);
    await showStep2(interaction);
    return;
  }

  if (interaction.customId.startsWith("wiz:step2:suggested:")) {
    const roleId = interaction.customId.split(":")[3];
    state.staffCommonRoleId = roleId;
    state.step = 3;
    activeWizards.set(key, state);
    await showStep3(interaction);
    return;
  }

  if (interaction.customId === "wiz:step2:auto") {
    const detection = await detectSmartRoles(interaction.guild);
    state.staffCommonRoleId = detection.staffCommonRole?.id;
    state.step = 3;
    activeWizards.set(key, state);
    await showStep3(interaction);
    return;
  }

  if (interaction.customId === "wiz:step2:skip") {
    state.staffCommonRoleId = undefined;
    state.step = 3;
    activeWizards.set(key, state);
    await showStep3(interaction);
    return;
  }

  if (interaction.customId === "wiz:step3:confirm_detected" || interaction.customId === "wiz:step3:auto") {
    const detection = await detectSmartRoles(interaction.guild);
    state.staffRoleHierarchy = detection.staffHierarchy.map((r) => r.id);
    await finishWizard(interaction, state);
    return;
  }

  if (interaction.customId === "wiz:step3:skip") {
    state.staffRoleHierarchy = [];
    await finishWizard(interaction, state);
    return;
  }
}

async function showStep2(
  interaction: RoleSelectMenuInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) return;
  const detection = await detectSmartRoles(interaction.guild);
  const suggestedText = detection.staffCommonRole
    ? `<@&${detection.staffCommonRole.id}> (\`${detection.staffCommonRole.name}\`)`
    : "*No staff role auto-detected*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.settings.str} Smart Server Setup — Step 2/3: Staff Common Role`)
    .setDescription(
      "Select the **Staff Common Role** shared by all moderators, trial staff, and administrators.\n\n" +
      `${CE.star.str} **Smart Suggested Staff Role**: ${suggestedText}\n\n` +
      "• Click the **suggested button** below for instant 1-click assignment\n" +
      "• Or use the **dropdown menu** to pick any staff role\n" +
      "• Or click **Skip Step 2** to proceed to the hierarchy.",
    )
    .setColor(0x2b2d31);

  const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("wiz:step2:select")
      .setPlaceholder("Select Staff Common Role...")
      .setMinValues(1)
      .setMaxValues(1),
  );

  const btnRow = new ActionRowBuilder<ButtonBuilder>();
  if (detection.staffCommonRole) {
    btnRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`wiz:step2:suggested:${detection.staffCommonRole.id}`)
        .setLabel(`Use @${detection.staffCommonRole.name.slice(0, 20)} (Suggested)`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji(CE.star.id),
    );
  }
  btnRow.addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step2:auto")
      .setLabel("Auto-Detect Staff")
      .setEmoji(CE.check.id)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:step2:skip")
      .setLabel("Skip Step 2")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
}

async function showStep3(
  interaction: RoleSelectMenuInteraction | ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) return;
  const detection = await detectSmartRoles(interaction.guild);

  const hierarchyPreview =
    detection.staffHierarchy.length > 0
      ? detection.staffHierarchy
          .slice(0, 6)
          .map((r, i) => `\`${i + 1}.\` <@&${r.id}> *(Pos: ${r.position})*`)
          .join("\n") +
        (detection.staffHierarchy.length > 6 ? `\n*+${detection.staffHierarchy.length - 6} more roles*` : "")
      : "*No staff roles automatically detected*";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.settings.str} Smart Server Setup — Step 3/3: Staff Role Hierarchy`)
    .setDescription(
      "Configure your **Staff Role Hierarchy** (ranked ordered list from **Highest Authority to Lowest Authority**).\n\n" +
      `**${CE.bot.str} Smart Auto-Detected Hierarchy:**\n` +
      `${hierarchyPreview}\n\n` +
      "• Click **Confirm Detected Hierarchy** to accept this ranking in 1-click\n" +
      "• Or use the **Multi-Role Dropdown** below to select roles in custom order\n" +
      "• Or click **Skip Step 3 & Finish**.",
    )
    .setColor(0x2b2d31);

  const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId("wiz:step3:multiselect")
      .setPlaceholder("Custom selection: pick staff roles in order...")
      .setMinValues(1)
      .setMaxValues(Math.min(detection.allValidRoles.length || 1, 25)),
  );

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("wiz:step3:confirm_detected")
      .setLabel("Confirm Detected Hierarchy (Recommended)")
      .setEmoji(CE.check.id)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("wiz:step3:skip")
      .setLabel("Skip & Finish")
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({ embeds: [embed], components: [selectRow, btnRow] });
}

async function finishWizard(
  interaction: ButtonInteraction | RoleSelectMenuInteraction,
  state: WizardState,
): Promise<void> {
  const guildId = interaction.guildId!;
  await updateGuildConfig(guildId, (cfg) => ({
    ...cfg,
    setupWizardCompleted: true,
    commandsUnlocked: true,
    setupConfig: {
      mainRoleId: state.mainRoleId,
      staffCommonRoleId: state.staffCommonRoleId,
      staffRoleHierarchy: state.staffRoleHierarchy ?? [],
    },
  }));

  const mainRoleText = state.mainRoleId ? `<@&${state.mainRoleId}>` : "Not set (Skipped)";
  const staffRoleText = state.staffCommonRoleId ? `<@&${state.staffCommonRoleId}>` : "Not set (Skipped)";
  const hierarchyText =
    state.staffRoleHierarchy && state.staffRoleHierarchy.length > 0
      ? state.staffRoleHierarchy.map((r) => `<@&${r}>`).join(" ➔ ")
      : "Not set (Skipped)";

  const embed = new EmbedBuilder()
    .setTitle(`${CE.success.str} Server Setup Complete!`)
    .setDescription("The server onboarding wizard has captured your configurations. All bot features and commands are active.")
    .setColor(0x57f287)
    .addFields(
      { name: `${CE.user.str} Main Role`, value: mainRoleText, inline: true },
      { name: `${CE.moderation.str} Staff Common Role`, value: staffRoleText, inline: true },
      { name: `${CE.manager.str} Staff Role Hierarchy (Highest ➔ Lowest)`, value: hierarchyText, inline: false },
    )
    .setImage("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1200&auto=format&fit=crop")
    .setFooter({ text: "Use /setup at any time to modify roles or modules." });

  await interaction.update({ embeds: [embed], components: [] });
}

export default setupWizardCommand;
