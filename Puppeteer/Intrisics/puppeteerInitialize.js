const mineflayer = require('mineflayer')
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const autoEat = require('mineflayer-auto-eat').loader
const collector = require('mineflayer-collectblock').plugin

// Intrinsics
const config = require('./puppeteerConfig')
const state = require('./puppeteerState')
const taskQueue = require('./puppeteerTaskQueue')
const patches = require('./puppeteerMineflayerPatches')

// Import logging
const { createModuleLogger } = require('./puppeteerLogger')
const log = createModuleLogger('Initialize')

// Automata behaviour
const behaviors = require('../Automata/puppeteerBehaviour')
const environment = require('../Automata/puppeteerEnvironment')

const initBot = () => {
    state.bot = mineflayer.createBot(config.BOT_OPTIONS)
    state.bot.loadPlugin(pathfinder)
    state.bot.loadPlugin(pvp)
    state.bot.loadPlugin(autoEat)
    state.bot.loadPlugin(collector)

    // Add this line to prevent the MaxListenersExceededWarning
    state.bot.setMaxListeners(20)

    state.bot.on('login', () => {
        log.info('Successfully logged in')
    })

    state.bot.on('end', () => {
        state.ANY_READY = false
        log.info('Disconnected!!!')
        if (state.ANY_SHOULD_LOG_IN) {
            log.info('Reconnecting in 15 seconds...')
            setTimeout(initBot, 15000)
        }
    })

    state.bot.on('error', (err) => {
        state.ANY_READY = false
        if (err.code === 'ECONNREFUSED') {
            log.error('Connection Refused!!!', { stack: err.stack })
        } else {
            log.error(`Bot error: ${err.message}`, { stack: err.stack })
        }
    })

    state.bot.once('spawn', () => {
        state.ANY_READY = true
        state.mcData = require('minecraft-data')(state.bot.version)

        log.info('Bot spawned successfully')
        log.info('Enabling auto-eat...')
        state.bot.autoEat.enableAuto()
        state.bot.autoEat.setOpts(config.AUTO_EAT_OPTIONS)

        // Handle explosion packets safely
        state.bot._client.removeAllListeners('explosion')
        state.bot._client.on('explosion', patches.explosionHandlerFix)

        log.info('Bot initialization complete - ready for commands')
    })

    state.bot.on('death', () => {
        log.warn('Bot died! Resetting idle behaviors...')
        state.resetAllIdleBehaviors()
    })

    state.bot.on('chat', (username, message) => {
        if (message.includes('time')) {
            const timeSinceActivity = state.getTimeSinceLastActivity() / 1000
            state.bot.chat(`${timeSinceActivity}s have passed since last activity.`)
            log.info(`Time query from ${username}: ${timeSinceActivity}s since last activity`)
        }
        if (message.includes('health')) {
            const healthInfo = `Health: ${state.bot.health}, Hunger: ${state.bot.food}`
            state.bot.chat(`\n${healthInfo}`)
            log.info(`Health query from ${username}: ${healthInfo}`)
        }
        if (message.includes('state')) {
            state.bot.chat(environment.getInternalState(state.bot))
            log.info(`State query from ${username}`)
        }
    })

    state.bot.on('physicsTick', async () => {
        if (state.bot.pathfinder.isMoving() ||
            state.bot.pathfinder.isMining() ||
            state.bot.pathfinder.isBuilding() ||
            taskQueue.isProcessing) {
            state.updateActivity()
            return
        }
        await behaviors.botIdle(state.bot)
    })
}

module.exports = { initBot }