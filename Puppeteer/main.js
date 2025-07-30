// main.js - Refactored main bot file
const mineflayer = require('mineflayer')
const { pathfinder, Movements } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin
const autoEat = require('mineflayer-auto-eat').loader
const collector = require('mineflayer-collectblock').plugin
const express = require('express')
const bodyParser = require('body-parser')
const readline = require('readline')
const { Vec3 } = require('vec3')

// Import Puppeteer modules
// Intrinsics
const config = require('./Intrisics/puppeteerConfig')
const state = require('./Intrisics/puppeteerState')
const taskQueue = require('./Intrisics/puppeteerTaskQueue')
// Automata behaviour
const armor = require('./Automata/puppeteerArmor')
const behaviors = require('./Automata/puppeteerBehaviour')
const environment = require('./Automata/puppeteerEnvironment')

// Puppeteer Commands
const mining = require('./Commands/puppeteerMining')
const placement = require('./Commands/puppeteerPlacement')
const crafting = require('./Commands/puppeteerCrating')

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
    console.log(`[TaskQueue] Started: ${task.name}`)
})

taskQueue.on('taskCompleted', (task) => {
    console.log(`[TaskQueue] Completed: ${task.name}`)
})

taskQueue.on('taskFailed', (task, error) => {
    console.log(`[TaskQueue] Failed: ${task.name} - ${error.message}`)
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
            // Cancel any ongoing tasks
            taskQueue.stop()
            taskQueue.clear()
            state.resetAllIdleBehaviors()

            setTimeout(() => {
                state.bot.quit()
            }, 1000)
        }
    }

    if (args[0] === 'exit') {
        console.log('Shutting down...')
        if (state.ANY_READY && state.bot) {
            taskQueue.stop()
            taskQueue.clear()
            state.bot.quit()
        }
        process.exit(0)
    }

        // Queue status commands (don't need to be queued)
    if (args[0] === 'queue') {
        if (args[1] === 'status') {
            const status = taskQueue.getStatus()
            console.log('Queue Status:', JSON.stringify(status, null, 2))
            return
        }
        if (args[1] === 'clear') {
            taskQueue.clear()
            console.log('Queue cleared')
            return
        }
        if (args[1] === 'stop') {
            taskQueue.stop()
            console.log('Queue stopped')
            return
        }
        if (args[1] === 'resume') {
            taskQueue.resume()
            console.log('Queue resumed')
            return
        }
    }

    // Commands that need the bot to be ready
    if (!state.ANY_READY) {
        console.log('Bot is not ready yet')
        return
    }

    if (args[0] === 'chat') {
        args.splice(0, 1)
        const message = args.join(' ')

        state.bot.chat(message)
    }

    if (args[0] === 'mine') {
        if (args.length < 3) {
            console.log('Usage: mine <block_name> [block_name2...] <count>')
            return
        }

        const count = parseInt(args[args.length - 1])
        if (isNaN(count)) {
            console.log('Last argument must be a number (count)')
            return
        }

        const blockNames = args.slice(1, -1)

        taskQueue.enqueue({
            name: `mine: ${blockNames.join(', ')} x${count}`,
            execute: async () => {
                return await mining.mine(state.bot, blockNames, count)
            }
        })
    }

    if (args[0] === 'place') {
        if (args.length < 5) {
            console.log('Usage: place <block_name> <x> <y> <z>')
            return
        }

        const blockName = args[1]
        const x = parseFloat(args[2].replace(",", "."))
        const y = parseFloat(args[3].replace(",", "."))
        const z = parseFloat(args[4].replace(",", "."))

        // Validate coordinates
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            console.log('Invalid coordinates. X, Y, Z must be numbers')
            return
        }

        taskQueue.enqueue({
            name: `place: ${blockName} at (${x}, ${y}, ${z})`,
            execute: async () => {
                return await placement.place(state.bot, blockName, x, y, z)
            }
        })
    }

    if (args[0] === 'placenear') {
        if (args.length < 2) {
            console.log("Usage: placenear [block_name]")
            return
        }
        const blockName = args[1]
        taskQueue.enqueue({
            name: `placenear: ${blockName} around player`,
            execute: async () => {
                return await placement.placeNear(state.bot, blockName)
            }
        })
    }

    if (args[0] === 'break') {
        if (args.length < 4) {
            console.log('Usage: break <x> <y> <z>')
            return
        }

        const x = parseFloat(args[1].replace(",", "."))
        const y = parseFloat(args[2].replace(",", "."))
        const z = parseFloat(args[3].replace(",", "."))

        // Validate coordinates
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            console.log('Invalid coordinates. X, Y, Z must be numbers')
            return
        }

        taskQueue.enqueue({
            name: `break: block at (${x}, ${y}, ${z})`,
            execute: async () => {
                return await placement.breakBlock(state.bot, x, y, z)
            }
        })
    }

    if (args[0] === 'craftsmall') {
        if (args.length < 2) {
            console.log('Usage: craftsmall [item_name] [amount]')
            return
        }

        const itemName = args[1]
        const amount = args.length >= 3 ? parseInt(args[2]) : 1

        if (isNaN(amount) || amount <= 0) {
            console.log('Amount must be a positive number')
            return
        }

        taskQueue.enqueue({
            name: `craftsmall: ${itemName} x${amount}`,
            execute: async () => {
                return await crafting.craftSmall(state.bot, itemName, amount)
            }
        })
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