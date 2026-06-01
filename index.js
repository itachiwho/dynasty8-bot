require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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

    // Register /sendtext command
    const guild = client.guilds.cache.get('790476881988288512');
    if (guild) {
        guild.commands.create(
            new SlashCommandBuilder()
                .setName('sendtext')
                .setDescription('Send any custom styled message (markdown supported)')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Paste your message. Use \\n for line breaks')
                        .setRequired(true)
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        ).then(() => {
            console.log('✅ /sendtext slash command registered successfully!');
        }).catch(err => {
            console.error('❌ Failed to register /sendtext command:', err.message);
        });
    } else {
        console.warn('⚠️ Could not find guild. Command not registered.');
    }
});

// Error Handling
client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

// Handle Slash Commands - Fixed version
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'sendtext') {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Only administrators can use this command.',
                ephemeral: true
            });
        }

        let customMessage = interaction.options.getString('message');

        // Convert \n into real line breaks
        customMessage = customMessage.replace(/\\n/g, '\n');

        // Fix: Prevent whole message becoming huge header when starting with #
        if (customMessage.trim().startsWith('#')) {
            customMessage = '​' + customMessage;   // Zero-width space
        }

        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            await channel.send(customMessage);

            console.log(`📨 Custom styled message sent by ${interaction.user.tag}`);

            await interaction.reply({
                content: '✅ Custom message sent successfully to the channel!',
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Failed to send custom message:', error.message);
            await interaction.reply({
                content: '❌ Failed to send the message. Check if bot has Send Messages permission.',
                ephemeral: true
            });
        }
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'online',
        bot: client.user ? client.user.tag : 'Not connected',
        uptime: process.uptime(),
    });
});

// ==================== YOUR ORIGINAL REMIND ENDPOINT (FULLY RESTORED) ====================
app.post('/api/remind', async (req, res) => {
    try {
        const requestSecret = req.headers['x-webhook-secret'];
        if (requestSecret !== WEBHOOK_SECRET) {
            console.log('❌ Unauthorized webhook attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { houseName, price, tenantDiscordId, tenantName } = req.body;

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

        try {
            const channel = await client.channels.fetch(CHANNEL_ID);

            await channel.send(reminderMessage);

            console.log('✅ Channel message sent');

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

// ==================== YOUR ORIGINAL EVICT ENDPOINT (FULLY RESTORED) ====================
app.post('/api/evict', async (req, res) => {
    try {
        const requestSecret = req.headers['x-webhook-secret'];
        if (requestSecret !== WEBHOOK_SECRET) {
            console.log('❌ Unauthorized webhook attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { houseName, tenantDiscordId, tenantName } = req.body;

        if (!houseName || !tenantDiscordId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`🚨 Sending eviction notice for ${houseName} to ${tenantName || tenantDiscordId}`);

        const evictionMessage = `## :envelope_with_arrow: Dynasty 8 — Evictable Property Notice
Dear Customer, <@${tenantDiscordId}>

Your property at: **${houseName}** has been marked as Evictable.

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

        try {
            const channel = await client.channels.fetch(CHANNEL_ID);

            await channel.send(evictionMessage);

            console.log('✅ Eviction channel message sent');

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

// ==================== DISMISS ENDPOINT ====================
app.post('/api/dismiss', async (req, res) => {
    try {
        const requestSecret = req.headers['x-webhook-secret'];
        if (requestSecret !== WEBHOOK_SECRET) {
            console.log('❌ Unauthorized webhook attempt');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { houseName, tenantDiscordId, tenantName } = req.body;

        if (!houseName || !tenantDiscordId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log(`🚫 Sending dismissal notice for ${houseName} to ${tenantName || tenantDiscordId}`);

        const dismissalMessage = `## :no_entry: Dynasty 8 — Property Removed
Dear Customer, <@${tenantDiscordId}>

Your access to the property located at **${houseName}** has been officially **Removed** from Dynasty 8 Real Estate.

:placard: **Important Notice**

Due to unpaid rent, your tenancy has been terminated and your access to this property has been revoked.

If you wish to regain access to your property and recover any belongings associated with it, you must:

- Contact the Dynasty 8 Team within **24 hours**
- Clear any outstanding evictable dues or unpaid rent
- Follow any instructions provided by Dynasty 8 staff

Failure to contact Dynasty 8 within the specified time period may result in permanent loss of access and forfeiture of any remaining property rights associated with this residence.

If you believe this action was taken in error or would like to resolve the matter, please open a [**Ticket in Dynasty 8**](https://discord.com/channels/790476881988288512/1288495602954534922) within 24 hours.

Thank you.
- **Dynasty 8 Real Estate Management Team**`;

        let dmFailed = false;
        let dmError = '';

        try {
            const user = await client.users.fetch(tenantDiscordId);
            await user.send(dismissalMessage);
            console.log(`✅ Dismissal DM sent to ${user.tag}`);
        } catch (dmErr) {
            dmFailed = true;
            console.log(`⚠️ Could not send dismissal DM to user ${tenantDiscordId}:`, dmErr.message);

            if (dmErr.code === 50007) {
                dmError = 'User has DMs disabled or blocked the bot';
                console.log('❌ DISMISSAL DM FAILURE LOG: User has DMs disabled');
            } else {
                dmError = dmErr.message;
                console.log('❌ DISMISSAL DM FAILURE LOG:', dmErr.message);
            }
        }

        try {
            const channel = await client.channels.fetch(CHANNEL_ID);

            await channel.send(dismissalMessage);

            console.log('✅ Dismissal channel message sent');

            if (dmFailed) {
                await channel.send(`⚠️ **ADMIN ALERT**: Failed to send dismissal DM to <@${tenantDiscordId}> for ${houseName}. Reason: ${dmError}`);
                console.log(`⚠️ Admin alert sent about dismissal DM failure`);
            }
        } catch (channelError) {
            console.error('❌ Failed to send dismissal channel message:', channelError.message);
            return res.status(500).json({ error: 'Failed to send channel message' });
        }

        return res.status(200).json({
            message: 'Dismissal notice sent successfully',
            dmFailed,
            dmError: dmFailed ? dmError : null,
        });

    } catch (error) {
        console.error('❌ Dismissal error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`🌐 Express server running on port ${PORT}`);
    console.log(`📍 Webhook endpoint: http://localhost:${PORT}/api/remind`);
});

// Login to Discord
console.log('🔄 Attempting to login to Discord...');
console.log(`🔑 Token exists: ${!!process.env.DISCORD_BOT_TOKEN}`);
console.log(`🔑 Token length: ${process.env.DISCORD_BOT_TOKEN ? process.env.DISCORD_BOT_TOKEN.length : 0}`);

client.login(process.env.DISCORD_BOT_TOKEN)
    .then(() => {
        console.log('✅ Discord login successful!');
    })
    .catch((error) => {
        console.error('❌ Failed to login to Discord:');
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Full error:', JSON.stringify(error));
    });

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    client.destroy();
    process.exit(0);
});
