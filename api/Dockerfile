FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

# Scan images live on a named volume so records survive container rebuilds.
RUN mkdir -p /app/uploads
ENV UPLOAD_DIR=/app/uploads

EXPOSE 5000
CMD ["node", "src/server.js"]
