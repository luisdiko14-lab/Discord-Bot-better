alert("You have been rewarded with premium")
// Discord Bot Dashboard Script
class BotDashboard {
    constructor() {
        this.socket = null;
        this.bots = [];
        this.servers = [];
        this.currentServerId = null;
        this.theme = localStorage.getItem('theme') || 'light';
        
        this.init();
    }

    init() {
        this.setupTheme();
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadInitialData();
        this.startKeepAlive();
        this.startSystemInfoPolling();
    }

    setupTheme() {
        document.body.className = this.theme;
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle.querySelector('i');
        
        if (this.theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }

    setupEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // Modal controls
        document.getElementById('addBotBtn').addEventListener('click', () => {
            this.showBotModal();
        });

        document.getElementById('closeBotModal').addEventListener('click', () => {
            this.hideBotModal();
        });

        document.getElementById('cancelBotForm').addEventListener('click', () => {
            this.hideBotModal();
        });

        // Bot form submission
        document.getElementById('botForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleBotSubmission();
        });

        // Server selects
        document.getElementById('moderationServerSelect').addEventListener('change', (e) => {
            this.loadModerationCommands(e.target.value);
        });

        document.getElementById('musicServerSelect').addEventListener('change', (e) => {
            this.loadMusicConfig(e.target.value);
        });

        document.getElementById('antiNukeServerSelect').addEventListener('change', (e) => {
            this.loadAntiNukeConfig(e.target.value);
        });

        // Refresh activity
        document.getElementById('refreshActivity').addEventListener('click', () => {
            this.loadActivityLogs();
        });

        // Click outside modal to close
        document.getElementById('botModal').addEventListener('click', (e) => {
            if (e.target.id === 'botModal') {
                this.hideBotModal();
            }
        });

        // Server modal controls
        document.getElementById('addServerBtn').addEventListener('click', () => {
            this.showServerModal();
        });

        document.getElementById('closeServerModal').addEventListener('click', () => {
            this.hideServerModal();
        });

        document.getElementById('cancelServerForm').addEventListener('click', () => {
            this.hideServerModal();
        });

        document.getElementById('serverForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleServerSubmission();
        });

        document.getElementById('serverModal').addEventListener('click', (e) => {
            if (e.target.id === 'serverModal') {
                this.hideServerModal();
            }
        });
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.body.className = this.theme;
        localStorage.setItem('theme', this.theme);
        
        const icon = document.querySelector('#themeToggle i');
        if (this.theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    loadTabData(tabName) {
        switch (tabName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'bots':
                this.loadBots();
                break;
            case 'servers':
                this.loadServers();
                break;
            case 'logs':
                this.loadActivityLogs();
                break;
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        try {
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus(true);
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus(false);
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.updateConnectionStatus(false);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'connected':
                this.addActivity('WebSocket', 'Connected to dashboard');
                break;
            case 'heartbeat':
                // Handle heartbeat silently
                break;
            case 'bot_status_update':
                this.updateBotStatus(data.botId, data.status);
                break;
            default:
                console.log('Received WebSocket message:', data);
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        const icon = statusEl.querySelector('i');
        const text = statusEl.querySelector('span');
        
        if (connected) {
            statusEl.classList.add('connected');
            statusEl.classList.remove('disconnected');
            text.textContent = 'Connected';
        } else {
            statusEl.classList.add('disconnected');
            statusEl.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadBots(),
                this.loadServers(),
                this.loadDashboardData()
            ]);
            this.populateServerSelects();
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showError('Failed to load initial data');
        }
    }

    async loadDashboardData() {
        try {
            const stats = {
                totalBots: this.bots.length,
                onlineBots: this.bots.filter(bot => bot.status === 'online').length,
                totalServers: this.servers.length,
                activeServers: this.servers.filter(server => server.isActive).length,
                protectedServers: 0, // Will be calculated from anti-nuke configs
                blockedThreats: 0 // Will be from activity logs
            };

            this.updateDashboardStats(stats);
            await this.loadActivityLogs();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('totalBots').textContent = stats.totalBots;
        document.getElementById('onlineBots').textContent = stats.onlineBots;
        document.getElementById('totalServers').textContent = stats.totalServers;
        document.getElementById('activeServers').textContent = stats.activeServers;
        document.getElementById('protectedServers').textContent = stats.protectedServers;
        document.getElementById('blockedThreats').textContent = stats.blockedThreats;
    }

    async loadBots() {
        try {
            const response = await fetch('/api/bots');
            if (!response.ok) throw new Error('Failed to fetch bots');
            
            this.bots = await response.json();
            this.renderBots();
        } catch (error) {
            console.error('Error loading bots:', error);
            this.showError('Failed to load bots');
        }
    }

    renderBots() {
        const container = document.getElementById('botsGrid');
        
        if (this.bots.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <h3>No Bots Found</h3>
                    <p>Add your first bot to get started with the dashboard.</p>
                    <button class="btn btn-primary" onclick="dashboard.showBotModal()">
                        <i class="fas fa-plus"></i>
                        Add Bot
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.bots.map(bot => `
            <div class="bot-card">
                <div class="card-title">
                    <i class="fas fa-robot"></i>
                    ${this.escapeHtml(bot.name)}
                    <span class="status-badge ${bot.status}">${bot.status}</span>
                </div>
                <div class="bot-details">
                    <p><strong>Client ID:</strong> ${this.escapeHtml(bot.clientId)}</p>
                    <p><strong>Prefix:</strong> ${this.escapeHtml(bot.prefix)}</p>
                    <p><strong>Keep Alive:</strong> ${bot.keepAlive ? 'Yes' : 'No'}</p>
                    ${bot.lastPing ? `<p><strong>Last Ping:</strong> ${this.formatDate(bot.lastPing)}</p>` : ''}
                </div>
                <div class="card-actions">
                    <button class="btn btn-sm" onclick="dashboard.editBot(${bot.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-destructive" onclick="dashboard.deleteBot(${bot.id})">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="dashboard.pingBot(${bot.id})">
                        <i class="fas fa-heart"></i>
                        Ping
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadServers() {
        try {
            const response = await fetch('/api/servers');
            if (!response.ok) throw new Error('Failed to fetch servers');
            
            this.servers = await response.json();
            this.renderServers();
        } catch (error) {
            console.error('Error loading servers:', error);
            this.showError('Failed to load servers');
        }
    }

    renderServers() {
        const container = document.getElementById('serversGrid');
        
        if (this.servers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-server"></i>
                    <h3>No Servers Found</h3>
                    <p>Connect your bot to Discord servers to manage them here.</p>
                    <button class="btn btn-primary" onclick="dashboard.showServerModal()" data-testid="button-add-server-empty">
                        <i class="fas fa-plus"></i>
                        Add Server
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.servers.map(server => `
            <div class="server-card" data-testid="card-server-${server.id}">
                <div class="card-title">
                    <i class="fas fa-server"></i>
                    ${this.escapeHtml(server.name)}
                    ${server.isActive ? '<span class="status-badge online">Active</span>' : '<span class="status-badge offline">Inactive</span>'}
                </div>
                <div class="server-details">
                    <p><strong>Guild ID:</strong> ${this.escapeHtml(server.guildId)}</p>
                    <p><strong>Moderation:</strong> ${server.settings?.moderationEnabled ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Music:</strong> ${server.settings?.musicEnabled ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Anti-Nuke:</strong> ${server.settings?.antiNukeEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div class="card-actions">
                    <button class="btn btn-sm" onclick="dashboard.configureServer(${server.id})" data-testid="button-configure-server-${server.id}">
                        <i class="fas fa-cog"></i>
                        Configure
                    </button>
                    <button class="btn btn-sm" onclick="dashboard.editServer(${server.id})" data-testid="button-edit-server-${server.id}">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-destructive" onclick="dashboard.deleteServer(${server.id})" data-testid="button-delete-server-${server.id}">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    showServerModal(server = null) {
        const modal = document.getElementById('serverModal');
        const title = document.getElementById('serverModalTitle');
        const form = document.getElementById('serverForm');
        
        // Populate bot select
        const botSelect = document.getElementById('serverBotId');
        botSelect.innerHTML = '<option value="">Select a bot...</option>';
        this.bots.forEach(bot => {
            const option = document.createElement('option');
            option.value = bot.id;
            option.textContent = bot.name;
            botSelect.appendChild(option);
        });
        
        if (server) {
            title.textContent = 'Edit Server';
            form.elements.name.value = server.name;
            form.elements.guildId.value = server.guildId;
            form.elements.botId.value = server.botId;
            form.elements.isActive.checked = server.isActive;
            form.elements.moderationEnabled.checked = server.settings?.moderationEnabled ?? true;
            form.elements.musicEnabled.checked = server.settings?.musicEnabled ?? true;
            form.elements.antiNukeEnabled.checked = server.settings?.antiNukeEnabled ?? true;
            form.dataset.editId = server.id;
        } else {
            title.textContent = 'Add Server';
            form.reset();
            form.elements.isActive.checked = true;
            form.elements.moderationEnabled.checked = true;
            form.elements.musicEnabled.checked = true;
            form.elements.antiNukeEnabled.checked = true;
            delete form.dataset.editId;
        }
        
        modal.classList.add('show');
    }

    hideServerModal() {
        const modal = document.getElementById('serverModal');
        modal.classList.remove('show');
    }

    async handleServerSubmission() {
        const form = document.getElementById('serverForm');
        const formData = new FormData(form);
        
        const serverData = {
            name: formData.get('name'),
            guildId: formData.get('guildId'),
            botId: parseInt(formData.get('botId')),
            isActive: formData.has('isActive'),
            settings: {
                moderationEnabled: formData.has('moderationEnabled'),
                musicEnabled: formData.has('musicEnabled'),
                antiNukeEnabled: formData.has('antiNukeEnabled')
            }
        };

        try {
            const isEdit = form.dataset.editId;
            const url = isEdit ? `/api/servers/${form.dataset.editId}` : '/api/servers';
            const method = isEdit ? 'PATCH' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serverData)
            });

            if (!response.ok) {
                throw new Error(`Failed to ${isEdit ? 'update' : 'create'} server`);
            }

            const server = await response.json();
            
            if (isEdit) {
                const index = this.servers.findIndex(s => s.id == form.dataset.editId);
                if (index !== -1) {
                    this.servers[index] = server;
                }
            } else {
                this.servers.push(server);
            }

            this.renderServers();
            this.populateServerSelects();
            this.hideServerModal();
            this.showSuccess(`Server ${isEdit ? 'updated' : 'created'} successfully`);
            this.addActivity('Server Management', `Server ${server.name} ${isEdit ? 'updated' : 'created'}`);

        } catch (error) {
            console.error('Error saving server:', error);
            this.showError(error.message);
        }
    }

    async editServer(serverId) {
        const server = this.servers.find(s => s.id === serverId);
        if (server) {
            this.showServerModal(server);
        }
    }

    async deleteServer(serverId) {
        if (!confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete server');
            }

            this.servers = this.servers.filter(server => server.id !== serverId);
            this.renderServers();
            this.populateServerSelects();
            this.showSuccess('Server deleted successfully');
            this.addActivity('Server Management', 'Server deleted');

        } catch (error) {
            console.error('Error deleting server:', error);
            this.showError('Failed to delete server');
        }
    }

    configureServer(serverId) {
        this.currentServerId = serverId;
        const server = this.servers.find(s => s.id === serverId);
        if (server) {
            this.showSuccess(`Configuring server: ${server.name}`);
        }
    }

    startSystemInfoPolling() {
        this.loadSystemInfo();
        setInterval(() => this.loadSystemInfo(), 5000);
    }

    async loadSystemInfo() {
        try {
            const response = await fetch('/api/system-info');
            if (!response.ok) throw new Error('Failed to fetch system info');
            
            const info = await response.json();
            this.updateSystemInfo(info);
        } catch (error) {
            console.error('Error loading system info:', error);
        }
    }

    updateSystemInfo(info) {
        document.getElementById('cpuModel').textContent = info.cpu.model;
        document.getElementById('cpuCores').textContent = `${info.cpu.cores} Cores`;
        document.getElementById('ramTotal').textContent = `${info.ram.total} GB`;
        
        document.getElementById('cpuUsagePercent').textContent = `${info.cpu.usage}%`;
        document.getElementById('cpuUsageBar').style.width = `${info.cpu.usage}%`;
        
        document.getElementById('ramUsagePercent').textContent = `${info.ram.usagePercent}%`;
        document.getElementById('ramUsageBar').style.width = `${info.ram.usagePercent}%`;
        document.getElementById('ramDetails').textContent = `${info.ram.used} / ${info.ram.total} GB`;
        
        document.getElementById('systemUptime').textContent = info.uptime.formatted;
    }

    populateServerSelects() {
        const selects = [
            'moderationServerSelect',
            'musicServerSelect', 
            'antiNukeServerSelect',
            'commandsServerSelect',
            'logsServerSelect'
        ];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                // Keep first option, remove others
                const firstOption = select.firstElementChild;
                select.innerHTML = '';
                select.appendChild(firstOption);
                
                // Add server options
                this.servers.forEach(server => {
                    const option = document.createElement('option');
                    option.value = server.id;
                    option.textContent = server.name;
                    select.appendChild(option);
                });
            }
        });

        // Also populate bot select for logs
        const botSelect = document.getElementById('logsBotSelect');
        if (botSelect) {
            const firstOption = botSelect.firstElementChild;
            botSelect.innerHTML = '';
            botSelect.appendChild(firstOption);
            
            this.bots.forEach(bot => {
                const option = document.createElement('option');
                option.value = bot.id;
                option.textContent = bot.name;
                botSelect.appendChild(option);
            });
        }
    }

    async loadActivityLogs() {
        try {
            const response = await fetch('/api/logs?limit=20');
            if (!response.ok) throw new Error('Failed to fetch activity logs');
            
            const logs = await response.json();
            this.renderActivityLogs(logs);
        } catch (error) {
            console.error('Error loading activity logs:', error);
        }
    }

    renderActivityLogs(logs) {
        const activityList = document.getElementById('activityList');
        const logsContainer = document.getElementById('logsContainer');
        
        if (logs.length === 0) {
            const emptyState = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No Activity Logs</h3>
                    <p>Activity will appear here as your bots perform actions.</p>
                </div>
            `;
            
            if (activityList) {
                activityList.innerHTML = emptyState;
            }
            if (logsContainer) {
                logsContainer.innerHTML = emptyState;
            }
            return;
        }

        const logHTML = logs.map(log => {
            if (activityList) {
                // Simplified version for dashboard
                return `
                    <div class="activity-item">
                        <i class="fas fa-info-circle"></i>
                        <span>${this.escapeHtml(log.action)}</span>
                        <time class="activity-time">${this.formatRelativeTime(log.timestamp)}</time>
                    </div>
                `;
            } else {
                // Detailed version for logs tab
                return `
                    <div class="log-entry">
                        <div class="log-time">${this.formatDate(log.timestamp)}</div>
                        <div class="log-action">${this.escapeHtml(log.action)}</div>
                        <div class="log-details">
                            ${log.userId ? `User: ${log.userId}` : ''}
                            ${log.details ? `Details: ${JSON.stringify(log.details)}` : ''}
                        </div>
                    </div>
                `;
            }
        }).join('');

        if (activityList) {
            activityList.innerHTML = logHTML;
        }
        if (logsContainer) {
            logsContainer.innerHTML = logHTML;
        }
    }

    showBotModal(bot = null) {
        const modal = document.getElementById('botModal');
        const title = document.getElementById('botModalTitle');
        const form = document.getElementById('botForm');
        
        if (bot) {
            title.textContent = 'Edit Bot';
            form.elements.name.value = bot.name;
            form.elements.token.value = bot.token;
            form.elements.clientId.value = bot.clientId;
            form.elements.prefix.value = bot.prefix;
            form.elements.keepAlive.checked = bot.keepAlive;
            form.dataset.editId = bot.id;
        } else {
            title.textContent = 'Add Bot';
            form.reset();
            form.elements.prefix.value = '!';
            form.elements.keepAlive.checked = true;
            delete form.dataset.editId;
        }
        
        modal.classList.add('show');
    }

    hideBotModal() {
        const modal = document.getElementById('botModal');
        modal.classList.remove('show');
    }

    async handleBotSubmission() {
        const form = document.getElementById('botForm');
        const formData = new FormData(form);
        
        const botData = {
            name: formData.get('name'),
            token: formData.get('token'),
            clientId: formData.get('clientId'),
            prefix: formData.get('prefix'),
            keepAlive: formData.has('keepAlive')
        };

        try {
            const isEdit = form.dataset.editId;
            const url = isEdit ? `/api/bots/${form.dataset.editId}` : '/api/bots';
            const method = isEdit ? 'PATCH' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(botData)
            });

            if (!response.ok) {
                throw new Error(`Failed to ${isEdit ? 'update' : 'create'} bot`);
            }

            const bot = await response.json();
            
            if (isEdit) {
                const index = this.bots.findIndex(b => b.id == form.dataset.editId);
                if (index !== -1) {
                    this.bots[index] = bot;
                }
            } else {
                this.bots.push(bot);
            }

            this.renderBots();
            this.hideBotModal();
            this.showSuccess(`Bot ${isEdit ? 'updated' : 'created'} successfully`);
            this.addActivity('Bot Management', `Bot ${bot.name} ${isEdit ? 'updated' : 'created'}`);

        } catch (error) {
            console.error('Error saving bot:', error);
            this.showError(error.message);
        }
    }

    async editBot(botId) {
        const bot = this.bots.find(b => b.id === botId);
        if (bot) {
            this.showBotModal(bot);
        }
    }

    async deleteBot(botId) {
        if (!confirm('Are you sure you want to delete this bot? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/bots/${botId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete bot');
            }

            this.bots = this.bots.filter(bot => bot.id !== botId);
            this.renderBots();
            this.showSuccess('Bot deleted successfully');
            this.addActivity('Bot Management', 'Bot deleted');

        } catch (error) {
            console.error('Error deleting bot:', error);
            this.showError('Failed to delete bot');
        }
    }

    async pingBot(botId) {
        try {
            const response = await fetch(`/api/bots/${botId}/ping`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'online' })
            });

            if (!response.ok) {
                throw new Error('Failed to ping bot');
            }

            // Update bot status locally
            const bot = this.bots.find(b => b.id === botId);
            if (bot) {
                bot.status = 'online';
                bot.lastPing = new Date().toISOString();
                this.renderBots();
            }

            this.showSuccess('Bot pinged successfully');
            this.addActivity('Bot Status', `Bot ${bot?.name || botId} pinged`);

        } catch (error) {
            console.error('Error pinging bot:', error);
            this.showError('Failed to ping bot');
        }
    }

    async loadModerationCommands(serverId) {
        if (!serverId) return;
        
        try {
            const response = await fetch(`/api/servers/${serverId}/moderation`);
            if (!response.ok) throw new Error('Failed to fetch moderation commands');
            
            const commands = await response.json();
            this.renderModerationCommands(commands);
        } catch (error) {
            console.error('Error loading moderation commands:', error);
            this.showError('Failed to load moderation commands');
        }
    }

    renderModerationCommands(commands) {
        const container = document.getElementById('moderationCommands');
        
        if (commands.length === 0) {
            container.innerHTML = `
                <div class="config-section">
                    <h3><i class="fas fa-shield-alt"></i> Default Moderation Commands</h3>
                    <p>No custom moderation commands configured. Default commands are available:</p>
                    <div class="default-commands">
                        <div class="command-item">
                            <strong>!ban</strong> - Ban a user (Requires BAN_MEMBERS permission)
                        </div>
                        <div class="command-item">
                            <strong>!kick</strong> - Kick a user (Requires KICK_MEMBERS permission)
                        </div>
                        <div class="command-item">
                            <strong>!mute</strong> - Mute a user (Requires MANAGE_ROLES permission)
                        </div>
                        <div class="command-item">
                            <strong>!warn</strong> - Warn a user (Requires MODERATE_MEMBERS permission)
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = commands.map(cmd => `
            <div class="config-section">
                <h3>
                    <i class="fas fa-terminal"></i>
                    ${this.escapeHtml(cmd.command)}
                    ${cmd.isEnabled ? '<span class="status-badge online">Enabled</span>' : '<span class="status-badge offline">Disabled</span>'}
                </h3>
                <div class="config-details">
                    <p><strong>Required Permission:</strong> ${this.escapeHtml(cmd.requiredPermission)}</p>
                    ${cmd.requiredRoles?.length ? `<p><strong>Required Roles:</strong> ${cmd.requiredRoles.join(', ')}</p>` : ''}
                    ${cmd.cooldownSeconds ? `<p><strong>Cooldown:</strong> ${cmd.cooldownSeconds}s</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    async loadMusicConfig(serverId) {
        if (!serverId) return;
        
        try {
            const response = await fetch(`/api/servers/${serverId}/music`);
            if (!response.ok) {
                // If no config exists, show default form
                this.renderMusicConfig(null);
                return;
            }
            
            const config = await response.json();
            this.renderMusicConfig(config);
        } catch (error) {
            console.error('Error loading music config:', error);
            this.renderMusicConfig(null);
        }
    }

    renderMusicConfig(config) {
        const container = document.getElementById('musicConfig');
        
        const defaultConfig = {
            youtubeEnabled: true,
            spotifyEnabled: true,
            maxQueueSize: 100,
            maxTrackDuration: 3600,
            volume: 50,
            settings: {
                autoLeave: true,
                autoLeaveTimeout: 300,
                loopMode: 'off',
                shuffleEnabled: false
            }
        };

        const currentConfig = config || defaultConfig;

        container.innerHTML = `
            <div class="config-section">
                <h3><i class="fas fa-music"></i> Music Bot Configuration</h3>
                <div class="config-grid">
                    <div class="config-item">
                        <label>YouTube Support</label>
                        <label class="toggle-switch">
                            <input type="checkbox" ${currentConfig.youtubeEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="config-item">
                        <label>Spotify Support</label>
                        <label class="toggle-switch">
                            <input type="checkbox" ${currentConfig.spotifyEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="config-item">
                        <label>Auto Leave Empty Channels</label>
                        <label class="toggle-switch">
                            <input type="checkbox" ${currentConfig.settings?.autoLeave ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="config-item">
                        <label>Shuffle Enabled</label>
                        <label class="toggle-switch">
                            <input type="checkbox" ${currentConfig.settings?.shuffleEnabled ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label>Max Queue Size</label>
                    <input type="number" value="${currentConfig.maxQueueSize}" min="1" max="1000">
                </div>
                <div class="form-group">
                    <label>Max Track Duration (seconds)</label>
                    <input type="number" value="${currentConfig.maxTrackDuration}" min="60" max="7200">
                </div>
                <div class="form-group">
                    <label>Default Volume</label>
                    <input type="range" min="1" max="100" value="${currentConfig.volume}">
                    <span>${currentConfig.volume}%</span>
                </div>
            </div>
        `;
    }

    async loadAntiNukeConfig(serverId) {
        if (!serverId) return;
        
        try {
            const response = await fetch(`/api/servers/${serverId}/antinuke`);
            if (!response.ok) {
                this.renderAntiNukeConfig(null);
                return;
            }
            
            const config = await response.json();
            this.renderAntiNukeConfig(config);
        } catch (error) {
            console.error('Error loading anti-nuke config:', error);
            this.renderAntiNukeConfig(null);
        }
    }

    renderAntiNukeConfig(config) {
        const container = document.getElementById('antiNukeConfig');
        
        const defaultConfig = {
            isEnabled: true,
            protectionLevel: 'medium',
            triggers: {
                channelDelete: { enabled: true, limit: 3, timeframe: 60 },
                channelCreate: { enabled: true, limit: 5, timeframe: 60 },
                roleDelete: { enabled: true, limit: 3, timeframe: 60 },
                roleCreate: { enabled: true, limit: 5, timeframe: 60 },
                memberBan: { enabled: true, limit: 5, timeframe: 60 },
                memberKick: { enabled: true, limit: 10, timeframe: 60 },
                webhookCreate: { enabled: true, limit: 2, timeframe: 60 },
                botAdd: { enabled: true, limit: 1, timeframe: 300 }
            },
            actions: {
                removePermissions: true,
                banUser: true,
                kickUser: false,
                removeRoles: true,
                lockdown: true,
                notifyOwner: true
            }
        };

        const currentConfig = config || defaultConfig;

        container.innerHTML = `
            <div class="config-section">
                <h3><i class="fas fa-shield-virus"></i> Anti-Nuke Protection</h3>
                <div class="config-item">
                    <label>Protection Enabled</label>
                    <label class="toggle-switch">
                        <input type="checkbox" ${currentConfig.isEnabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="form-group">
                    <label>Protection Level</label>
                    <select>
                        <option value="low" ${currentConfig.protectionLevel === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${currentConfig.protectionLevel === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${currentConfig.protectionLevel === 'high' ? 'selected' : ''}>High</option>
                        <option value="extreme" ${currentConfig.protectionLevel === 'extreme' ? 'selected' : ''}>Extreme</option>
                    </select>
                </div>
            </div>

            <div class="config-section">
                <h3><i class="fas fa-exclamation-triangle"></i> Trigger Limits</h3>
                <div class="trigger-grid">
                    ${Object.entries(currentConfig.triggers).map(([key, trigger]) => `
                        <div class="trigger-item">
                            <h4>${this.formatTriggerName(key)}</h4>
                            <div class="trigger-controls">
                                <label class="toggle-switch">
                                    <input type="checkbox" ${trigger.enabled ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                                <input type="number" value="${trigger.limit}" min="1" max="100" placeholder="Limit">
                                <input type="number" value="${trigger.timeframe}" min="10" max="3600" placeholder="Timeframe (s)">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="config-section">
                <h3><i class="fas fa-hammer"></i> Protection Actions</h3>
                <div class="config-grid">
                    ${Object.entries(currentConfig.actions).map(([key, enabled]) => `
                        <div class="config-item">
                            <label>${this.formatActionName(key)}</label>
                            <label class="toggle-switch">
                                <input type="checkbox" ${enabled ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    formatTriggerName(key) {
        const names = {
            channelDelete: 'Channel Deletion',
            channelCreate: 'Channel Creation',
            roleDelete: 'Role Deletion',
            roleCreate: 'Role Creation',
            memberBan: 'Member Bans',
            memberKick: 'Member Kicks',
            webhookCreate: 'Webhook Creation',
            botAdd: 'Bot Addition'
        };
        return names[key] || key;
    }

    formatActionName(key) {
        const names = {
            removePermissions: 'Remove Permissions',
            banUser: 'Ban User',
            kickUser: 'Kick User',
            removeRoles: 'Remove Roles',
            lockdown: 'Server Lockdown',
            notifyOwner: 'Notify Owner'
        };
        return names[key] || key;
    }

    startKeepAlive() {
        // Send keep-alive ping every 25 seconds
        setInterval(async () => {
            try {
                const response = await fetch('/ping', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ source: 'dashboard' })
                });
                
                if (response.ok) {
                    console.log('Keep-alive ping successful');
                } else {
                    console.warn('Keep-alive ping failed');
                }
            } catch (error) {
                console.error('Keep-alive ping error:', error);
            }
        }, 25000);
    }

    addActivity(action, details) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>${this.escapeHtml(action)}: ${this.escapeHtml(details)}</span>
            <time class="activity-time">Just now</time>
        `;

        activityList.insertBefore(activityItem, activityList.firstChild);

        // Keep only the last 10 activities
        while (activityList.children.length > 10) {
            activityList.removeChild(activityList.lastChild);
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>
            <button onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }
}

// Add notification styles
const notificationStyles = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1001;
    animation: slideInRight 0.3s ease-out;
    min-width: 300px;
}

.notification.success {
    border-left: 4px solid var(--online);
}

.notification.error {
    border-left: 4px solid var(--destructive);
}

.notification button {
    background: none;
    border: none;
    color: var(--muted-foreground);
    cursor: pointer;
    margin-left: auto;
    padding: 0.25rem;
}

.notification button:hover {
    color: var(--foreground);
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

.empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--muted-foreground);
}

.empty-state i {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: var(--muted-foreground);
}

.empty-state h3 {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: var(--foreground);
}

.default-commands {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
}

.command-item, .default-commands .command-item {
    padding: 0.75rem;
    background: var(--muted);
    border-radius: 0.5rem;
    text-align: left;
}

.trigger-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.trigger-item {
    background: var(--muted);
    padding: 1rem;
    border-radius: 0.5rem;
}

.trigger-item h4 {
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
}

.trigger-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.trigger-controls input[type="number"] {
    width: 80px;
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    background: var(--background);
    color: var(--foreground);
}
`;

// Inject notification styles
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new BotDashboard();
});

// Export for global access
window.BotDashboard = BotDashboard;