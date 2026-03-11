# Backend Dockerfile
CMD ["node", "server.js"]
EXPOSE 4000
COPY . .
RUN npm install --production
COPY package.json package-lock.json ./
WORKDIR /app
FROM node:18-alpine

