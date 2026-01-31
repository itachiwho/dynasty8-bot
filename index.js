require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const cors = require('cors');

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
    ],
});

// Initialize Express Server
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Bot Ready Event
client.once('ready', () => {
    console.log('✅ Discord Bot is online!');
    console.log(`📝 Logged in as: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    console.log(`🚀 Serving ${client.guilds.cache.size} server(s)`);
});

// Error Handling
client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        bot: client.user ? client.user.tag : 'Not connected',
        uptime: process.uptime(),
    });
});

// Webhook Endpoint for Rent Reminders
app.post('/api/remind', async (req, res) => {
    try {
        // Verify webhook secret
        const requestSecret = req.headers['x-webhook-secret'];
        if (requestSecret !== WEBHOOK_SECRET) {
            console.log('❌ Unauthorized webhook attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { houseName, price, tenantDiscordId, tenantName } = req.body;

        // Validate required fields
        if (!houseName || !price || !tenantDiscordId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`📢 Sending reminder for ${houseName} to ${tenantName || tenantDiscordId}`);

        // Create the reminder embed
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🏠 RENT REMINDER')
            .setDescription(`Your rent payment is now due!`)
            .addFields(
                { name: '🏘️ Property', value: houseName, inline: true },
                { name: '💰 Amount', value: `$${price.toLocaleString()}`, inline: true },
                { name: '⏰ Due', value: 'Within 3 days', inline: true }
            )
            .setFooter({ text: 'Dynasty 8 Real Estate' })
            .setTimestamp();

        // Send DM to tenant
        try {
            const user = await client.users.fetch(tenantDiscordId);
            await user.send({ embeds: [embed] });
            console.log(`✅ DM sent to ${user.tag}`);
        } catch (dmError) {
            console.log(`⚠️ Could not send DM to user ${tenantDiscordId}:`, dmError.message);

            // If DM fails, still try to send channel message
            if (dmError.code === 50007) {
                console.log('User has DMs disabled or bot is not in mutual server');
            }
        }

        // Send message in designated channel
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);

            await channel.send({
                content: `📢 Attention <@${tenantDiscordId}>, your rent for **${houseName}** is due!`,
                embeds: [embed],
            });

            console.log('✅ Channel message sent');
        } catch (channelError) {
            console.error('❌ Failed to send channel message:', channelError.message);
            return res.status(500).json({ error: 'Failed to send channel message' });
        }

        return res.status(200).json({
            message: 'Reminder sent successfully',
            sentDM: true,
            sentChannel: true,
        });

    } catch (error) {
        console.error('❌ Reminder error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`🌐 Express server running on port ${PORT}`);
    console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/remind`);
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
    console.error('❌ Failed to login to Discord:', error);
    process.exit(1);
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});