require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
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

        const reminderMessage = `# :incoming_envelope:  Dynasty 8 — Rent Reminder
Dear <@${tenantDiscordId}>,

This is a gentle reminder that your rent payment is currently overdue. We kindly request you to clear the outstanding amount at your earliest convenience to avoid any inconvenience. If you have already made the payment, please ignore this message. For any questions or assistance, feel free to contact us.

## Property Address: **${houseName}**

Thank you for your cooperation.
- **Dynasty 8 Real Estate Reminder Team**`;

        let dmFailed = false;
        let dmError = '';

        // Send DM to tenant
        try {
            const user = await client.users.fetch(tenantDiscordId);
            await user.send(reminderMessage);
            console.log(`✅ DM sent to ${user.tag}`);
        } catch (dmErr) {
            dmFailed = true;
            console.log(`⚠️ Could not send DM to user ${tenantDiscordId}:`, dmErr.message);

            if (dmErr.code === 50007) {
                dmError = 'User has DMs disabled or blocked the bot';
                console.log('❌ DM FAILURE LOG: User has DMs disabled or not in mutual server');
            } else {
                dmError = dmErr.message;
                console.log('❌ DM FAILURE LOG:', dmErr.message);
            }
        }

        // Send message in designated channel
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);

            await channel.send(reminderMessage);

            console.log('✅ Channel message sent');

            // Log if DM failed
            if (dmFailed) {
                await channel.send(`⚠️ **ADMIN ALERT**: Failed to send DM to <@${tenantDiscordId}> for ${houseName}. Reason: ${dmError}`);
                console.log(`⚠️ Admin alert sent about DM failure`);
            }
        } catch (channelError) {
            console.error('❌ Failed to send channel message:', channelError.message);
            return res.status(500).json({ error: 'Failed to send channel message' });
        }

        return res.status(200).json({
            message: 'Reminder sent successfully',
            dmFailed,
            dmError: dmFailed ? dmError : null,
        });

    } catch (error) {
        console.error('❌ Reminder error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Webhook Endpoint for Eviction Notices
app.post('/api/evict', async (req, res) => {
    try {
        // Verify webhook secret
        const requestSecret = req.headers['x-webhook-secret'];
        if (requestSecret !== WEBHOOK_SECRET) {
            console.log('❌ Unauthorized webhook attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { houseName, tenantDiscordId, tenantName } = req.body;

        // Validate required fields
        if (!houseName || !tenantDiscordId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`🚨 Sending eviction notice for ${houseName} to ${tenantName || tenantDiscordId}`);

        const evictionMessage = `## :envelope_with_arrow: Dynasty 8 — Evictable Property Notice
Dear Customer, <@${tenantDiscordId}>

Your property at: ${houseName}
has been marked as Evictable.

**You have 24 hours to clear the payment.**
If payment is not made within this time, the house will be removed.

:warning: Once removed,
Dynasty 8 will not be responsible for the property or any belongings.

If you are facing any issue or need time,
please open a [**Ticket Dynasty 8**](https://discord.com/channels/790476881988288512/1288495602954534922) immediately and inform us.
(Waiting until after removal will not be accepted.)
Thank you for your cooperation.
- **Dynasty 8 Real Estate Reminder Team**`;

        let dmFailed = false;
        let dmError = '';

        // Send DM to tenant
        try {
            const user = await client.users.fetch(tenantDiscordId);
            await user.send(evictionMessage);
            console.log(`✅ Eviction DM sent to ${user.tag}`);
        } catch (dmErr) {
            dmFailed = true;
            console.log(`⚠️ Could not send eviction DM to user ${tenantDiscordId}:`, dmErr.message);

            if (dmErr.code === 50007) {
                dmError = 'User has DMs disabled or blocked the bot';
                console.log('❌ EVICTION DM FAILURE LOG: User has DMs disabled');
            } else {
                dmError = dmErr.message;
                console.log('❌ EVICTION DM FAILURE LOG:', dmErr.message);
            }
        }

        // Send message in designated channel
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);

            await channel.send(`<@${tenantDiscordId}>\n${evictionMessage}`);

            console.log('✅ Eviction channel message sent');

            // Log if DM failed
            if (dmFailed) {
                await channel.send(`⚠️ **ADMIN ALERT**: Failed to send eviction DM to <@${tenantDiscordId}> for ${houseName}. Reason: ${dmError}`);
                console.log(`⚠️ Admin alert sent about eviction DM failure`);
            }
        } catch (channelError) {
            console.error('❌ Failed to send eviction channel message:', channelError.message);
            return res.status(500).json({ error: 'Failed to send channel message' });
        }

        return res.status(200).json({
            message: 'Eviction notice sent successfully',
            dmFailed,
            dmError: dmFailed ? dmError : null,
        });

    } catch (error) {
        console.error('❌ Eviction error:', error);
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