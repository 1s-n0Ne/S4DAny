// main.js - Refactored main bot file with WebSocket integration
const readline = require('readline')

// Import logging
const { createModuleLogger } = require('./System/puppeteerLogger')
const log = createModuleLogger('Main')

// Import Puppeteer modules
// Intrinsics
const taskQueue = require('./Intrisics/puppeteerTaskQueue')
const comms = require('./System/puppeteerComms')
const { PuppeteerWebSocketServer } = require('./System/puppeteerWebSocket')

// Create readline interface for console input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'Bot> '
})

// Setup task queue event listeners
taskQueue.on('taskStarted', (task) => {
    log.info(`[TaskQueue] Started: ${task.name}`)
})

taskQueue.on('taskCompleted', (task) => {
    log.info(`[TaskQueue] Completed: ${task.name}`)
})

taskQueue.on('taskFailed', (task, error) => {
    log.error(`[TaskQueue] Failed: ${task.name} - ${error.message}`)
})

// Console input handler
rl.on('line', (input) => {
    const command = input.trim()
    if (command) {
        comms.processCommand(command, 'console')
    }
    rl.prompt()
})

// Start websocket server
const wsServer = new PuppeteerWebSocketServer(8080)
wsServer.start()

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down servers...')
    wsServer.stop()
    setTimeout(() => {
        process.exit(0)
    }, 1000)
})

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down servers...')
    wsServer.stop()
    setTimeout(() => {
        process.exit(0)
    }, 1000)
})

log.info('All servers started. Ready for connections.')
rl.prompt()