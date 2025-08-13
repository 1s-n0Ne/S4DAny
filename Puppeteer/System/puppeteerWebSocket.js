// Puppeteer/Intrisics/puppeteerWebSocket.js - WebSocket server module (single connection)
const WebSocket = require('ws');
const { createModuleLogger } = require('./puppeteerLogger');

const log = createModuleLogger('WebSocket');

class PuppeteerWebSocketServer {
    constructor(port = 8080) {
        this.port = port;
        this.wss = null;
        this.client = null;  // Single client instead of Set
        this.isShuttingDown = false;
    }

    start() {
        this.wss = new WebSocket.Server({
            port: this.port,
            host: 'localhost'
        });

        log.info(`WebSocket server starting on ws://localhost:${this.port}`);

        this.wss.on('connection', (ws, req) => {
            // Reject connection if we already have a client
            if (this.client !== null) {
                log.warn(`Rejecting new connection from ${req.socket.remoteAddress} - already have a client`);
                ws.close(1013, 'Server already has a connection');
                return;
            }

            log.info(`Accepted connection from ${req.socket.remoteAddress}`);
            this.client = ws;

            // Send welcome message
            this.sendToClient({
                type: 'welcome',
                message: 'Connected to Puppeteer WebSocket server',
                timestamp: Date.now()
            });

            // Handle incoming messages
            ws.on('message', (data) => {
                this.handleMessage(data);
            });

            // Handle connection close
            ws.on('close', (code, reason) => {
                log.info(`WebSocket connection closed: ${code} ${reason}`);
                this.client = null;
            });

            // Handle errors
            ws.on('error', (error) => {
                log.error(`WebSocket client error: ${error.message}`);
                this.client = null;
            });
        });

        this.wss.on('error', (error) => {
            log.error(`WebSocket server error: ${error.message}`);
        });

        // Set up task queue event listeners
        this.setupTaskQueueListeners();

        log.info('WebSocket server ready for connections');
    }

    setupTaskQueueListeners() {
        // Import here to avoid circular dependency
        const taskQueue = require('../Intrisics/puppeteerTaskQueue');

        // Task lifecycle events
        const events = [
            ['taskAdded', 'task_added'],
            ['taskStarted', 'task_started'],
            ['taskCompleted', 'task_completed'],
            ['queueStopped', 'queue_stopped'],
            ['queueResumed', 'queue_resumed'],
            ['queueCleared', 'queue_cleared']
        ];

        events.forEach(([eventName, messageType]) => {
            taskQueue.on(eventName, (task) => {
                if (!this.isShuttingDown) {
                    this.sendToClient({
                        type: messageType,
                        task: task ? {
                            name: task.name,
                            createdAt: task.createdAt || Date.now()
                        } : undefined,
                        timestamp: Date.now()
                    });
                }
            });
        });

        // Special handling for task failed (includes error)
        taskQueue.on('taskFailed', (task, error) => {
            if (!this.isShuttingDown) {
                this.sendToClient({
                    type: 'task_failed',
                    task: {
                        name: task.name,
                        createdAt: task.createdAt || Date.now()
                    },
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        });
    }

    handleMessage(data) {
        if (this.isShuttingDown) return;

        try {
            const message = JSON.parse(data.toString());
            log.info(`Received message type: ${message.type}`);

            const { type, id: messageId } = message;

            // Handle different message types
            switch (type) {
                case 'command':
                    this.handleCommand(message);
                    break;
                case 'queue_status':
                    this.handleQueueStatus(messageId);
                    break;
                case 'bot_status':
                    this.handleBotStatus(messageId);
                    break;
                case 'ping':
                    this.sendToClient({
                        type: 'pong',
                        messageId: messageId,
                        timestamp: Date.now()
                    });
                    break;
                default:
                    this.sendToClient({
                        type: 'error',
                        messageId: messageId,
                        error: `Unknown message type: ${type}`,
                        timestamp: Date.now()
                    });
            }

        } catch (error) {
            log.error(`Error parsing message: ${error.message}`);
            this.sendToClient({
                type: 'error',
                message: 'Invalid JSON received',
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    handleCommand(message) {
        const { id: messageId, command } = message;

        if (!command) {
            this.sendToClient({
                type: 'command_error',
                messageId: messageId,
                error: 'No command specified',
                timestamp: Date.now()
            });
            return;
        }

        log.info(`Processing command via WebSocket: ${command}`);

        // Import here to avoid circular dependency
        const comms = require('./puppeteerComms');

        try {
            const result = comms.processCommand(command, 'WebSocket');

            this.sendToClient({
                type: result.success ? 'command_success' : 'command_error',
                messageId: messageId,
                command: command,
                message: result.message,
                error: result.error,
                data: result.data,
                timestamp: Date.now()
            });

        } catch (error) {
            log.error(`Command processing error: ${error.message}`);
            this.sendToClient({
                type: 'command_error',
                messageId: messageId,
                command: command,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    handleQueueStatus(messageId) {
        const taskQueue = require('../Intrisics/puppeteerTaskQueue');
        const status = taskQueue.getStatus();

        this.sendToClient({
            type: 'queue_status_response',
            messageId: messageId,
            status: status,
            timestamp: Date.now()
        });
    }

    handleBotStatus(messageId) {
        const state = require('../Intrisics/puppeteerState');
        let botStatus = {
            ready: state.ANY_READY,
        };

        if (state.ANY_READY && state.bot) {
            const environment = require('../Automata/puppeteerEnvironment');
            try {
                botStatus.internalState = environment.getInternalState(state.bot);
            } catch (error) {
                botStatus.internalStateError = error.message;
            }
        }

        this.sendToClient({
            type: 'bot_status_response',
            messageId: messageId,
            status: botStatus,
            timestamp: Date.now()
        });
    }

    sendToClient(message) {
        if (this.client && this.client.readyState === WebSocket.OPEN && !this.isShuttingDown) {
            try {
                this.client.send(JSON.stringify(message));
            } catch (error) {
                log.error(`Failed to send message: ${error.message}`);
            }
        }
    }

    stop() {
        if (this.wss) {
            this.isShuttingDown = true;

            // Close client connection if exists
            if (this.client) {
                this.client.close(1001, 'Server shutting down');
                this.client = null;
            }

            // Close the server
            this.wss.close()
        }
    }

    isConnected() {
        return this.client !== null && this.client.readyState === WebSocket.OPEN;
    }
}

module.exports = { PuppeteerWebSocketServer };