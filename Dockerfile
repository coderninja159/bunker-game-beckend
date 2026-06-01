# ==========================================
# STAGE 1: BUILDER
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency catalogs
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies including devDependencies for tsc compilation
RUN npm ci

# Copy full source trees
COPY src ./src

# Build production compiled JavaScript
RUN npm run build

# ==========================================
# STAGE 2: PRODUCTION RUNNER
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Set production execution flags
ENV NODE_ENV=production

# Copy catalogs and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled build code from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Run as non-privileged system user for absolute container containment security
USER node

# Expose standard game socket engine port
EXPOSE 4000

# Start command
CMD ["npm", "start"]
