FROM node:20-alpine
# Force rebuild: 20260821_095408
# Force rebuild: 20260821_095408
# Force rebuild: 20260821_095408
# Force rebuild: 20260821_095408
# Force rebuild: 20260821_095408

WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm install --production

# 复制所有源代码（包括 public/ 目录）
COPY . .

EXPOSE 10000

CMD ["node", "server.js"]
