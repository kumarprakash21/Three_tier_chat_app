FROM node:20-alpine

WORKDIR /app

# Install only production dependencies and keep the image small.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY middleware ./middleware
COPY models ./models
COPY public ./public

# Uploaded files are runtime data and should be mounted as a volume.
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
