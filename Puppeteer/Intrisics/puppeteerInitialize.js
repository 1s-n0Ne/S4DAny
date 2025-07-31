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
        console.log('Successfully logged in')
    })

    state.bot.on('end', () => {
        state.ANY_READY = false
        console.log('Disconnected!!!')
        if (state.ANY_SHOULD_LOG_IN) {
            setTimeout(initBot, 15000)
        }
    })

    state.bot.on('error', (err) => {
        state.ANY_READY = false
        if (err.code === 'ECONNREFUSED') {
            console.log('Connection Refused!!!')
        }
    })

    state.bot.once('spawn', () => {
        state.ANY_READY = true
        state.mcData = require('minecraft-data')(state.bot.version)

        state.bot.autoEat.enableAuto()
        state.bot.autoEat.setOpts(config.AUTO_EAT_OPTIONS)

        // Handle explosion packets safely
        state.bot._client.removeAllListeners('explosion')
        state.bot._client.on('explosion', patches.explosionHandlerFix)
    })

    state.bot.on('death', () => {
        state.resetAllIdleBehaviors()
    })

    state.bot.on('chat', (username, message) => {
        if (message.includes('time')) {
            state.bot.chat(`${state.getTimeSinceLastActivity() / 1000}s have passed since last activity.`)
        }
        if (message.includes('health')) {
            state.bot.chat(`\nHealth: ${state.bot.health}\nHunger: ${state.bot.food}`)
        }
        if (message.includes('state')) {
            state.bot.chat(environment.getInternalState(state.bot))
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