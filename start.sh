#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting HypurrScan Bot...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Check if required files exist
if [ ! -f "hypur.js" ]; then
    echo -e "${RED}Error: hypur.js not found${NC}"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo -e "${YELLOW}Creating .env file...${NC}"
    echo "NEXT_PUBLIC_BOT_TOKEN=your_bot_token_here" > .env
    echo -e "${YELLOW}Please edit .env file with your bot token${NC}"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install telegraf puppeteer dotenv
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing PM2...${NC}"
    npm install -g pm2
fi

# Stop any existing instance
echo -e "${YELLOW}Stopping any existing bot instance...${NC}"
pm2 stop hypurbot 2>/dev/null || true
pm2 delete hypurbot 2>/dev/null || true

# Start the bot with PM2
echo -e "${GREEN}Starting bot with PM2...${NC}"
pm2 start hypur.js --name hypurbot

# Save PM2 configuration
echo -e "${GREEN}Saving PM2 configuration...${NC}"
pm2 save

# Display status
echo -e "${GREEN}Bot status:${NC}"
pm2 status hypurbot

# Display logs
echo -e "${GREEN}Recent logs:${NC}"
pm2 logs hypurbot --lines 10

echo -e "\n${GREEN}Bot has been started successfully!${NC}"
echo -e "${YELLOW}Use the following commands to manage the bot:${NC}"
echo -e "  ${GREEN}pm2 status hypurbot${NC} - Check bot status"
echo -e "  ${GREEN}pm2 logs hypurbot${NC} - View logs"
echo -e "  ${GREEN}pm2 stop hypurbot${NC} - Stop the bot"
echo -e "  ${GREEN}pm2 restart hypurbot${NC} - Restart the bot"
echo -e "  ${GREEN}pm2 monit${NC} - Monitor bot resources"

exit 0