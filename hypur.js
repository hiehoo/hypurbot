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
🌐 Source: hypurrscan.io

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
async function scrapeHypurrScan() {
    try {
        const browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setDefaultNavigationTimeout(60000);
        
        await page.goto('https://hypurrscan.io/dashboard', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        await page.waitForSelector('.v-card-text', { timeout: 30000 });

        const data = await page.evaluate(() => {
            const auctionCard = Array.from(document.querySelectorAll('.v-card-text'))
                .find(card => card.textContent.includes('Next auction'));

            if (!auctionCard) return null;

            // Get the next auction text (contains time and starting price)
            const nextAuctionText = auctionCard.querySelector('p:first-child')?.textContent || '';

            // Get the auction elements (recent auctions)
            const auctionElements = Array.from(auctionCard.querySelectorAll('p'))
                .filter(p => p.textContent.includes('for'))
                .map(p => {
                    const text = p.textContent;
                    const [name, price] = text.split(' for ');
                    return {
                        name: name.trim(),
                        price: price ? price.trim() : ''
                    };
                });

            return {
                nextAuctionText,
                auctionElements
            };
        });

        await browser.close();

        if (!data) {
            throw new Error('Failed to extract auction data');
        }

        console.log('Scraped data:', data); // Debug log
        return data;

    } catch (error) {
        console.error('Scraping error:', error);
        return null;
    }
}


// Function to scrape data
// async function scrapeHypurrScan() {
//     try {
//         const browser = await puppeteer.launch({ 
//             headless: "new",
//             args: ['--no-sandbox', '--disable-setuid-sandbox']
//         });
//         const page = await browser.newPage();

//         // Enable console logging from the page
//         page.on('console', msg => console.log('PAGE LOG:', msg.text()));

//         await page.setDefaultNavigationTimeout(60000);
        
//         await page.goto('https://hypurrscan.io/dashboard', {
//             waitUntil: 'networkidle0',
//             timeout: 60000
//         });

//         // Wait for the specific card with auction information
//         await page.waitForSelector('.v-card-text', { timeout: 30000 });

//         // Extract all the data
//         const data = await page.evaluate(() => {
//             // Debug logging
//             console.log('Starting data extraction');

//             // Get all text content from the auction card
//             const auctionCard = Array.from(document.querySelectorAll('.v-card-text'))
//                 .find(card => card.textContent.includes('Next auction'));

//             if (!auctionCard) {
//                 console.log('Auction card not found');
//                 return null;
//             }

//             console.log('Found auction card:', auctionCard.textContent);

//             // Extract auction information
//             const auctionInfo = auctionCard.querySelector('p:first-child');
//             const nextAuctionText = auctionInfo ? auctionInfo.textContent : '';
//             console.log('Next auction text:', nextAuctionText);

//             // Extract last auctions
//             const auctionElements = Array.from(auctionCard.querySelectorAll('p'))
//                 .filter(p => p.textContent.includes('for'))
//                 .map(p => {
//                     const text = p.textContent;
//                     console.log('Auction element text:', text);
//                     const [name, price] = text.split(' for ');
//                     return {
//                         name: name.trim(),
//                         price: price ? price.trim() : ''
//                     };
//                 });

//             console.log('Extracted auctions:', auctionElements);

//             return {
//                 nextAuctionText,
//                 auctionElements
//             };
//         });

//         await browser.close();

//         if (!data) {
//             throw new Error('Failed to extract auction data');
//         }

//         console.log('Raw scraped data:', data);

//         // Parse next auction time and starting price
//         const timeMatch = data.nextAuctionText.match(/Next auction starts in (.*?)(?=Starting price)/i);
//         const priceMatch = data.nextAuctionText.match(/Starting price\s*:\s*(\S+)/i);

//         console.log('Parsed matches:', { timeMatch, priceMatch });

//         // Format the message
//         const formattedMessage = `
// 🌟 Auction Update 🌟
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ⏰ Next Auction Time:
// ${timeMatch ? timeMatch[1].trim() : 'Loading...'}

// 💰 Starting Price:
// ${priceMatch ? priceMatch[1].trim() : 'Loading...'}

// 🏆 Recent Auctions:
// ${data.auctionElements.length > 0 
//     ? data.auctionElements.map(auction => `${auction.name} for ${auction.price}`).join('\n')
//     : 'Loading recent auctions...'}

// 📊 Market Analysis:
// Average Price: ${calculateAverage(data.auctionElements)}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⏱ Updated: ${new Date().toLocaleString()}
// 🌐 Source: hypurrscan.io

// Commands:
// 📊 /price - Get instant update
// ⛔ /stop  - Stop notifications`;

//         console.log('Formatted message:', formattedMessage);
//         return formattedMessage;

//     } catch (error) {
//         console.error('Detailed scraping error:', error);
//         return `⚠️ Error fetching auction data: ${error.message}\nPlease try again in a few moments.`;
//     }
// }

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

// Update function
async function updatePrice() {
    if (activeChatIds.size === 0) {
        console.log('No active chats to notify for price update');
        return;
    }

    try {
        const rawData = await scrapeHypurrScan();
        if (rawData) {
            const formattedMessage = formatAuctionMessage(rawData, 'Hourly');

            for (const chatId of activeChatIds) {
                try {
                    await bot.telegram.sendMessage(chatId, formattedMessage, { 
                        parse_mode: 'HTML',
                        disable_web_page_preview: true 
                    });
                } catch (error) {
                    console.error(`Failed to send price update to chat ${chatId}:`, error.message);
                    if (error.message.includes('chat not found')) {
                        activeChatIds.delete(chatId);
                        console.log(`Removed invalid chat ID: ${chatId}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Update price error:', error);
    }
}

// Start hourly updates
const ONE_HOUR = 60 * 60 * 1000;
setInterval(updatePrice, ONE_HOUR);

// Launch bot
bot.launch()
    .then(() => {
        console.log('Bot started');
        console.log('Send /start to the bot to begin monitoring');
        // Initial update
        updatePrice().catch(error => console.error('Initial update failed:', error));
    })
    .catch((err) => console.error('Bot failed to start:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));