# AI智能物联网方案生成器 v2.0 — Render 部署操作指南

> 本文档详细说明如何将项目部署到 Render 云平台，并使用其内置免费 PostgreSQL 数据库实现数据永久持久化。

---

## 一、部署前准备

### 1. 注册 Render 账号

1. 打开浏览器访问 **https://render.com**
2. 点击 **"Get Started for Free"**
3. 推荐使用 **GitHub 账号登录**（一键授权，无需额外注册）
4. 如没有 GitHub 账号，可用邮箱注册

### 2. 将代码推送到 GitHub

#### ① 创建 GitHub 仓库

1. 登录 GitHub → 点击页面右上角 **"+"** → **"New repository"**
2. 填写仓库名：`iot-solution-generator`
3. 选择 **Public** 或 **Private**（均可）
4. **不要勾选** "Initialize with README"（我们已有代码）
5. 点击 **"Create repository"**

#### ② 推送代码（在本地电脑终端操作）

打开 **Git Bash** 或 **PowerShell**，进入项目文件夹后执行：

```bash
# 进入项目目录
cd 你的项目路径\iot-solution-generator

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: IoT solution generator v2.0 with PostgreSQL"

# 关联远程仓库（替换 <你的GitHub用户名>）
git remote add origin https://github.com/<你的GitHub用户名>/iot-solution-generator.git

# 推送到 GitHub
git push -u origin main
```

> 💡 如果默认分支是 `master` 而非 `main`，最后一行改为 `git push -u origin master`

---

## 二、在 Render 创建服务

### 1. 创建 Web Service

1. 登录 Render 控制台：**https://dashboard.render.com**
2. 点击 **"New +"** → 选择 **"Web Service"**
3. 选择 **"Connect a Git repository"**
4. 在列表中点击 **"Configure account"** 授权 Render 访问你的 GitHub 仓库
5. 找到并选择 **`iot-solution-generator`** 仓库

### 2. 配置服务参数

在创建页面填写以下信息：

| 参数 | 填写值 |
|------|--------|
| **Name** | `iot-solution-generator`（可自定义） |
| **Region** | `Singapore`（推荐，离国内最近）或 `Oregon` |
| **Branch** | `main`（或 `master`） |
| **Root Directory** | 留空（不填） |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |

### 3. 选择免费套餐

- 滚动到 **"Instance Type"**
- 选择 **"Free"** 套餐
  - ✅ 免费，无需信用卡
  - ⚠️ 15分钟无请求会进入休眠（首次访问需等待约30秒唤醒）

---

## 三、配置 PostgreSQL 数据库

### 1. 创建数据库

在同一个服务创建页面，向下滚动找到 **"Add a PostgreSQL"** 区域：

1. 点击 **"Add Database"**
2. 填写信息：
   - **Name**: `iot-db`（与 `render.yaml` 中的名称一致）
   - **Database Name**: `iot_solution_db`
   - **Plan**: `Free`
   - **Region**: 与 Web Service 选择同一个区域

3. 点击 **"Add Database"**

### 2. 环境变量自动注入

Render 会自动完成以下操作：
- ✅ 生成 `DATABASE_URL` 环境变量（PostgreSQL 连接字符串）
- ✅ 生成 `JWT_SECRET` 环境变量（JWT 密钥）
- ✅ 这些变量会自动注入到你的服务中，**无需手动填写**

---

## 四、启动部署

### 1. 点击创建

配置完成后，点击页面底部的 **"Create Web Service"**

### 2. 观察部署进度

部署过程中会显示实时日志：

```
==> Deploying...
==> Running build command: npm install
==> Installing dependencies...
==> Build successful
==> Starting service with: node server.js
==> Service running on port 10000
```

### 3. 数据库初始化

服务启动时，`server.js` 中的 `initDB()` 函数会自动执行：

```
✅ 数据库连接成功
✅ 创建 users 表
✅ 创建 knowledge_files 表
✅ 创建 solutions 表
✅ 数据库初始化完成
```

如果日志显示这些内容，说明一切正常。

---

## 五、验证部署

### 1. 访问应用

部署完成后，Render 会分配一个访问地址，格式为：

```
https://iot-solution-generator-xxxx.onrender.com
```

在浏览器中打开该地址，你应该能看到登录/注册页面。

### 2. 功能测试清单

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 注册 | 填写用户名、邮箱、密码，点击注册 | 注册成功，进入主界面 |
| 登录 | 使用注册的账号登录 | 登录成功，显示用户名 |
| 上传资料 | 在"资料库"页面上传文件 | 上传成功，列表中显示 |
| 生成方案 | 配置需求，点击"AI智能生成方案" | 方案生成完成，展示结果 |
| 查看历史 | 切换到"历史方案"页 | 显示已生成的方案 |
| 重新访问 | 关闭浏览器重新打开，再次登录 | 所有数据完整保留 ✅ |

---

## 六、关键注意事项

### ✅ 数据持久化

| 特性 | 说明 |
|------|------|
| **代码重新部署** | 用户数据不会丢失 |
| **服务休眠唤醒** | 数据库数据永久保留 |
| **自动备份** | Render 免费计划提供7天自动备份 |

### ⚠️ 免费计划限制

| 限制 | 说明 | 应对方案 |
|------|------|----------|
| **15分钟休眠** | 无请求15分钟后服务休眠 | 首次访问需等待约30秒唤醒 |
| **750小时/月** | 每月免费时长750小时 | 单人使用完全够用 |
| **数据库90天** | 免费数据库90天后需确认续期 | 收到邮件时点击确认即可 |
| **带宽100GB/月** | 每月100GB出站流量 | 正常使用不会超限 |

### 🔧 后续更新代码

修改代码后推送更新：

```bash
# 修改代码后
git add .
git commit -m "更新说明"
git push
```

Render 会**自动检测推送**并重新部署，无需手动操作。

---

## 七、故障排查

### 问题 1：部署失败 — "Build failed"

**原因**：依赖安装失败或 Node 版本不兼容

**解决**：
1. 查看部署日志中的错误信息
2. 确认 `package.json` 中 `"engines": { "node": ">=18.0.0" }`
3. 确认 `package-lock.json` 已提交到 Git

### 问题 2：启动失败 — "Error: connect ECONNREFUSED"

**原因**：数据库未正确连接

**解决**：
1. 进入 Render 控制台 → 你的服务 → **Environment** 标签
2. 确认 `DATABASE_URL` 已自动填充（非空）
3. 确认 `JWT_SECRET` 已自动填充
4. 如缺失，手动添加：
   - Key: `DATABASE_URL` → Value: 从 Render 数据库页面复制连接字符串
   - Key: `JWT_SECRET` → Value: 任意随机字符串（如 `my-secret-key-12345`）

### 问题 3：访问地址返回 502

**原因**：服务未正确监听端口

**解决**：
1. 确认 `server.js` 中 `process.env.PORT` 使用正确
2. 确认 `render.yaml` 中 `PORT` 环境变量设为 `10000`
3. 查看日志确认服务已启动

### 问题 4：数据库表不存在

**原因**：`initDB()` 未成功执行

**解决**：
1. 查看服务启动日志
2. 确认有 `✅ 数据库初始化完成` 字样
3. 如失败，可在服务页面点击 **"Manual Deploy"** 重新部署

---

## 八、从休眠状态恢复（可选）

如果你希望服务保持唤醒（不进入休眠），可升级到付费计划：

| 计划 | 价格 | 特点 |
|------|------|------|
| **Starter** | $7/月 | 不休眠，自定义域名 |
| **Standard** | $25/月 | 更高配置，自动扩缩容 |

> 💡 个人使用免费计划即可，休眠唤醒仅需等待约30秒。

---

## 九、完整操作流程图

```
1. 注册 Render 账号 (render.com)
         ↓
2. 将代码推送到 GitHub
         ↓
3. 在 Render 创建 Web Service → 关联 GitHub 仓库
         ↓
4. 填写服务参数（Node/Free/新加坡）
         ↓
5. 添加 PostgreSQL 数据库（Free/同名区域）
         ↓
6. 点击 "Create Web Service"
         ↓
7. 等待部署完成（约2-5分钟）
         ↓
8. 访问 https://xxx.onrender.com
         ↓
9. 注册账号 → 上传资料 → 生成方案 ✅
```

---

## 十、项目文件清单

部署时需要提交到 GitHub 的完整文件：

| 文件 | 说明 |
|------|------|
| `package.json` | 项目配置与依赖 |
| `package-lock.json` | 依赖版本锁定 |
| `server.js` | 后端服务（含 PostgreSQL 连接与数据库初始化） |
| `public/index.html` | 前端界面（含登录/注册/资料库/历史方案） |
| `render.yaml` | Render 部署配置（Web服务 + 数据库） |
| `.gitignore` | Git 忽略规则 |

---

*文档生成时间：2026-08-17*
*AI智能物联网方案生成器 v2.0*
