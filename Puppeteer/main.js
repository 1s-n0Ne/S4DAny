// main.js - Refactored main bot file
const express = require('express')
const bodyParser = require('body-parser')
const readline = require('readline')

// Import logging
const { createModuleLogger } = require('./Intrisics/puppeteerLogger')
const log = createModuleLogger('Main')

// Import Puppeteer modules
// Intrinsics
const config = require('./Intrisics/puppeteerConfig')
const state = require('./Intrisics/puppeteerState')
const taskQueue = require('./Intrisics/puppeteerTaskQueue')
const comms = require('./Intrisics/puppeteerComms')

// For internal state
const environment = require('./Automata/puppeteerEnvironment')

// Express app setup
const app = express()
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

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

// REST API endpoints
app.get('/AnyUp', (req, res) => {
    res.send(state.ANY_READY)
})

app.get('/GetInernal',(req, res) => {
    try {
        res.send(environment.getInternalState(state.bot))
    } catch(e) {
        log.error(`Failed to get internal state: ${e.message}`)
        res.status(500).send('Any is not ready')
    }
})

app.post('/Command', async (req, res) => {
    const command = req.body?.command
    if (command) {
        comms.processCommand(command, 'REST API')
    }
    res.send('Command received!')
})

app.listen(config.SERVER_PORT, () => {
    log.info(`Server is running on http://localhost:${config.SERVER_PORT}`)
    rl.prompt()
})