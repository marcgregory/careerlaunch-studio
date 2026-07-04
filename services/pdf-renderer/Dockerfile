FROM node:20-slim

# Install Chromium system dependencies
RUN apt-get update && apt-get install -y \
  chromium \
  chromium-sandbox \
  libnss3 \
  libnspr4 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libdbus-1-3 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY src/ src/

# Playwright can discover the system-installed chromium via CHROMIUM_PATH
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "src/server.js"]
