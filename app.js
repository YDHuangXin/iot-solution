
        const API = window.location.origin;
        let authToken = localStorage.getItem('iot_token');
        let currentUser = null;
        let currentScene = 'smart-industry';
        let currentSolution = null;
        let solutionVersions = [];
        let kbFiles = [];
        let kbPage = 1;
        let historyPage = 1;

        const sceneData = {
            'smart-industry': { name: '智慧工业物联网方案', icon: '🏭', sensors: ['温湿度传感器','烟雾探测器','振动传感器','电流互感器','气压传感器'], gateway: '工业级边缘网关', protocols: ['Modbus','OPC-UA','MQTT'], platform: 'OneNET工业物联网平台', features: ['设备实时监控','预测性维护','能耗管理','产线数字孪生','异常告警'], desc: '面向工业制造场景，实现设备互联、生产数据实时采集、智能分析与预测性维护。' },
            'smart-agriculture': { name: '智慧农业物联网方案', icon: '🌾', sensors: ['土壤湿度传感器','光照传感器','CO₂传感器','气象站','水质监测仪'], gateway: '农业专用LoRa网关', protocols: ['LoRaWAN','NB-IoT','MQTT'], platform: 'OneNET智慧农业平台', features: ['精准灌溉控制','环境智能调控','作物生长监测','病虫害预警','产量预测分析'], desc: '面向现代农业生产，通过传感器网络实时监测土壤、气象、作物状态。' },
            'smart-home': { name: '智能家居物联网方案', icon: '🏠', sensors: ['人体红外传感器','门窗磁传感器','温湿度传感器','光照传感器','空气质量传感器'], gateway: '智能家庭中枢网关', protocols: ['ZigBee 3.0','WiFi 6','蓝牙Mesh'], platform: '移动智能家居云平台', features: ['场景自动化','语音控制','远程安防','能耗优化','健康环境管理'], desc: '打造全屋智能生活体验，通过多协议融合实现设备互联互通。' },
            'security': { name: '智能安防监测方案', icon: '🔒', sensors: ['高清AI摄像头','红外对射探测器','振动光纤','门禁控制器','紧急按钮'], gateway: '安防专用汇聚网关', protocols: ['TCP/IP','RS485','GB/T28181'], platform: '视频云+AI分析平台', features: ['AI视频分析','周界防范','人脸门禁','消防联动','应急指挥'], desc: '构建全方位立体安防体系，融合视频AI、物联传感与联动控制。' },
            'smart-city': { name: '智慧城市物联网方案', icon: '🏙️', sensors: ['环境监测站','智能路灯控制器','井盖传感器','水位监测仪','噪声传感器'], gateway: '城市级NB-IoT基站', protocols: ['NB-IoT','5G','LoRaWAN'], platform: '城市物联网运营管理平台', features: ['城市体征监测','智慧照明','管网监测','环境监测','应急调度'], desc: '建设城市级物联感知网络，汇聚市政、环境、交通等多维数据。' },
            'smart-logistics': { name: '智慧物流物联网方案', icon: '📦', sensors: ['GPS定位器','温湿度记录仪','电子锁','RFID读写器','重量传感器'], gateway: '物流边缘计算网关', protocols: ['4G/5G','BLE','RFID/UHF'], platform: '物流链可视化管理平台', features: ['全程冷链监控','仓储自动化','路径优化','电子围栏','签收确认'], desc: '实现物流全链路数字化管控，从仓储到配送全程可追溯。' }
        };
        const fileIconMap = { pdf:'📕', doc:'📘', docx:'📘', txt:'📄', xlsx:'📗', csv:'📊', json:'📋', md:'📝' };

        document.addEventListener('DOMContentLoaded', () => {
            initSceneTags(); initRangeSliders(); initTabs(); initKbUpload(); checkAuth();
        });

        function initSceneTags() {
            document.querySelectorAll('.scene-tag').forEach(tag => {
                tag.addEventListener('click', () => {
                    document.querySelectorAll('.scene-tag').forEach(t => t.classList.remove('active'));
                    tag.classList.add('active'); currentScene = tag.dataset.scene;
                });
            });
        }
        function initRangeSliders() {
            document.getElementById('budget').addEventListener('input', e => document.getElementById('budgetValue').textContent = e.target.value + '万');
            document.getElementById('devices').addEventListener('input', e => document.getElementById('deviceValue').textContent = e.target.value + '台');
        }
        function initTabs() {
            document.querySelectorAll('.solution-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.solution-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.solution-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
                });
            });
        }

        // 认证
        function checkAuth() {
            if (!authToken) return showAuthPage();
            fetch(API + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + authToken } })
                .then(r => r.ok ? r.json() : Promise.reject())
                .then(user => { currentUser = user; showMainApp(); })
                .catch(() => { localStorage.removeItem('iot_token'); authToken = null; showAuthPage(); });
        }
        function showAuthPage() { document.getElementById('authPage').style.display = 'flex'; document.getElementById('mainApp').style.display = 'none'; }
        function showMainApp() {
            document.getElementById('authPage').style.display = 'none'; document.getElementById('mainApp').style.display = 'block';
            document.getElementById('userDisplayName').textContent = currentUser.username;
        }
        function switchAuthTab(tab) {
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('loginForm').style.display = tab === 'login' ? '' : 'none';
            document.getElementById('registerForm').style.display = tab === 'register' ? '' : 'none';
            document.getElementById('authError').style.display = 'none';
        }
        async function handleLogin() {
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            if (!username || !password) return showAuthError('请填写完整信息');
            try {
                const r = await fetch(API + '/api/auth/login', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await r.json();
                if (!r.ok) return showAuthError(data.error);
                authToken = data.token; localStorage.setItem('iot_token', data.token);
                currentUser = data.user; showMainApp(); showToast('登录成功！');
            } catch { showAuthError('网络错误，请重试'); }
        }
        async function handleRegister() {
            const username = document.getElementById('regUsername').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const password2 = document.getElementById('regPassword2').value;
            if (!username || !email || !password) return showAuthError('请填写完整信息');
            if (password.length < 6) return showAuthError('密码至少6位');
            if (password !== password2) return showAuthError('两次密码不一致');
            try {
                const r = await fetch(API + '/api/auth/register', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await r.json();
                if (!r.ok) return showAuthError(data.error);
                authToken = data.token; localStorage.setItem('iot_token', data.token);
                currentUser = data.user; showMainApp(); showToast('注册成功！');
            } catch { showAuthError('网络错误，请重试'); }
        }
        function showAuthError(msg) { const el = document.getElementById('authError'); el.textContent = msg; el.style.display = 'block'; }
        function handleLogout() { localStorage.removeItem('iot_token'); authToken = null; currentUser = null; showAuthPage(); }

        // 页面切换
        function switchPage(page) {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelector(`.nav-tab[data-page="${page}"]`).classList.add('active');
            document.getElementById('generatorPage').style.display = page === 'generator' ? '' : 'none';
            document.getElementById('knowledgePage').classList.toggle('active', page === 'knowledge');
            document.getElementById('historyPage').classList.toggle('active', page === 'history');
            if (page === 'knowledge') loadKnowledge();
            if (page === 'history') loadHistory();
        }

        // 资料库
        function initKbUpload() {
            const input = document.getElementById('kbFileInput');
            const zone = document.getElementById('kbUploadZone');
            if (!input || !zone) return;
            input.addEventListener('change', e => handleLocalFiles(e.target.files));
            zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
            zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); handleLocalFiles(e.dataTransfer.files); });
        }
        async function handleLocalFiles(fileList) {
            if (!fileList.length) return;
            for (const file of fileList) {
                const ext = file.name.split('.').pop().toLowerCase();
                if (!['pdf','doc','docx','txt','xlsx','csv','json','md'].includes(ext)) { showToast('不支持: ' + file.name); continue; }
                if (kbFiles.find(f => f.name === file.name)) { showToast('已存在: ' + file.name); continue; }
                let content = '';
                try { if (ext === 'json') { content = await file.text(); JSON.parse(content); } else if (['txt','md','csv'].includes(ext)) content = await file.text(); else content = `[${ext.toUpperCase()}] ${file.name}`; }
                catch { content = `[文件] ${file.name}`; }
                const tags = extractTags(content, file.name);
                kbFiles.push({ name: file.name, size: file.size, ext, content, tags });
                addKbFileItem(file.name, file.size, ext, tags);
            }
            if (kbFiles.length > 0) await parseKbFiles();
        }
        function addKbFileItem(name, size, ext, tags) {
            const list = document.getElementById('kbFileList');
            const item = document.createElement('div');
            item.className = 'kb-file-item';
            item.innerHTML = `<div class="file-info"><span class="file-icon">${fileIconMap[ext]||'📄'}</span><span class="file-name" title="${name}">${name}</span><span class="file-size">${formatSize(size)}</span></div><button class="file-remove" onclick="removeLocalKbFile('${name}',this)">✕</button>`;
            list.appendChild(item); updateKbBadge();
        }
        function removeLocalKbFile(name, btnEl) { kbFiles = kbFiles.filter(f => f.name !== name); btnEl.parentElement.remove(); updateKbBadge(); renderKbTags(); if (!kbFiles.length) document.getElementById('kbStatus').classList.remove('active'); }
        function updateKbBadge() { const b = document.getElementById('kbFileCount'); b.style.display = kbFiles.length ? 'inline-flex' : 'none'; b.textContent = kbFiles.length + ' 份'; }
        function formatSize(b) { return b < 1024 ? b+'B' : b < 1048576 ? (b/1024).toFixed(1)+'KB' : (b/1048576).toFixed(1)+'MB'; }
        function extractTags(content, fileName) {
            const allTags = []; const text = (content + ' ' + fileName).toLowerCase();
            const sk = { '工业':['工厂','产线','车间','制造','工业'], '农业':['农业','种植','灌溉','温室','大棚','土壤'], '家居':['家居','家庭','住宅'], '安防':['安防','监控','摄像头','门禁','消防'], '城市':['城市','市政','路灯','井盖','交通'], '物流':['物流','仓储','运输','配送','冷链'] };
            for (const [s, kws] of Object.entries(sk)) for (const kw of kws) if (text.includes(kw)) { allTags.push(s); break; }
            ['传感器','网关','MQTT','NB-IoT','LoRa','5G','边缘计算','AI','大数据','云平台','自动化','预警'].forEach(kw => { if (text.includes(kw.toLowerCase())) allTags.push(kw); });
            return [...new Set(allTags)].slice(0, 8);
        }
        async function parseKbFiles() {
            const progress = document.getElementById('kbParseProgress'); progress.classList.add('active');
            const steps = ['正在读取文件内容...','提取关键特征...','匹配行业知识...','构建知识索引...','资料库就绪！'];
            for (let i = 0; i < steps.length; i++) {
                document.getElementById('kbParseText').textContent = steps[i];
                document.getElementById('kbParseBarFill').style.width = ((i+1)/steps.length*100)+'%';
                await sleep(300);
            }
            await sleep(200); progress.classList.remove('active');
            document.getElementById('kbStatus').classList.add('active');
            document.getElementById('kbStatusText').textContent = `资料库已就绪 · ${kbFiles.length} 份文件`;
            renderKbTags(); showToast(`${kbFiles.length} 份资料已加载`);
        }
        function renderKbTags() {
            const allTags = [...new Set(kbFiles.flatMap(f => f.tags||[]))];
            document.getElementById('kbTagList').innerHTML = allTags.map(t => `<span class="kb-tag">${t}</span>`).join('');
        }

        // 服务器上传
        async function uploadToServer(fileList) {
            if (!fileList.length) return;
            for (const file of fileList) {
                const fd = new FormData(); fd.append('file', file);
                try {
                    const r = await fetch(API + '/api/knowledge/upload', { method: 'POST', headers: { 'Authorization': 'Bearer '+authToken }, body: fd });
                    const data = await r.json();
                    if (!r.ok) { showToast('上传失败: ' + (data.error||'')); continue; }
                    showToast(`已上传: ${data.name}`);
                } catch { showToast('上传失败'); }
            }
            loadKnowledge();
        }

        // 资料库管理
        async function loadKnowledge() {
            const search = document.getElementById('kbSearchInput').value.trim();
            const tag = document.getElementById('kbTagFilter').value;
            try {
                let url = API + `/api/knowledge?page=${kbPage}&pageSize=10`;
                if (search) url += '&search=' + encodeURIComponent(search);
                if (tag) url += '&tag=' + encodeURIComponent(tag);
                const r = await fetch(url, { headers: { 'Authorization': 'Bearer '+authToken } });
                const data = await r.json();
                renderKbTable(data.files, data.total); renderKbPagination(data.total);
                const tr = await fetch(API + '/api/knowledge/tags', { headers: { 'Authorization': 'Bearer '+authToken } });
                const td = await tr.json();
                const sel = document.getElementById('kbTagFilter');
                sel.innerHTML = '<option value="">全部标签</option>' + td.tags.map(t => `<option value="${t}">${t}</option>`).join('');
            } catch { document.getElementById('kbManageTableBody').innerHTML = '<tr><td colspan="6" class="kb-empty-state"><div class="empty-icon">📂</div><p>暂无资料</p></td></tr>'; }
        }
        function renderKbTable(files, total) {
            const tbody = document.getElementById('kbManageTableBody');
            if (!files.length) { tbody.innerHTML = '<tr><td colspan="6" class="kb-empty-state"><div class="empty-icon">📂</div><p>暂无资料</p></td></tr>'; return; }
            tbody.innerHTML = files.map(f => `<tr><td><strong>${fileIconMap[f.type]||'📄'} ${f.name}</strong></td><td>${f.type.toUpperCase()}</td><td>${formatSize(f.size)}</td><td>${(f.tags||[]).map(t => `<span class="kb-tag">${t}</span>`).join(' ')}</td><td>${new Date(f.created_at).toLocaleString('zh-CN')}</td><td><button class="hc-btn danger" onclick="deleteKbFile(${f.id})">删除</button></td></tr>`).join('');
        }
        function renderKbPagination(total) {
            const pages = Math.ceil(total / 10); const el = document.getElementById('kbPagination');
            if (pages <= 1) { el.innerHTML = ''; return; }
            el.innerHTML = `<button class="page-btn" ${kbPage<=1?'disabled':''} onclick="kbPage--;loadKnowledge()">上一页</button><span style="padding:8px;color:var(--text-muted)">${kbPage}/${pages}</span><button class="page-btn" ${kbPage>=pages?'disabled':''} onclick="kbPage++;loadKnowledge()">下一页</button>`;
        }
        function searchKnowledge() { kbPage = 1; loadKnowledge(); }
        async function deleteKbFile(id) {
            if (!confirm('确定删除该资料？')) return;
            try { await fetch(API + '/api/knowledge/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer '+authToken } }); showToast('已删除'); loadKnowledge(); } catch { showToast('删除失败'); }
        }

        // 历史方案
        async function loadHistory() {
            const scene = document.getElementById('historySceneFilter').value;
            try {
                let url = API + `/api/solutions?page=${historyPage}&pageSize=12`;
                if (scene) url += '&scene=' + encodeURIComponent(scene);
                const r = await fetch(url, { headers: { 'Authorization': 'Bearer '+authToken } });
                const data = await r.json();
                renderHistoryGrid(data.solutions); renderHistoryPagination(data.total);
            } catch { document.getElementById('historyGrid').innerHTML = '<div class="kb-empty-state"><div class="empty-icon">📁</div><p>暂无历史方案</p></div>'; }
        }
        function renderHistoryGrid(solutions) {
            const grid = document.getElementById('historyGrid');
            if (!solutions.length) { grid.innerHTML = '<div class="kb-empty-state"><div class="empty-icon">📁</div><p>暂无历史方案，快去生成第一个方案吧！</p></div>'; return; }
            grid.innerHTML = solutions.map(s => `<div class="history-card" onclick="viewSolution('${s.id}')"><div class="hc-header"><span class="hc-icon">${sceneData[s.scene]?.icon||'📄'}</span><span class="hc-title">${s.title}</span></div><div class="hc-meta"><span class="hc-tag">预算¥${s.budget}万</span><span class="hc-tag">${s.device_count}台设备</span><span class="hc-tag">v${s.version}</span></div><div class="hc-footer"><span class="hc-date">${new Date(s.created_at).toLocaleString('zh-CN')}</span><div class="hc-actions"><button class="hc-btn" onclick="event.stopPropagation();viewSolution('${s.id}')">查看</button><button class="hc-btn danger" onclick="event.stopPropagation();deleteSolution('${s.id}')">删除</button></div></div></div>`).join('');
        }
        function renderHistoryPagination(total) {
            const pages = Math.ceil(total / 12); const el = document.getElementById('historyPagination');
            if (pages <= 1) { el.innerHTML = ''; return; }
            el.innerHTML = `<button class="page-btn" ${historyPage<=1?'disabled':''} onclick="historyPage--;loadHistory()">上一页</button><span style="padding:8px;color:var(--text-muted)">${historyPage}/${pages}</span><button class="page-btn" ${historyPage>=pages?'disabled':''} onclick="historyPage++;loadHistory()">下一页</button>`;
        }
        async function viewSolution(id) {
            try {
                const r = await fetch(API + '/api/solutions/' + id, { headers: { 'Authorization': 'Bearer '+authToken } });
                const s = await r.json();
                currentSolution = s.content; renderSolution(s.content);
                switchPage('generator'); showToast('已加载方案: ' + s.title);
            } catch { showToast('加载失败'); }
        }
        async function deleteSolution(id) {
            if (!confirm('确定删除该方案？')) return;
            try { await fetch(API + '/api/solutions/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer '+authToken } }); showToast('已删除'); loadHistory(); } catch { showToast('删除失败'); }
        }

        // 方案生成
        async function generateSolution() {
            const btn = document.getElementById('btnGenerate'); btn.classList.add('loading'); showLoading();
            const steps = [
                '正在解析需求特征...',
                kbFiles.length > 0 ? `正在学习 ${kbFiles.length} 份参考资料...` : '匹配行业方案知识库...',
                '执行硬件选型算法...', '计算网络拓扑最优解...', '生成云平台架构...',
                '核算成本预算...', '评估风险与优化建议...', '方案生成完成！'
            ];
            for (let i = 0; i < steps.length; i++) { await sleep(400); document.getElementById('loadingSub').textContent = steps[i]; }
            await sleep(300); hideLoading();
            const solution = buildSolution(); currentSolution = solution;
            solutionVersions.push({ ...solution, version: solutionVersions.length + 1 });
            renderSolution(solution);
            try {
                await fetch(API + '/api/solutions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer '+authToken },
                    body: JSON.stringify({ title: solution.sceneName, scene: currentScene, budget: solution.budget, device_count: solution.devices, communication: solution.communication, cloud_platform: solution.cloud, description: solution.description, content: solution, kb_file_ids: kbFiles.map(f => f.name), version: solutionVersions.length })
                });
            } catch {}
            btn.classList.remove('loading'); showToast('方案生成成功！已自动保存');
        }

        function buildSolution() {
            const scene = sceneData[currentScene];
            const budget = parseInt(document.getElementById('budget').value);
            const devices = parseInt(document.getElementById('devices').value);
            const comm = document.getElementById('communication').value;
            const cloud = document.getElementById('cloudPlatform').value;
            const desc = document.getElementById('description').value;
            return { scene: currentScene, sceneName: scene.name, sceneIcon: scene.icon, budget, devices, communication: comm, cloud, description: desc, hardware: generateHardware(scene, devices, budget), cost: calculateCost(generateHardware(scene, devices, budget), budget), risks: generateRisks(), platform: scene.platform, features: scene.features, protocols: scene.protocols, desc: scene.desc, sensors: scene.sensors, gateway: scene.gateway, kbFiles: [...kbFiles], kbInsights: generateKbInsights() };
        }
        function generateHardware(scene, devices, budget) {
            const bp = budget * 10000 / devices;
            return [
                { type: '传感器', model: scene.sensors[0], params: '精度±0.5℃, IP67', price: Math.round(bp*0.15), qty: Math.ceil(devices*0.6) },
                { type: '传感器', model: scene.sensors[1], params: '量程0-100%, 响应<2s', price: Math.round(bp*0.12), qty: Math.ceil(devices*0.4) },
                { type: '传感器', model: scene.sensors[2]||scene.sensors[0], params: '工业级, 宽温-40~85℃', price: Math.round(bp*0.18), qty: Math.ceil(devices*0.3) },
                { type: '网关', model: scene.gateway, params: '多协议, 边缘计算', price: Math.round(bp*2.5), qty: Math.ceil(devices/30) },
                { type: '通信模组', model: '通信模组-' + (currentScene.includes('industry')?'5G':'NB-IoT'), params: '低功耗, 广覆盖', price: Math.round(bp*0.08), qty: devices },
                { type: '供电模块', model: '太阳能+锂电池模组', params: '续航3年+, 免维护', price: Math.round(bp*0.1), qty: Math.ceil(devices*0.7) }
            ];
        }
        function calculateCost(hardware, budget) {
            const hw = hardware.reduce((s, h) => s + h.price * h.qty, 0);
            const inst = Math.round(hw * 0.15), plat = Math.round(budget*10000*0.12), net = Math.round(budget*10000*0.08), svc = Math.round(budget*10000*0.1);
            const total = hw + inst + plat + net + svc;
            return { items: [
                { name:'硬件设备', detail:'传感器+网关+通信模组+供电', amount: hw, percent: Math.round(hw/total*100) },
                { name:'安装调试', detail:'现场施工+设备调试+联调测试', amount: inst, percent: Math.round(inst/total*100) },
                { name:'云平台服务', detail:'平台授权+数据存储+API调用', amount: plat, percent: Math.round(plat/total*100) },
                { name:'网络通信', detail:'流量费+专线+网络运维', amount: net, percent: Math.round(net/total*100) },
                { name:'运维服务', detail:'首年运维+技术支持+培训', amount: svc, percent: Math.round(svc/total*100) }
            ], total };
        }
        function generateRisks() {
            return [
                { level:'high', title:'设备兼容性风险', desc:'不同厂商设备协议差异可能导致集成困难，建议提前进行POC验证。' },
                { level:'high', title:'网络覆盖不足', desc:'部分部署区域可能存在信号盲区，需提前进行网络勘测。' },
                { level:'medium', title:'数据安全风险', desc:'物联网数据传输存在被截获风险，建议采用TLS加密传输。' },
                { level:'medium', title:'设备运维成本', desc:'大规模部署后设备维护成本可能超出预期，建议建立远程运维体系。' },
                { level:'low', title:'平台扩展性', desc:'业务增长后平台需承载更多设备，建议选择弹性架构平台。' },
                { level:'low', title:'供电可靠性', desc:'偏远地区设备供电不稳定，建议采用多路供电方案。' }
            ];
        }
        function generateKbInsights() {
            if (!kbFiles.length) return null;
            const insights = kbFiles.filter(f => f.tags?.length).map(f => ({ source: f.name, tags: f.tags, summary: f.content.substring(0, 200) }));
            const allTags = [...new Set(kbFiles.flatMap(f => f.tags||[]))];
            const suggestions = [];
            if (allTags.includes('工业')) suggestions.push('参考资料建议：优先选用工业级防护设备（IP65+）。');
            if (allTags.includes('农业')) suggestions.push('参考资料建议：考虑农业场景供电困难，推荐太阳能方案。');
            if (allTags.includes('传感器')) suggestions.push('根据资料中的传感器参数，已优先匹配高精度传感器。');
            if (allTags.includes('边缘计算')) suggestions.push('资料提及边缘计算，方案已集成边缘网关本地决策。');
            if (allTags.includes('预警')) suggestions.push('结合资料告警规则，已配置多级告警阈值。');
            return { insights, customSuggestions: suggestions, allTags };
        }
        function getCommName(v) { return { 'auto':'智能推荐','nb-iot':'NB-IoT','lora':'LoRa','wifi':'WiFi','5g':'5G','zigbee':'ZigBee','bluetooth':'蓝牙BLE','ethernet':'以太网' }[v] || v; }
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
        function showLoading() { document.getElementById('loadingOverlay').classList.add('active'); }
        function hideLoading() { document.getElementById('loadingOverlay').classList.remove('active'); }
        function showToast(text) { const t = document.getElementById('toast'); document.getElementById('toastText').textContent = text; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

        // 渲染方案
        function renderSolution(s) {
            document.getElementById('placeholder').style.display = 'none';
            document.getElementById('solutionResult').classList.add('active');
            document.getElementById('solutionTitle').textContent = s.sceneIcon + ' ' + s.sceneName;
            renderOverview(s); renderHardware(s.hardware); renderArchitecture(s); renderPlatform(s); renderCost(s.cost); renderRisks(s.risks); renderKnowledge(s.kbInsights); renderCompare();
        }
        function renderOverview(s) {
            document.getElementById('overviewGrid').innerHTML = `
                <div class="info-card"><div class="label">应用场景</div><div class="value">${s.sceneIcon} ${s.sceneName}</div></div>
                <div class="info-card"><div class="label">设备规模</div><div class="value">${s.devices} 台</div></div>
                <div class="info-card"><div class="label">项目预算</div><div class="value">¥${s.budget}万</div></div>
                <div class="info-card"><div class="label">通信方式</div><div class="value">${getCommName(s.communication)}</div></div>
                <div class="info-card"><div class="label">云平台</div><div class="value">${s.platform}</div></div>
                <div class="info-card"><div class="label">核心功能</div><div class="value">${s.features.length} 项</div></div>`;
            let html = `<p>${s.desc}</p><br><p><strong>方案亮点：</strong></p><ul style="margin-top:8px;padding-left:20px;">${s.features.map(f=>`<li>${f}</li>`).join('')}</ul>`;
            if (s.kbInsights?.customSuggestions?.length) html += `<br><p><strong>📚 资料库参考：</strong></p><ul style="margin-top:8px;padding-left:20px;">${s.kbInsights.customSuggestions.map(x=>`<li>${x}</li>`).join('')}</ul>`;
            document.getElementById('solutionSummary').innerHTML = html;
        }
        function renderHardware(hw) { document.getElementById('hardwareBody').innerHTML = hw.map(h => `<tr><td><strong>${h.type}</strong></td><td>${h.model}</td><td style="color:var(--text-muted);font-size:0.85rem">${h.params}</td><td>¥${h.price.toLocaleString()}</td><td>${h.qty}</td></tr>`).join(''); }
        function renderArchitecture(s) {
            document.getElementById('archDiagram').innerHTML = `
                <div class="arch-layer cloud">☁️ 应用层 — ${s.platform}<div class="arch-nodes">${s.features.map(f=>`<span class="arch-node">${f}</span>`).join('')}</div></div>
                <div class="arch-arrow">↕️ MQTT / HTTPS</div>
                <div class="arch-layer platform">🖥️ 平台层 — 数据中台 + AI分析<div class="arch-nodes"><span class="arch-node">设备管理</span><span class="arch-node">规则引擎</span><span class="arch-node">数据存储</span><span class="arch-node">AI推理</span></div></div>
                <div class="arch-arrow">↕️ 数据汇聚</div>
                <div class="arch-layer network">📡 网络层 — ${getCommName(s.communication)} + ${s.protocols[0]}<div class="arch-nodes"><span class="arch-node">数据转发</span><span class="arch-node">协议转换</span><span class="arch-node">边缘计算</span></div></div>
                <div class="arch-arrow">↕️ ${s.protocols.join(' / ')}</div>
                <div class="arch-layer device">🔌 边缘层 — ${s.gateway}<div class="arch-nodes"><span class="arch-node">数据预处理</span><span class="arch-node">本地缓存</span><span class="arch-node">断网续传</span></div></div>
                <div class="arch-arrow">↕️ 传感数据</div>
                <div class="arch-layer sensor">📟 感知层<div class="arch-nodes">${s.sensors.map(x=>`<span class="arch-node">${x}</span>`).join('')}</div></div>`;
            document.getElementById('dataFlow').innerHTML = `<p><strong>1. 数据采集</strong>：传感器实时采集数据上报至边缘网关。</p><p><strong>2. 边缘处理</strong>：${s.gateway}进行数据过滤、聚合、协议转换。</p><p><strong>3. 数据传输</strong>：经${getCommName(s.communication)}加密上传至云平台。</p><p><strong>4. 云端分析</strong>：${s.platform}进行存储、分析、可视化。</p><p><strong>5. 指令下发</strong>：平台生成控制指令实现闭环控制。</p>`;
        }
        function renderPlatform(s) {
            document.getElementById('platformGrid').innerHTML = `
                <div class="info-card"><div class="label">平台</div><div class="value">${s.platform}</div></div>
                <div class="info-card"><div class="label">设备接入</div><div class="value">${s.devices}+ 台</div></div>
                <div class="info-card"><div class="label">数据存储</div><div class="value">时序数据库</div></div>
                <div class="info-card"><div class="label">API接口</div><div class="value">RESTful + MQTT</div></div>
                <div class="info-card"><div class="label">安全认证</div><div class="value">设备证书+Token</div></div>
                <div class="info-card"><div class="label">可用性</div><div class="value">99.95% SLA</div></div>`;
            document.getElementById('platformModules').innerHTML = `<p><strong>核心功能模块：</strong></p><ul style="margin-top:8px;padding-left:20px;line-height:2;"><li><strong>设备管理：</strong>注册、OTA升级、状态监控</li><li><strong>数据服务：</strong>实时流处理、历史查询、导出</li><li><strong>规则引擎：</strong>可视化编排、告警触发、联动</li><li><strong>AI分析：</strong>异常检测、趋势预测</li><li><strong>可视化大屏：</strong>GIS地图、实时看板</li><li><strong>开放能力：</strong>SDK/API、Webhook</li></ul>`;
        }
        function renderCost(c) {
            document.getElementById('costSummary').innerHTML = `
                <div class="info-card"><div class="label">总预算</div><div class="value" style="color:var(--accent)">¥${(c.total/10000).toFixed(1)}万</div></div>
                <div class="info-card"><div class="label">单设备成本</div><div class="value">¥${Math.round(c.total/currentSolution.devices)}</div></div>
                <div class="info-card"><div class="label">年运维</div><div class="value">¥${Math.round(c.total*0.08).toLocaleString()}</div></div>`;
            const colors = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444'];
            document.getElementById('costChart').innerHTML = c.items.map((x,i) => `<div class="cost-bar"><div class="label">${x.name}</div><div class="bar"><div class="bar-fill" style="width:${x.percent}%;background:${colors[i]}">${x.percent}%</div></div><div class="amount">¥${(x.amount/10000).toFixed(1)}万</div></div>`).join('');
            document.getElementById('costBody').innerHTML = c.items.map(x => `<tr><td><strong>${x.name}</strong></td><td style="color:var(--text-muted)">${x.detail}</td><td>¥${x.amount.toLocaleString()}</td><td>${x.percent}%</td></tr>`).join('') + `<tr style="font-weight:700;border-top:2px solid var(--border)"><td>合计</td><td></td><td>¥${c.total.toLocaleString()}</td><td>100%</td></tr>`;
        }
        function renderRisks(risks) {
            document.getElementById('riskList').innerHTML = risks.map(r => `<div class="risk-item"><div class="risk-level ${r.level}"></div><div class="risk-content"><h4>${r.title}</h4><p>${r.desc}</p></div></div>`).join('');
            document.getElementById('optimizationTips').innerHTML = `<p><strong>1. 分阶段部署：</strong>先小规模POC验证，再批量推广。</p><p><strong>2. 标准化选型：</strong>优先选用标准协议设备。</p><p><strong>3. 安全加固：</strong>启用TLS加密、固件签名验证。</p><p><strong>4. 数据治理：</strong>建立数据分级分类制度。</p><p><strong>5. 运维体系：</strong>建设统一运维管理平台。</p>`;
        }
        function renderKnowledge(insights) {
            const btn = document.getElementById('kbTabBtn');
            if (!insights || !insights.insights?.length) { btn.style.display = 'none'; return; }
            btn.style.display = '';
            document.getElementById('kbRefContent').innerHTML = `<div class="kb-ref-title">📚 参考资料引用</div>${insights.insights.map(i => `<div class="kb-ref-item"><div class="ref-source">📄 ${i.source} · 标签：${i.tags.join(' / ')}</div><div>${i.summary}</div></div>`).join('')}`;
            document.getElementById('kbAnalysis').innerHTML = `<p>已读取 <strong>${kbFiles.length}</strong> 份资料，提取 <strong>${insights.allTags.length}</strong> 个特征标签。</p><div class="kb-tag-list" style="margin-top:8px;">${insights.allTags.map(t=>`<span class="kb-tag">${t}</span>`).join('')}</div><br><p><strong>定制建议：</strong></p><ul style="margin-top:8px;padding-left:20px;line-height:2;">${insights.customSuggestions.map(s=>`<li>${s}</li>`).join('')}</ul>`;
        }
        function renderCompare() {
            const panel = document.getElementById('comparePanel');
            if (solutionVersions.length < 2) { panel.classList.remove('active'); return; }
            panel.classList.add('active');
            const v1 = solutionVersions[solutionVersions.length-2], v2 = solutionVersions[solutionVersions.length-1];
            document.getElementById('compareGrid').innerHTML = `
                <div class="compare-card"><h4>版本 ${v1.version}（原方案）</h4><div class="compare-item"><span class="key">场景</span><span class="val">${v1.sceneName}</span></div><div class="compare-item"><span class="key">预算</span><span class="val">¥${v1.budget}万</span></div><div class="compare-item"><span class="key">设备数</span><span class="val">${v1.devices}台</span></div><div class="compare-item"><span class="key">资料</span><span class="val">${(v1.kbFiles||[]).length}份</span></div></div>
                <div class="compare-card"><h4>版本 ${v2.version}（新方案）</h4><div class="compare-item"><span class="key">场景</span><span class="val">${v2.sceneName}</span></div><div class="compare-item"><span class="key">预算</span><span class="val">¥${v2.budget}万</span></div><div class="compare-item"><span class="key">设备数</span><span class="val">${v2.devices}台</span></div><div class="compare-item"><span class="key">资料</span><span class="val">${(v2.kbFiles||[]).length}份</span></div></div>`;
        }
        function toggleCompare() { const p = document.getElementById('comparePanel'); p.classList.toggle('active'); if (solutionVersions.length < 2) showToast('请生成多个版本'); }
        function openEditModal() { document.getElementById('editBudget').value = document.getElementById('budget').value; document.getElementById('editDevices').value = document.getElementById('devices').value; document.getElementById('editModal').classList.add('active'); }
        function closeEditModal() { document.getElementById('editModal').classList.remove('active'); }
        function applyEdit() {
            document.getElementById('budget').value = document.getElementById('editBudget').value;
            document.getElementById('devices').value = document.getElementById('editDevices').value;
            document.getElementById('budgetValue').textContent = document.getElementById('editBudget').value + '万';
            document.getElementById('deviceValue').textContent = document.getElementById('editDevices').value + '台';
            closeEditModal(); generateSolution();
        }
        function exportWord() {
            if (!currentSolution) return;
            const s = currentSolution;
            const content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${s.sceneName}</title><style>body{font-family:'Microsoft YaHei',sans-serif;line-height:1.8;color:#333;padding:40px}h1{color:#4f46e5;font-size:24px;border-bottom:3px solid #4f46e5;padding-bottom:10px}h2{color:#1e293b;font-size:18px;margin-top:30px;border-left:4px solid #4f46e5;padding-left:12px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f1f5f9;padding:10px;text-align:left;border:1px solid #e2e8f0;font-size:13px}td{padding:10px;border:1px solid #e2e8f0;font-size:13px}</style></head><body><h1>${s.sceneIcon} ${s.sceneName}</h1><h2>一、项目概述</h2><p>${s.desc}</p><h2>二、硬件选型</h2><table><tr><th>类型</th><th>型号</th><th>参数</th><th>单价</th><th>数量</th></tr>${s.hardware.map(h=>`<tr><td>${h.type}</td><td>${h.model}</td><td>${h.params}</td><td>¥${h.price.toLocaleString()}</td><td>${h.qty}</td></tr>`).join('')}</table><h2>三、成本预算</h2><table><tr><th>项目</th><th>明细</th><th>金额</th><th>占比</th></tr>${s.cost.items.map(i=>`<tr><td>${i.name}</td><td>${i.detail}</td><td>¥${i.amount.toLocaleString()}</td><td>${i.percent}%</td></tr>`).join('')}</table><br><p style="text-align:center;color:#94a3b8;font-size:12px;">— AI智能物联网方案生成器 —</p></body></html>`;
            const blob = new Blob(['\ufeff'+content], { type: 'application/msword' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = s.sceneName + '.doc'; a.click(); URL.revokeObjectURL(a.href);
            showToast('Word文档已导出！');
        }
    