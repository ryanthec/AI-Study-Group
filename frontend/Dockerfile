FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install OS tools you might need in dev (optional, remove if not needed)
RUN apk add --no-cache bash

# Copy only package manifests first to leverage caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of your source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Environment for Vite
ENV HOST=0.0.0.0
ENV PORT=5173

# Default command to run the Vite dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]


# ======= How to use ========

# Build:
# docker build -t ai-study-group-frontend-dev .

# Run with live reload (mount local code):
# docker run --rm -it -p 5173:5173 -v "$(pwd)":/app -v /app/node_modules ai-study-group-frontend-dev

# On Windows PowerShell:
# docker run --rm -it -p 5173:5173 -v ${PWD}:/app -v /app/node_modules ai-study-group-frontend-dev

# Visit:
# http://localhost:5173