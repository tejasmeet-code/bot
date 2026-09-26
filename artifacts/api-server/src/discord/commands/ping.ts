import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { SlashCommand } from "../types";
import { prettyEmbed, buildSupportRow, COLORS, CE } from "../utils/embedStyle";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check Relosta Bot's network latency and WebSocket connection speed."),

  async execute(interaction: ChatInputCommandInteraction) {
    const start = Date.now();
    await interaction.deferReply();
    const roundTrip = Date.now() - start;
    const wsPing = Math.max(0, Math.round(interaction.client.ws.ping));

    let statusEmoji: string = CE.success.str;
    if (wsPing > 300) statusEmoji = CE.error.str;
    else if (wsPing > 150) statusEmoji = CE.warning.str;

    const embed = prettyEmbed({
      title: "Relosta Network Latency & Gateway Response",
      description:
        `### ${CE.notifications.str}  **WebSocket & Gateway Connectivity**\n\n` +
        `> **Round-Trip Interaction:** \`${roundTrip}ms\`\n` +
        `> **Gateway WebSocket Ping:** ${statusEmoji} \`${wsPing}ms\`\n\n` +
        `${CE.promotion.str} **Tired of bot lag and dropped voice connections?**\n` +
        `Relosta Premium guarantees dedicated high-priority cluster nodes, sub-millisecond execution, and 24/7 uninterrupted uptime.\n\n` +
        `${CE.arrow_red.str} **[Click Here to Claim Your Premium Pass](https://discord.gg/gFgAfpSYdp)**`,
      color: wsPing > 200 ? COLORS.warning : COLORS.success,
      footer: "High-speed dedicated audio & security cluster • discord.gg/gFgAfpSYdp",
    });

    await interaction.editReply({
      embeds: [embed],
      components: [buildSupportRow()],
    });
  },
};

export default command;
