// Intrinsics
const state = require('../Intrisics/puppeteerState')
const taskQueue = require('../Intrisics/puppeteerTaskQueue')
const pinit = require('../Intrisics/puppeteerInitialize')

// Import logging
const { createModuleLogger } = require('./puppeteerLogger')
const log = createModuleLogger('Comms')

// Puppeteer Commands
const mining = require('../Commands/puppeteerMining')
const placement = require('../Commands/puppeteerPlacement')
const crafting = require('../Commands/puppeteerCrating')
const explorer = require("../Commands/puppeteerExplorer")
const following = require('../Commands/puppeteerFollowing')
const hunting = require('../Commands/puppeteerHunting')

// Function to process commands (used by both REST and console)
const processCommand = (commandString, source = 'unknown') => {
    log.info(`Received command from ${source}: ${commandString}`)

    if (!commandString || commandString.trim() === '') {
        log.warn(`Empty command received from ${source}`)
        return { success: false, error: 'Empty command' }
    }

    let args = commandString.split(' ')
    const command = args[0].toLowerCase()

    // Define valid commands for validation
    const validCommands = [
        'start', 'stop', 'queue', 'chat', 'follow', 'unfollow', 'stopfollow',
        'mine', 'place', 'placenear', 'break', 'craftsmall', 'craft',
        'goto', 'randomwalk', 'hunt'
    ]

    try {
        // Bot control commands
        if (command === 'start') {
            if (!state.ANY_READY) {
                state.ANY_SHOULD_LOG_IN = true
                log.info("Starting Any")
                pinit.initBot()
                return { success: true, message: 'Bot starting...' }
            } else {
                log.warn('Bot is already running')
                return { success: false, error: 'Bot is already running' }
            }
        }

        if (command === 'stop') {
            if (state.ANY_READY) {
                state.ANY_SHOULD_LOG_IN = false
                // Cancel any ongoing tasks
                taskQueue.stop()
                taskQueue.clear()
                state.resetAllIdleBehaviors()

                setTimeout(() => {
                    state.bot.quit()
                }, 1000)
                return { success: true, message: 'Bot stopping...' }
            } else {
                log.warn('Bot is not running')
                return { success: false, error: 'Bot is not running' }
            }
        }

        // Queue status commands (don't need to be queued)
        if (command === 'queue') {
            if (args[1] === 'status') {
                const status = taskQueue.getStatus()
                log.info('Queue Status: ' + JSON.stringify(status, null, 2))
                return { success: true, data: status }
            }
            if (args[1] === 'clear') {
                taskQueue.clear()
                log.info('Queue cleared')
                return { success: true, message: 'Queue cleared' }
            }
            if (args[1] === 'stop') {
                taskQueue.stop()
                log.info('Queue stopped')
                return { success: true, message: 'Queue stopped' }
            }
            if (args[1] === 'resume') {
                taskQueue.resume()
                log.info('Queue resumed')
                return { success: true, message: 'Queue resumed' }
            }
            // Invalid queue subcommand
            log.warn(`Invalid queue subcommand: ${args[1] || 'none'}`)
            return { success: false, error: `Invalid queue subcommand. Valid options: status, clear, stop, resume` }
        }

        // Commands that need the bot to be ready
        if (!state.ANY_READY && validCommands.includes(command)) {
            log.warn(`Cannot execute '${command}': Bot is not ready`)
            return { success: false, error: 'Bot is not ready yet' }
        }

        if (command === 'chat') {
            if (args.length < 2) {
                log.warn('Chat command requires a message')
                return { success: false, error: 'Usage: chat <message>' }
            }

            args.splice(0, 1)
            const message = args.join(' ')
            state.bot.chat(message)
            return { success: true, message: `Sent chat: ${message}` }
        }

        if (command === 'follow') {
            if (args.length < 2) {
                log.warn('Follow command requires a player name')
                return { success: false, error: 'Usage: follow <player_name>' }
            }

            const playerName = args[1]
            taskQueue.enqueue({
                name: `follow: ${playerName}`,
                execute: async () => {
                    return await following.followPlayer(state.bot, playerName)
                },
                cancel: following.stopFollowing(state.bot)
            })
            return { success: true, message: `Following ${playerName}` }
        }

        if (command === 'unfollow' || command === 'stopfollow') {
            const result = following.stopFollowing(state.bot)
            log.info(result.message)
            return result
        }

        if (command === 'mine') {
            if (args.length < 3) {
                log.warn('Mine command requires block names and count')
                return { success: false, error: 'Usage: mine <block_name> [block_name2...] <count>' }
            }

            const count = parseInt(args[args.length - 1])
            if (isNaN(count)) {
                log.warn('Last argument must be a number (count)')
                return { success: false, error: 'Last argument must be a number (count)' }
            }

            const blockNames = args.slice(1, -1)
            taskQueue.enqueue({
                name: `mine: ${blockNames.join(', ')} x${count}`,
                execute: async () => {
                    return await mining.mine(state.bot, blockNames, count)
                }
            })
            return { success: true, message: `Mining ${blockNames.join(', ')} x${count}` }
        }

        if (command === 'place') {
            if (args.length < 5) {
                log.warn('Place command requires block name and coordinates')
                return { success: false, error: 'Usage: place <block_name> <x> <y> <z>' }
            }

            const blockName = args[1]
            const x = parseFloat(args[2].replace(",", "."))
            const y = parseFloat(args[3].replace(",", "."))
            const z = parseFloat(args[4].replace(",", "."))

            // Validate coordinates
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                log.warn('Invalid coordinates. X, Y, Z must be numbers')
                return { success: false, error: 'Invalid coordinates. X, Y, Z must be numbers' }
            }

            taskQueue.enqueue({
                name: `place: ${blockName} at (${x}, ${y}, ${z})`,
                execute: async () => {
                    return await placement.place(state.bot, blockName, x, y, z)
                }
            })
            return { success: true, message: `Placing ${blockName} at (${x}, ${y}, ${z})` }
        }

        if (command === 'placenear') {
            if (args.length < 2) {
                log.warn("PlaceNear command requires block name")
                return { success: false, error: 'Usage: placenear <block_name>' }
            }

            const blockName = args[1]
            taskQueue.enqueue({
                name: `placenear: ${blockName} around player`,
                execute: async () => {
                    return await placement.placeNear(state.bot, blockName)
                }
            })
            return { success: true, message: `Placing ${blockName} near player` }
        }

        if (command === 'break') {
            if (args.length < 4) {
                log.warn('Break command requires coordinates')
                return { success: false, error: 'Usage: break <x> <y> <z>' }
            }

            const x = parseFloat(args[1].replace(",", "."))
            const y = parseFloat(args[2].replace(",", "."))
            const z = parseFloat(args[3].replace(",", "."))

            // Validate coordinates
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                log.warn('Invalid coordinates. X, Y, Z must be numbers')
                return { success: false, error: 'Invalid coordinates. X, Y, Z must be numbers' }
            }

            taskQueue.enqueue({
                name: `break: block at (${x}, ${y}, ${z})`,
                execute: async () => {
                    return await placement.breakBlock(state.bot, x, y, z)
                }
            })
            return { success: true, message: `Breaking block at (${x}, ${y}, ${z})` }
        }

        if (command === 'craftsmall') {
            if (args.length < 2) {
                log.warn('CraftSmall command requires item name')
                return { success: false, error: 'Usage: craftsmall <item_name> [amount]' }
            }

            const itemName = args[1]
            const amount = args.length >= 3 ? parseInt(args[2]) : 1

            if (isNaN(amount) || amount <= 0) {
                log.warn('Amount must be a positive number')
                return { success: false, error: 'Amount must be a positive number' }
            }

            taskQueue.enqueue({
                name: `craftsmall: ${itemName} x${amount}`,
                execute: async () => {
                    return await crafting.craftSmall(state.bot, itemName, amount)
                }
            })
            return { success: true, message: `Crafting ${itemName} x${amount} (small)` }
        }

        if (command === 'craft') {
            if (args.length < 2) {
                log.warn('Craft command requires item name')
                return { success: false, error: 'Usage: craft <item_name> [amount]' }
            }

            const itemName = args[1]
            const amount = args.length >= 3 ? parseInt(args[2]) : 1

            if (isNaN(amount) || amount < 1) {
                log.warn('Amount must be a positive number')
                return { success: false, error: 'Amount must be a positive number' }
            }

            taskQueue.enqueue({
                name: `craft: ${itemName} x${amount}`,
                execute: async () => {
                    return await crafting.craft(state.bot, itemName, amount)
                }
            })
            return { success: true, message: `Crafting ${itemName} x${amount}` }
        }

        if (command === 'goto') {
            if (args.length < 2) {
                log.warn('Goto command requires destination')
                return { success: false, error: 'Usage: goto <x> <y> <z> OR goto <blockName>' }
            }

            // Check if it's coordinates (3 numeric arguments) or block name (1 argument)
            if (args.length >= 4) {
                // Coordinate format: goto x y z
                const x = parseFloat(args[1].replace(",", "."))
                const y = parseFloat(args[2].replace(",", "."))
                const z = parseFloat(args[3].replace(",", "."))

                // Validate coordinates
                if (isNaN(x) || isNaN(y) || isNaN(z)) {
                    log.warn('Invalid coordinates. X, Y, Z must be numbers')
                    return { success: false, error: 'Invalid coordinates. X, Y, Z must be numbers' }
                }

                taskQueue.enqueue({
                    name: `goto: (${x}, ${y}, ${z})`,
                    execute: async () => {
                        return await explorer.gotoPosition(state.bot, x, y, z)
                    }
                })
                return { success: true, message: `Going to (${x}, ${y}, ${z})` }
            } else {
                // Block name format: goto blockName
                const blockName = args[1]
                taskQueue.enqueue({
                    name: `goto: ${blockName}`,
                    execute: async () => {
                        return await explorer.gotoBlock(state.bot, blockName)
                    }
                })
                return { success: true, message: `Going to ${blockName}` }
            }
        }

        if (command === 'randomwalk') {
            // Default values
            let minDist = 16
            let maxDist = 32

            // Parse optional distance arguments
            if (args.length >= 3) {
                const parsedMinDist = parseInt(args[1])
                const parsedMaxDist = parseInt(args[2])

                if (!isNaN(parsedMinDist) && !isNaN(parsedMaxDist)) {
                    minDist = parsedMinDist
                    maxDist = parsedMaxDist
                } else {
                    log.warn('Invalid distance values, using defaults (16, 32)')
                }
            }

            log.info(`Random walk with distances: ${minDist} to ${maxDist} blocks`)

            taskQueue.enqueue({
                name: `randomwalk: ${minDist}-${maxDist} blocks`,
                execute: async () => {
                    return await explorer.randomExplore(state.bot, minDist, maxDist)
                }
            })
            return { success: true, message: `Random walking ${minDist}-${maxDist} blocks` }
        }

        if (command === 'hunt') {
            if (args.length < 2) {
                log.warn('Hunt command requires mob type')
                return { success: false, error: 'Usage: hunt <mob_type> [max_count]' }
            }

            const mobType = args[1]
            const maxCount = args.length >= 3 ? parseInt(args[2]) : null

            if (args.length >= 3 && (isNaN(maxCount) || maxCount <= 0)) {
                log.warn('Max count must be a positive number')
                return { success: false, error: 'Max count must be a positive number' }
            }

            taskQueue.enqueue({
                name: `hunt: ${mobType}${maxCount ? ` x${maxCount}` : ' (all)'}`,
                execute: async () => {
                    return await hunting.hunt(state.bot, mobType, maxCount)
                }
            })
            return { success: true, message: `Hunting ${mobType}${maxCount ? ` x${maxCount}` : ' (all)'}` }
        }

        // If we reach here and command wasn't handled, it's invalid
        log.error(`Invalid command received from ${source}: '${command}'`)
        return {
            success: false,
            error: `Invalid command: '${command}'. Valid commands are: ${validCommands.join(', ')}`
        }

    } catch (error) {
        log.error(`Error processing command '${commandString}' from ${source}: ${error.message}`, {
            stack: error.stack
        })
        return {
            success: false,
            error: `Error processing command: ${error.message}`
        }
    }
}

module.exports = { processCommand }