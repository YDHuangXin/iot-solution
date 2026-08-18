/**
 * AI智能物联网方案生成器 - 后端服务 v2.0 (PostgreSQL 版)
 * 适用于 Render 等云平台，数据永久持久化
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'iot-generator-secret-2024';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// PostgreSQL 连接池（Render 内置数据库）
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 文件上传配置
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ========== 数据库初始化 ==========
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(20) PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS knowledge_files (
                id VARCHAR(20) PRIMARY KEY,
                user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE,
                original_name VARCHAR(255),
                stored_name VARCHAR(255),
                file_type VARCHAR(10),
                file_size BIGINT,
                content TEXT,
                tags JSONB,
                summary TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS solutions (
                id VARCHAR(20) PRIMARY KEY,
                user_id VARCHAR(20) REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255),
                scene VARCHAR(50),
                budget INTEGER,
                device_count INTEGER,
                communication VARCHAR(50),
                cloud_platform VARCHAR(50),
                description TEXT,
                content JSONB,
                kb_file_ids JSONB,
                version INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_kb_user ON knowledge_files(user_id);
            CREATE INDEX IF NOT EXISTS idx_sol_user ON solutions(user_id);
        `);
        console.log('✅ 数据库初始化完成');
    } catch (e) {
        console.error('❌ 数据库初始化失败:', e.message);
    }
}

// ========== 认证中间件 ==========
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未登录' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: '令牌无效' });
    }
}

// ========== 标签提取 ==========
function extractTags(content, fileName) {
    const allTags = [];
    const text = (content + ' ' + fileName).toLowerCase();
    const sceneKeywords = {
        '工业': ['工厂', '产线', '车间', '制造', '工业'],
        '农业': ['农业', '种植', '灌溉', '温室', '大棚', '土壤'],
        '家居': ['家居', '家庭', '住宅'],
        '安防': ['安防', '监控', '摄像头', '门禁', '消防'],
        '城市': ['城市', '市政', '路灯', '井盖', '交通'],
        '物流': ['物流', '仓储', '运输', '配送', '冷链']
    };
    for (const [s, kws] of Object.entries(sceneKeywords)) {
        for (const kw of kws) { if (text.includes(kw)) { allTags.push(s); break; } }
    }
    ['传感器','网关','MQTT','NB-IoT','LoRa','5G','边缘计算','AI','大数据','云平台','自动化','预警'].forEach(kw => {
        if (text.includes(kw.toLowerCase())) allTags.push(kw);
    });
    return [...new Set(allTags)].slice(0, 8);
}

// ========== 用户认证 API ==========

// 注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ error: '请填写完整信息' });
        if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

        const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existing.rows.length > 0) return res.status(409).json({ error: '用户名或邮箱已存在' });

        const hash = await bcrypt.hash(password, 10);
        const id = Date.now().toString();
        await pool.query(
            'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
            [id, username, email, hash]
        );

        const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id, username, email } });
    } catch (e) {
        console.error('Register error:', e);
        res.status(500).json({ error: '注册失败' });
    }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: '用户名或密码错误' });

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: '用户名或密码错误' });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取用户信息
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '用户不存在' });
        res.json(result.rows[0]);
    } catch {
        res.status(500).json({ error: '查询失败' });
    }
});

// ========== 资料库 API ==========

// 上传资料
app.post('/api/knowledge/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '未选择文件' });
        const { originalname, filename: storedName, size } = req.file;
        const ext = path.extname(originalname).toLowerCase().slice(1);
        const validTypes = ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'csv', 'json', 'md'];
        if (!validTypes.includes(ext)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: '不支持的文件格式' });
        }

        let content = '';
        const filePath = req.file.path;
        try {
            if (ext === 'json') { content = fs.readFileSync(filePath, 'utf8'); JSON.parse(content); }
            else if (['txt', 'md', 'csv'].includes(ext)) content = fs.readFileSync(filePath, 'utf8');
            else content = `[${ext.toUpperCase()}] ${originalname}`;
        } catch { content = `[文件] ${originalname}`; }

        const tags = extractTags(content, originalname);
        const id = Date.now().toString();
        await pool.query(
            `INSERT INTO knowledge_files (id, user_id, original_name, stored_name, file_type, file_size, content, tags, summary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, req.user.id, originalname, storedName, ext, size, content.substring(0, 50000), JSON.stringify(tags), content.substring(0, 500)]
        );

        res.json({ id, name: originalname, size, type: ext, tags });
    } catch (e) {
        console.error('Upload error:', e);
        res.status(500).json({ error: '上传失败' });
    }
});

// 查询资料库
app.get('/api/knowledge', authMiddleware, async (req, res) => {
    try {
        const { search, tag, page = 1, pageSize = 20 } = req.query;
        let sql = `SELECT id, original_name as name, file_type as type, file_size as size, tags, summary, created_at
                   FROM knowledge_files WHERE user_id = $1`;
        const params = [req.user.id];
        let paramCount = 1;

        if (search) {
            paramCount++;
            sql += ` AND (original_name ILIKE $${paramCount} OR content ILIKE $${paramCount} OR tags::text ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }
        if (tag) {
            paramCount++;
            sql += ` AND tags @> $${paramCount}::jsonb`;
            params.push(JSON.stringify([tag]));
        }

        sql += ' ORDER BY created_at DESC';

        // 获取总数
        const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
        const countResult = await pool.query(countSql, params);
        const total = parseInt(countResult.rows[0].total);

        // 分页
        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(parseInt(pageSize));
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push((parseInt(page) - 1) * parseInt(pageSize));

        const result = await pool.query(sql, params);
        const files = result.rows.map(f => ({
            ...f,
            tags: typeof f.tags === 'string' ? JSON.parse(f.tags) : f.tags || []
        }));

        res.json({ files, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (e) {
        console.error('Query error:', e);
        res.status(500).json({ error: '查询失败' });
    }
});

// 获取所有标签
app.get('/api/knowledge/tags', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT tags FROM knowledge_files WHERE user_id = $1', [req.user.id]);
        const tagSet = new Set();
        result.rows.forEach(row => {
            const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
            if (tags) tags.forEach(t => tagSet.add(t));
        });
        res.json({ tags: [...tagSet] });
    } catch {
        res.status(500).json({ error: '查询失败' });
    }
});

// 删除资料
app.delete('/api/knowledge/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT stored_name FROM knowledge_files WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '文件不存在' });

        const file = result.rows[0];
        try {
            const fp = path.join(UPLOAD_DIR, file.stored_name);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        } catch {}

        await pool.query('DELETE FROM knowledge_files WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: '删除失败' });
    }
});

// ========== 方案管理 API ==========

// 保存方案
app.post('/api/solutions', authMiddleware, async (req, res) => {
    try {
        const { title, scene, budget, device_count, communication, cloud_platform, description, content, kb_file_ids, version } = req.body;
        const id = Date.now().toString();
        await pool.query(
            `INSERT INTO solutions (id, user_id, title, scene, budget, device_count, communication, cloud_platform, description, content, kb_file_ids, version)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [id, req.user.id, title, scene, budget, device_count, communication, cloud_platform, description, JSON.stringify(content), JSON.stringify(kb_file_ids || []), version || 1]
        );
        res.json({ id, success: true });
    } catch (e) {
        console.error('Save error:', e);
        res.status(500).json({ error: '保存失败' });
    }
});

// 获取方案列表
app.get('/api/solutions', authMiddleware, async (req, res) => {
    try {
        const { scene, page = 1, pageSize = 20 } = req.query;
        let sql = `SELECT id, title, scene, budget, device_count, communication, cloud_platform, kb_file_ids, version, created_at, updated_at
                   FROM solutions WHERE user_id = $1`;
        const params = [req.user.id];
        let paramCount = 1;

        if (scene) {
            paramCount++;
            sql += ` AND scene = $${paramCount}`;
            params.push(scene);
        }

        sql += ' ORDER BY created_at DESC';

        const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
        const countResult = await pool.query(countSql, params);
        const total = parseInt(countResult.rows[0].total);

        paramCount++;
        sql += ` LIMIT $${paramCount}`;
        params.push(parseInt(pageSize));
        paramCount++;
        sql += ` OFFSET $${paramCount}`;
        params.push((parseInt(page) - 1) * parseInt(pageSize));

        const result = await pool.query(sql, params);
        const solutions = result.rows.map(s => ({
            ...s,
            kb_file_ids: typeof s.kb_file_ids === 'string' ? JSON.parse(s.kb_file_ids) : s.kb_file_ids || []
        }));

        res.json({ solutions, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (e) {
        console.error('Query error:', e);
        res.status(500).json({ error: '查询失败' });
    }
});

// 获取方案详情
app.get('/api/solutions/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM solutions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '方案不存在' });
        const sol = result.rows[0];
        sol.content = typeof sol.content === 'string' ? JSON.parse(sol.content) : sol.content;
        sol.kb_file_ids = typeof sol.kb_file_ids === 'string' ? JSON.parse(sol.kb_file_ids) : sol.kb_file_ids || [];
        res.json(sol);
    } catch {
        res.status(500).json({ error: '查询失败' });
    }
});

// 删除方案
app.delete('/api/solutions/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM solutions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: '删除失败' });
    }
});

// ========== 启动 ==========
app.listen(PORT, '0.0.0.0', async () => {
    await initDB();
    console.log(`🚀 IoT方案生成器服务已启动: http://0.0.0.0:${PORT}`);
});
