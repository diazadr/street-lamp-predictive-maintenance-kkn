FROM node:20-alpine

# Install dependencies only when needed
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# NEXT_PUBLIC_* ditanam saat build, jadi harus tersedia sebagai build arg
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Build Next.js application
RUN npm run build

# Start production server
EXPOSE 3000
CMD ["npm", "start"]
