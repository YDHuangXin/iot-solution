FROM node:20-alpine
# Force rebuild: 20260820153757
# Force rebuild: 20260820115442
# Force rebuild: 20260820115417
# Force rebuild: 20260820115400

WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm install --production

# 复制所有源代码（包括 public/ 目录）
COPY . .

EXPOSE 10000

CMD ["node", "server.js"]
