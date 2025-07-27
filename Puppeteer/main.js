// main.js - Refactored main bot file
const mineflayer = require('mineflayer')
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const autoEat = require('mineflayer-auto-eat').loader
const express = require('express')
const bodyParser = require('body-parser')
const readline = require('readline')

// Import our modules
const config = require('./puppeteerConfig')
const state = require('./puppeteerState')
const armor = require('./puppeteerArmor')
const behaviors = require('./puppeteerBehaviour')

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

// Function to process commands (used by both REST and console)
const processCommand = (commandString, source = 'unknown') => {
    console.log(`Received command from ${source}: ${commandString}`)
    let args = commandString.split(' ')

    if (args[0] === 'start') {
        if (!state.ANY_READY) {
            state.ANY_SHOULD_LOG_IN = true
            console.log("Starting Any")
            initBot()
        }
    }
    
    if (args[0] === 'stop') {
        if (state.ANY_READY) {
            state.ANY_SHOULD_LOG_IN = false
            setTimeout(() => {
                state.bot.quit()
            })
        }
    }

    if (state.ANY_READY) {
        if (args[0] === 'chat') {
            args.splice(0, 1)
            state.bot.chat(args.join(' '))
        } else {
            console.log('Invalid command')
        }
    }

    if (args[0] === 'exit') {
        console.log('Shutting down...')
        if (state.ANY_READY && state.bot) {
            state.bot.quit()
        }
        process.exit(0)
    }
}

// Console input handler
rl.on('line', (input) => {
    const command = input.trim()
    if (command) {
        processCommand(command, 'console')
    }
    rl.prompt()
})

// REST API endpoints
app.get('/AnyUp', (req, res) => {
    res.send(state.ANY_READY)
})

app.post('/Command', async (req, res) => {
    const command = req.body?.command
    if (command) {
        processCommand(command, 'REST API')
    }
    res.send('Command received!')
})

app.listen(config.SERVER_PORT, () => {
    console.log(`Server is running on http://localhost:${config.SERVER_PORT}`)
    rl.prompt()
})

const initBot = () => {
    state.bot = mineflayer.createBot(config.BOT_OPTIONS)
    state.bot.loadPlugin(pathfinder)
    state.bot.loadPlugin(pvp)
    state.bot.loadPlugin(autoEat)

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
        state.movements = new Movements(state.bot)
        state.movements.allow1by1towers = true
        state.movements.canOpenDoors = true
        
        state.bot.autoEat.enableAuto()
        state.bot.autoEat.setOpts(config.AUTO_EAT_OPTIONS)

        // Handle explosion packets safely
        state.bot._client.removeAllListeners('explosion')
        state.bot._client.on('explosion', (packet) => {
            try {
                // Validate knockback data before processing
                if (packet.playerKnockback &&
                    typeof packet.playerKnockback.x === 'number' &&
                    typeof packet.playerKnockback.y === 'number' &&
                    typeof packet.playerKnockback.z === 'number' &&
                    isFinite(packet.playerKnockback.x) &&
                    isFinite(packet.playerKnockback.y) &&
                    isFinite(packet.playerKnockback.z)) {

                    const knockback = new Vec3(
                        packet.playerKnockback.x,
                        packet.playerKnockback.y,
                        packet.playerKnockback.z
                    )
                    state.bot.entity.velocity.add(knockback)
                }
            } catch (err) {
                console.log('Explosion packet error caught:', err.message)
            }
        })
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
    })

    state.bot.on('physicsTick', async () => {
        if (state.bot.pathfinder.isMoving() ||
            state.bot.pathfinder.isMining() ||
            state.bot.pathfinder.isBuilding()) {
            state.updateActivity()
            return
        }
        await botIdle(state.bot)
    })
}

async function botIdle(bot) {
    // Handle combat first (highest priority after explicit tasks)
    const inCombatOrRetreating = await behaviors.handleCombat(bot)
    if (inCombatOrRetreating) {
        state.lastActivityTime = Date.now()
        return
    }

    // Handle item pickup
    const isPickingUp = await behaviors.handleItemPickup(bot)
    if (isPickingUp) {
        state.lastActivityTime = Date.now()
        return
    }

    // Handle wandering behavior second
    await behaviors.handleWandering(bot)

    // If we're currently wandering, don't do normal idle behavior
    if (state.isWandering) {
        return
    }

    // Idling and close entity behaviour
    const entity = bot.nearestEntity()
    if (entity) {
        // Looking around
        await bot.lookAt(entity.position.offset(0,entity.height,0))

        // Let any T-bag. Be polite :)
        let emote = (entity.metadata[0]&0x02) === 0x02
        if (emote != null) bot.setControlState('sneak', emote)
    }

    //Be ready
    await armor.checkAndUpgradeArmor(bot)

    // Any is standing in water
    const pos = bot.entity.position
    const blockAtFeet = bot.blockAt(pos)
    if (blockAtFeet && blockAtFeet.name === 'water') bot.setControlState('jump',true)
    else bot.setControlState('jump', false)
}