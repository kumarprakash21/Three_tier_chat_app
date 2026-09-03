# Install dependencies in a separate stage so npm cache and build leftovers
# are not included in the final image.
FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS production

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

# .dockerignore keeps local dependencies, uploads, and secrets out.
COPY . .

ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
