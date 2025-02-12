// Import dependencies
const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer');
require('dotenv').config();

// Get bot token from environment variables 
const BOT_TOKEN = process.env.NEXT_PUBLIC_BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error('NEXT_PUBLIC_BOT_TOKEN is not set in .env file');
    process.exit(1);
}

// Initialize bot and active chat IDs
const bot = new Telegraf(BOT_TOKEN);
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
let activeChatIds = new Set();


// Shared formatting function - Define this BEFORE using it
function formatAuctionMessage(rawData, type = 'Instant') {
    try {
        console.log('Raw data received:', rawData); // Debug log

        // Check if rawData has the expected structure from scrapeHypurrScan
        if (rawData.nextAuctionText && rawData.auctionElements) {
            // Parse next auction time and starting price from nextAuctionText
            const timeMatch = rawData.nextAuctionText.match(/Next auction starts in (.*?)(?=Starting price)/i);
            const priceMatch = rawData.nextAuctionText.match(/Starting price\s*:\s*(\S+)/i);

            // Format auctions list
            const auctionsFormatted = rawData.auctionElements
                .map(auction => `${auction.name} for ${auction.price}`)
                .join('\n');

            return `
🌟 ${type} Auction Update 🌟
━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ Next Auction Time:
${timeMatch ? timeMatch[1].trim() : 'Loading...'}

💰 Starting Price:
${priceMatch ? priceMatch[1].trim() : 'Loading...'}

🏆 Recent Auctions:
${auctionsFormatted || 'No recent auctions available'}

📊 Market Analysis:
Average Price: ${calculateAverage(rawData.auctionElements)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱ Updated: ${new Date().toLocaleString()}
🌐 Source: hypurrscan.io/dashboard

Commands:
📊 /price - Get instant update
⛔ /stop  - Stop notifications`;
        } else {
            console.error('Unexpected data structure:', rawData);
            return 'Error: Unable to format auction data';
        }
    } catch (error) {
        console.error('Error formatting message:', error);
        console.error('Problematic raw data:', rawData);
        return 'Error: Failed to process auction data';
    }
}

// Update the scrapeHypurrScan function to ensure it returns the correct data structure
async function scrapeHypurrScan(retries = 3) {
    let browser = null;
    
    try {
        console.log('Starting scraping attempt...');
        
        browser = await puppeteer.launch({ 
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        
        // Set various timeouts
        await page.setDefaultNavigationTimeout(120000); // 2 minutes
        await page.setDefaultTimeout(120000);

        // Optimize page load
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            // Block unnecessary resources
            const resourceType = request.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                request.abort();
            } else {
                request.continue();
            }
        });

        console.log('Navigating to page...');
        const response = await page.goto('https://hypurrscan.io/dashboard', {
            waitUntil: ['domcontentloaded', 'networkidle2'],
            timeout: 120000
        });

        if (!response.ok()) {
            throw new Error(`Page response was not ok: ${response.status()}`);
        }

        console.log('Waiting for selector...');
        await page.waitForSelector('.v-card-text', { 
            timeout: 60000,
            visible: true 
        });

        console.log('Extracting data...');
        const data = await page.evaluate(() => {
            // Debug logging
            console.log('Starting data extraction');

            // Get all text content from the auction card
            const auctionCard = Array.from(document.querySelectorAll('.v-card-text'))
                .find(card => card.textContent.includes('Next auction'));

            if (!auctionCard) {
                console.log('Auction card not found');
                return null;
            }

            console.log('Found auction card:', auctionCard.textContent);

            // Extract auction information
            const auctionInfo = auctionCard.querySelector('p:first-child');
            const nextAuctionText = auctionInfo ? auctionInfo.textContent : '';
            console.log('Next auction text:', nextAuctionText);

            // Extract last auctions
            const auctionElements = Array.from(auctionCard.querySelectorAll('p'))
                .filter(p => p.textContent.includes('for'))
                .map(p => {
                    const text = p.textContent;
                    console.log('Auction element text:', text);
                    const [name, price] = text.split(' for ');
                    return {
                        name: name.trim(),
                        price: price ? price.trim() : ''
                    };
                });

            console.log('Extracted auctions:', auctionElements);

            return {
                nextAuctionText,
                auctionElements
            };
        });

        if (!data) {
            throw new Error('No data extracted from page');
        }

        await browser.close();
        browser = null;
        
        console.log('Scraping completed successfully');
        return data;

    } catch (error) {
        console.error(`Scraping attempt failed: ${error.message}`);
        
        if (browser) {
            await browser.close();
            browser = null;
        }

        if (retries > 0) {
            console.log(`Retrying... ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retry
            return scrapeHypurrScan(retries - 1);
        }

        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Helper function to calculate average price
function calculateAverage(auctions) {
    if (!auctions || auctions.length === 0) return 'Calculating...';
    
    const prices = auctions.map(auction => {
        if (!auction.price) return null;
        const priceStr = auction.price.replace(/[^0-9.]/g, '');
        return parseFloat(priceStr);
    }).filter(price => price && !isNaN(price));
    
    if (prices.length === 0) return 'Calculating...';
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return `$${avg.toFixed(2)}`;
}




// Bot commands
bot.command('start', (ctx) => {
    const chatId = ctx.chat.id;
    activeChatIds.add(chatId);
    ctx.reply(`Bot is running! Monitoring HypurrScan...\nYour Chat ID is: ${chatId}`);
    console.log(`New chat started. Chat ID: ${chatId}`);
});

bot.command('stop', (ctx) => {
    const chatId = ctx.chat.id;
    activeChatIds.delete(chatId);
    ctx.reply('Stopped monitoring for this chat.');
    console.log(`Chat ${chatId} stopped monitoring`);
});

bot.command('getchatid', (ctx) => {
    const chatId = ctx.chat.id;
    ctx.reply(`Your Chat ID is: ${chatId}`);
    console.log(`Chat ID requested: ${chatId}`);
});

bot.command('price', async (ctx) => {
    try {
        const rawData = await scrapeHypurrScan();
        if (rawData) {
            const formattedMessage = formatAuctionMessage(rawData, 'Instant');
            await ctx.reply(formattedMessage, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
            });
        } else {
            await ctx.reply('⚠️ Unable to fetch data at the moment');
        }
    } catch (error) {
        console.error('Price command error:', error);
        await ctx.reply('⚠️ Error processing request');
    }
});

async function updatePrice() {
    const currentTime = new Date().toLocaleString();
    console.log(`Running price update at ${currentTime}`);

    if (activeChatIds.size === 0) {
        console.log('No active chats to notify for price update');
        return;
    }

    try {
        console.log('Fetching new data...');
        const rawData = await scrapeHypurrScan();

        if (rawData) {
            console.log('Data fetched successfully, formatting message...');
            const formattedMessage = formatAuctionMessage(rawData, 'Update');

            console.log(`Sending updates to ${activeChatIds.size} active chats...`);
            for (const chatId of activeChatIds) {
                try {
                    await bot.telegram.sendMessage(chatId, formattedMessage, { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: true 
                    });
                    console.log(`Update sent successfully to chat ${chatId}`);
                } catch (error) {
                    console.error(`Failed to send price update to chat ${chatId}:`, error.message);
                    if (error.message.includes('chat not found')) {
                        activeChatIds.delete(chatId);
                        console.log(`Removed invalid chat ID: ${chatId}`);
                    }
                }
            }
            console.log('Update cycle completed successfully');
            console.log('Scraped data:', rawData); // Log the scraped data
        } else {
            console.error('Failed to fetch data');
        }
    } catch (error) {
        console.error('Update price error:', error);
    }
}

// Add a command to check next update time
bot.command('nextupdatetime', (ctx) => {
    const nextUpdate = new Date(Math.ceil(Date.now() / ONE_HOUR) * ONE_HOUR);
    ctx.reply(`Next update scheduled for: ${nextUpdate.toLocaleString()}`);
});

// Add a command to force an immediate update
bot.command('forceupdate', async (ctx) => {
    ctx.reply('Forcing immediate update...');
    await updatePrice();
    ctx.reply('Update completed!');
});

// Single bot launch with all initialization
bot.launch()
    .then(() => {
        console.log('Bot started successfully');
        console.log('Setting up automatic updates...');
        setupAutomaticUpdates();
        console.log('Send /start to the bot to begin monitoring');
        // Initial update
        updatePrice().catch(error => console.error('Initial update failed:', error));
    })
    .catch((err) => console.error('Bot failed to start:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));