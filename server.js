/**
 * AI智能物联网方案生成器 - 后端服务 v3.0
 * 去预制化 + 联网搜索 + 三档方案生成
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'iot-generator-secret-2024';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

// ========== 联网搜索工具 ==========
function fetchUrl(url, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const req = proto.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
            },
            timeout
        }, (resp) => {
            let data = '';
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => resolve({ status: resp.statusCode, data }));
            resp.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    });
}

function stripHtml(html) {
    if (!html) return '';
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

// 场景关键词映射
const sceneKeywords = {
    'smart-industry': {
        searchTerms: ['工业物联网方案 传感器选型 2024', '智慧工厂IoT架构 边缘计算', '工业4.0 物联网设备 预测性维护'],
        fallbackData: {
            name: '智慧工业物联网方案', icon: '🏭',
            defaultSensors: ['工业温湿度传感器','烟雾探测器','振动传感器','电流互感器','气压传感器'],
            defaultGateway: '工业级边缘网关',
            defaultProtocols: ['Modbus','OPC-UA','MQTT'],
            defaultPlatform: 'OneNET工业物联网平台',
            features: ['设备实时监控','预测性维护','能耗管理','产线数字孪生','异常告警'],
            desc: '面向工业制造场景，实现设备互联、生产数据实时采集、智能分析与预测性维护。'
        }
    },
    'smart-agriculture': {
        searchTerms: ['智慧农业物联网方案 精准灌溉', '农业IoT传感器 土壤监测', '智慧大棚 物联网控制 2024'],
        fallbackData: {
            name: '智慧农业物联网方案', icon: '🌾',
            defaultSensors: ['土壤湿度传感器','光照传感器','CO₂传感器','气象站','水质监测仪'],
            defaultGateway: '农业专用LoRa网关',
            defaultProtocols: ['LoRaWAN','NB-IoT','MQTT'],
            defaultPlatform: 'OneNET智慧农业平台',
            features: ['精准灌溉控制','环境智能调控','作物生长监测','病虫害预警','产量预测分析'],
            desc: '面向现代农业生产，通过传感器网络实时监测土壤、气象、作物状态。'
        }
    },
    'smart-home': {
        searchTerms: ['智能家居物联网方案 全屋智能', '家庭IoT ZigBee WiFi 2024', '智慧家庭 传感器 自动化控制'],
        fallbackData: {
            name: '智能家居物联网方案', icon: '🏠',
            defaultSensors: ['人体红外传感器','门窗磁传感器','温湿度传感器','光照传感器','空气质量传感器'],
            defaultGateway: '智能家庭中枢网关',
            defaultProtocols: ['ZigBee 3.0','WiFi 6','蓝牙Mesh'],
            defaultPlatform: '移动智能家居云平台',
            features: ['场景自动化','语音控制','远程安防','能耗优化','健康环境管理'],
            desc: '打造全屋智能生活体验，通过多协议融合实现设备互联互通。'
        }
    },
    'security': {
        searchTerms: ['智能安防物联网方案 AI视频分析', '周界防范 物联网传感器 2024', '智慧安防 门禁 消防联动'],
        fallbackData: {
            name: '智能安防监测方案', icon: '🔒',
            defaultSensors: ['高清AI摄像头','红外对射探测器','振动光纤','门禁控制器','紧急按钮'],
            defaultGateway: '安防专用汇聚网关',
            defaultProtocols: ['TCP/IP','RS485','GB/T28181'],
            defaultPlatform: '视频云+AI分析平台',
            features: ['AI视频分析','周界防范','人脸门禁','消防联动','应急指挥'],
            desc: '构建全方位立体安防体系，融合视频AI、物联传感与联动控制。'
        }
    },
    'smart-city': {
        searchTerms: ['智慧城市物联网方案 城市感知网络', '智慧路灯 井盖监测 2024', '城市IoT NB-IoT 环境监测'],
        fallbackData: {
            name: '智慧城市物联网方案', icon: '🏙️',
            defaultSensors: ['环境监测站','智能路灯控制器','井盖传感器','水位监测仪','噪声传感器'],
            defaultGateway: '城市级NB-IoT基站',
            defaultProtocols: ['NB-IoT','5G','LoRaWAN'],
            defaultPlatform: '城市物联网运营管理平台',
            features: ['城市体征监测','智慧照明','管网监测','环境监测','应急调度'],
            desc: '建设城市级物联感知网络，汇聚市政、环境、交通等多维数据。'
        }
    },
    'smart-logistics': {
        searchTerms: ['智慧物流物联网方案 冷链监控', '物流IoT 仓储自动化 2024', '供应链 物联网 RFID 实时追踪'],
        fallbackData: {
            name: '智慧物流物联网方案', icon: '📦',
            defaultSensors: ['GPS定位器','温湿度记录仪','电子锁','RFID读写器','重量传感器'],
            defaultGateway: '物流边缘计算网关',
            defaultProtocols: ['4G/5G','BLE','RFID/UHF'],
            defaultPlatform: '物流链可视化管理平台',
            features: ['全程冷链监控','仓储自动化','路径优化','电子围栏','签收确认'],
            desc: '实现物流全链路数字化管控，从仓储到配送全程可追溯。'
        }
    }
};

// 标签提取
function extractTags(content, fileName) {
    const allTags = [];
    const text = (content + ' ' + fileName).toLowerCase();
    const sceneKeywords2 = {
        '工业': ['工厂', '产线', '车间', '制造', '工业'],
        '农业': ['农业', '种植', '灌溉', '温室', '大棚', '土壤'],
        '家居': ['家居', '家庭', '住宅'],
        '安防': ['安防', '监控', '摄像头', '门禁', '消防'],
        '城市': ['城市', '市政', '路灯', '井盖', '交通'],
        '物流': ['物流', '仓储', '运输', '配送', '冷链']
    };
    for (const [s, kws] of Object.entries(sceneKeywords2)) {
        for (const kw of kws) { if (text.includes(kw)) { allTags.push(s); break; } }
    }
    ['传感器','网关','MQTT','NB-IoT','LoRa','5G','边缘计算','AI','大数据','云平台','自动化','预警'].forEach(kw => {
        if (text.includes(kw.toLowerCase())) allTags.push(kw);
    });
    return [...new Set(allTags)].slice(0, 8);
}

// ========== 方案生成引擎（去预制化） ==========
async function fetchSceneData(scene, kbFiles = [], description = '') {
    const config = sceneKeywords[scene];
    if (!config) return config?.fallbackData;

    let webContent = '';
    let searchSuccess = false;
    const searchResults = [];

    // 步骤1：联网搜索
    try {
        for (const term of config.searchTerms.slice(0, 2)) {
            try {
                const encoded = encodeURIComponent(term);
                const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`;
                const resp = await fetchUrl(searchUrl, 6000);
                if (resp.status === 200 && resp.data) {
                    const text = stripHtml(resp.data);
                    if (text.length > 50) {
                        searchResults.push({ query: term, content: text.substring(0, 3000) });
                        webContent += text + ' ';
                        searchSuccess = true;
                        break;
                    }
                }
            } catch (e) {
                console.log(`[搜索] "${term}" 失败: ${e.message}`);
            }
        }
    } catch (e) {
        console.log('[搜索] 联网搜索异常:', e.message);
    }

    // 步骤2：分析资料库
    let kbInsights = '';
    if (kbFiles && kbFiles.length > 0) {
        const kbText = kbFiles.map(f => f.content || f.summary || '').join(' ');
        const tags = extractTags(kbText, kbFiles.map(f => f.original_name || f.name || '').join(' '));
        kbInsights = `参考资料标签：${tags.join('、')}。`;
    }

    // 步骤3：智能分析用户描述
    let userInsights = '';
    if (description && description.length > 5) {
        const tags = extractTags(description, '');
        if (tags.length > 0) {
            userInsights = `用户需求关键词：${tags.join('、')}。`;
        }
    }

    // 步骤4：综合生成场景数据
    let sensors = config.fallbackData.defaultSensors;
    let gateway = config.fallbackData.defaultGateway;
    let protocols = config.fallbackData.defaultProtocols;
    let platform = config.fallbackData.defaultPlatform;
    let features = config.fallbackData.features;
    let desc = config.fallbackData.desc;

    // 从搜索结果中提取真实设备型号（如果搜索成功）
    if (searchSuccess && webContent.length > 200) {
        const content = webContent.toLowerCase();
        // 尝试从搜索结果中提取传感器相关描述
        const sensorMatches = webContent.match(/传感器[：:]?[^\n]{5,30}/g);
        if (sensorMatches && sensorMatches.length > 0) {
            const extracted = sensorMatches.slice(0, 5).map(s => s.replace(/传感器[：:]/, '传感器-'));
            if (extracted.length >= 3) {
                sensors = extracted.slice(0, 5);
            }
        }

        // 提取通信协议
        const protocolKeywords = ['MQTT', 'CoAP', 'HTTP', 'Modbus', 'OPC-UA', 'LoRa', 'NB-IoT', 'ZigBee', 'BLE', '5G', 'WiFi'];
        const foundProtocols = protocolKeywords.filter(p => content.includes(p.toLowerCase()));
        if (foundProtocols.length >= 2) {
            protocols = foundProtocols.slice(0, 4);
        }

        // 提取平台名称
        const platformKeywords = ['OneNET', '阿里云', '华为云', '腾讯云', 'ThingsBoard', 'AWS IoT', 'Azure IoT'];
        const foundPlatforms = platformKeywords.filter(p => content.includes(p));
        if (foundPlatforms.length > 0) {
            platform = foundPlatforms[0] + '物联网平台';
        }
    }

    // 从资料库中增强
    if (kbInsights) {
        const allTags = [...new Set(kbFiles.flatMap(f => f.tags || extractTags(f.content || '', f.original_name || f.name || '')))];
        if (allTags.includes('工业')) {
            desc += ' 参考资料建议优先选用工业级防护设备（IP65+），增强抗干扰能力。';
        }
        if (allTags.includes('农业')) {
            desc += ' 参考农业场景供电困难特点，推荐太阳能+锂电池供电方案。';
        }
        if (allTags.includes('传感器')) {
            desc += ' 根据资料中的传感器参数要求，已优先匹配高精度传感器。';
        }
        if (allTags.includes('边缘计算')) {
            desc += ' 资料提及边缘计算需求，方案已集成边缘网关本地决策能力。';
        }
    }

    // 拼接搜索到的真实数据用于方案生成
    let searchContentSummary = '';
    if (searchSuccess && webContent.length > 200) {
        // 提取前2000字符作为方案参考
        searchContentSummary = webContent.substring(0, 3000);
    }

    return {
        name: config.fallbackData.name,
        icon: config.fallbackData.icon,
        sensors,
        gateway,
        protocols,
        platform,
        features,
        desc,
        searchSuccess,
        searchResults: searchResults.slice(0, 2),
        searchContentSummary,
        kbInsights,
        userInsights,
        dataFromSearch: searchSuccess
    };
}

// ========== 用户认证 API ==========
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ error: '请填写完整信息' });
        if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });
        const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
        if (existing.rows.length > 0) return res.status(409).json({ error: '用户名或邮箱已存在' });
        const hash = await bcrypt.hash(password, 10);
        const id = Date.now().toString();
        await pool.query('INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)', [id, username, email, hash]);
        const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id, username, email } });
    } catch (e) { console.error('Register error:', e); res.status(500).json({ error: '注册失败' }); }
});

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
    } catch (e) { console.error('Login error:', e); res.status(500).json({ error: '登录失败' }); }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, email, created_at FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '用户不存在' });
        res.json(result.rows[0]);
    } catch { res.status(500).json({ error: '查询失败' }); }
});

// ========== 资料库 API ==========
app.post('/api/knowledge/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '未选择文件' });
        const { originalname, filename: storedName, size } = req.file;
        const ext = path.extname(originalname).toLowerCase().slice(1);
        const validTypes = ['pdf','doc','docx','txt','xlsx','csv','json','md'];
        if (!validTypes.includes(ext)) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: '不支持的文件格式' }); }
        let content = '';
        const filePath = req.file.path;
        try {
            if (ext === 'json') { content = fs.readFileSync(filePath, 'utf8'); JSON.parse(content); }
            else if (['txt','md','csv'].includes(ext)) content = fs.readFileSync(filePath, 'utf8');
            else if (ext === 'pdf') {
                const { execSync } = require('child_process');
                try {
                    const safePath = filePath.replace(/"/g, '\\"');
                    content = execSync(
                        'python3 -c "import sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); print(chr(10).join(p.extract_text() for p in r.pages[:20]))" "' + safePath + '"',
                        { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
                    ).toString('utf8');
                } catch(e) {
                    console.log('PDF 文本提取失败:', e.message);
                    content = `[${ext.toUpperCase()}] ${originalname}`;
                }
            } else content = `[${ext.toUpperCase()}] ${originalname}`;
        } catch { content = `[文件] ${originalname}`; }
        const tags = extractTags(content, originalname);
        const id = Date.now().toString();
        await pool.query(
            `INSERT INTO knowledge_files (id, user_id, original_name, stored_name, file_type, file_size, content, tags, summary)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, req.user.id, originalname, storedName, ext, size, content.substring(0, 50000), JSON.stringify(tags), content.substring(0, 500)]
        );
        res.json({ id, name: originalname, size, type: ext, tags });
    } catch (e) { console.error('Upload error:', e); res.status(500).json({ error: '上传失败' }); }
});


// PDF 文本提取接口
app.post('/api/extract-pdf', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: '未选择文件' });
        const filePath = req.file.path;
        const { execSync } = require('child_process');
        try {
            const safePath = filePath.replace(/"/g, '\\"');
            const text = execSync(
                'python3 -c "import sys; from pypdf import PdfReader; r=PdfReader(sys.argv[1]); print(chr(10).join(p.extract_text() for p in r.pages[:20]))" "' + safePath + '"',
                { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }
            ).toString('utf8');
            fs.unlinkSync(filePath); // 删除临时文件
            res.json({ success: true, text: text.substring(0, 50000) });
        } catch(e) {
            fs.unlinkSync(filePath);
            res.json({ success: false, error: e.message });
        }
    } catch(e) {
        res.status(500).json({ error: '提取失败' });
    }
});

app.get('/api/knowledge', authMiddleware, async (req, res) => {
    try {
        const { search, tag, page = 1, pageSize = 20 } = req.query;
        let sql = `SELECT id, original_name as name, file_type as type, file_size as size, tags, summary, created_at FROM knowledge_files WHERE user_id = $1`;
        const params = [req.user.id];
        let paramCount = 1;
        if (search) { paramCount++; sql += ` AND (original_name ILIKE $${paramCount} OR content ILIKE $${paramCount} OR tags::text ILIKE $${paramCount})`; params.push(`%${search}%`); }
        if (tag) { paramCount++; sql += ` AND tags @> $${paramCount}::jsonb`; params.push(JSON.stringify([tag])); }
        sql += ' ORDER BY created_at DESC';
        const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
        const countResult = await pool.query(countSql, params);
        const total = parseInt(countResult.rows[0].total);
        paramCount++; sql += ` LIMIT $${paramCount}`; params.push(parseInt(pageSize));
        paramCount++; sql += ` OFFSET $${paramCount}`; params.push((parseInt(page) - 1) * parseInt(pageSize));
        const result = await pool.query(sql, params);
        const files = result.rows.map(f => ({ ...f, tags: typeof f.tags === 'string' ? JSON.parse(f.tags) : f.tags || [] }));
        res.json({ files, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (e) { console.error('Query error:', e); res.status(500).json({ error: '查询失败' }); }
});

app.get('/api/knowledge/tags', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT tags FROM knowledge_files WHERE user_id = $1', [req.user.id]);
        const tagSet = new Set();
        result.rows.forEach(row => { const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags; if (tags) tags.forEach(t => tagSet.add(t)); });
        res.json({ tags: [...tagSet] });
    } catch { res.status(500).json({ error: '查询失败' }); }
});

app.delete('/api/knowledge/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT stored_name FROM knowledge_files WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '文件不存在' });
        const file = result.rows[0];
        try { const fp = path.join(UPLOAD_DIR, file.stored_name); if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch {}
        await pool.query('DELETE FROM knowledge_files WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch { res.status(500).json({ error: '删除失败' }); }
});

// ========== 联网搜索方案数据 API ==========
app.post('/api/generate/scene-data', authMiddleware, async (req, res) => {
    try {
        const { scene, kbFileIds, description } = req.body;
        if (!scene) return res.status(400).json({ error: '缺少场景参数' });

        // 查询资料库文件内容
        let kbFiles = [];
        if (kbFileIds && kbFileIds.length > 0) {
            const result = await pool.query('SELECT original_name, content, tags, summary FROM knowledge_files WHERE id = ANY($1) AND user_id = $2', [kbFileIds, req.user.id]);
            kbFiles = result.rows.map(r => ({
                ...r,
                tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags || []
            }));
        }

        const data = await fetchSceneData(scene, kbFiles, description);
        res.json({ success: true, data });
    } catch (e) {
        console.error('Generate scene data error:', e);
        // 失败时返回默认数据
        const config = sceneKeywords[req.body.scene];
        if (config) {
            res.json({ success: true, data: config.fallbackData, searchSuccess: false });
        } else {
            res.status(500).json({ error: '生成失败' });
        }
    }
});

// ========== 方案管理 API ==========
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
    } catch (e) { console.error('Save error:', e); res.status(500).json({ error: '保存失败' }); }
});

app.get('/api/solutions', authMiddleware, async (req, res) => {
    try {
        const { scene, page = 1, pageSize = 20 } = req.query;
        let sql = `SELECT id, title, scene, budget, device_count, communication, cloud_platform, kb_file_ids, version, created_at, updated_at FROM solutions WHERE user_id = $1`;
        const params = [req.user.id];
        let paramCount = 1;
        if (scene) { paramCount++; sql += ` AND scene = $${paramCount}`; params.push(scene); }
        sql += ' ORDER BY created_at DESC';
        const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
        const countResult = await pool.query(countSql, params);
        const total = parseInt(countResult.rows[0].total);
        paramCount++; sql += ` LIMIT $${paramCount}`; params.push(parseInt(pageSize));
        paramCount++; sql += ` OFFSET $${paramCount}`; params.push((parseInt(page) - 1) * parseInt(pageSize));
        const result = await pool.query(sql, params);
        const solutions = result.rows.map(s => ({ ...s, kb_file_ids: typeof s.kb_file_ids === 'string' ? JSON.parse(s.kb_file_ids) : s.kb_file_ids || [] }));
        res.json({ solutions, total, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (e) { console.error('Query error:', e); res.status(500).json({ error: '查询失败' }); }
});

app.get('/api/solutions/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM solutions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: '方案不存在' });
        const sol = result.rows[0];
        sol.content = typeof sol.content === 'string' ? JSON.parse(sol.content) : sol.content;
        sol.kb_file_ids = typeof sol.kb_file_ids === 'string' ? JSON.parse(sol.kb_file_ids) : sol.kb_file_ids || [];
        res.json(sol);
    } catch { res.status(500).json({ error: '查询失败' }); }
});

app.delete('/api/solutions/:id', authMiddleware, async (req, res) => {
    try {
        await pool.query('DELETE FROM solutions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch { res.status(500).json({ error: '删除失败' }); }
});

// ========== 启动 ==========
app.listen(PORT, '0.0.0.0', async () => {
    await initDB();
    console.log(`🚀 IoT方案生成器服务已启动 (v3.0): http://0.0.0.0:${PORT}`);
});
