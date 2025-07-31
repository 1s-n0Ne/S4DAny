// Intrinsics
const state = require('../Intrisics/puppeteerState')
const taskQueue = require('../Intrisics/puppeteerTaskQueue')
const pinit = require('./puppeteerInitialize')

// Puppeteer Commands
const mining = require('../Commands/puppeteerMining')
const placement = require('../Commands/puppeteerPlacement')
const crafting = require('../Commands/puppeteerCrating')
const explorer = require("../Commands/puppeteerExplorer")
const following = require('../Commands/puppeteerFollowing')

// Function to process commands (used by both REST and console)
const processCommand = (commandString, source = 'unknown') => {
    console.log(`Received command from ${source}: ${commandString}`)
    let args = commandString.split(' ')

    if (args[0] === 'start') {
        if (!state.ANY_READY) {
            state.ANY_SHOULD_LOG_IN = true
            console.log("Starting Any")
            pinit.initBot()
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

    if (args[0] === 'follow') {
        if (args.length < 2) {
            console.log('Usage: follow <player_name>')
            return
        }

        const playerName = args[1]

        taskQueue.enqueue({
            name: `follow: ${playerName}`,
            execute: async () => {
                return await following.followPlayer(state.bot, playerName)
            },
            cancel: following.stopFollowing(state.bot)
        })
    }

    if (args[0] === 'unfollow' || args[0] === 'stopfollow') {
        const result = following.stopFollowing(state.bot)
        console.log(result.message)
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

    if (args[0] === 'craft') {
        if (args.length < 2) {
            console.log('Usage: craft <item_name> [amount]')
            return
        }

        const itemName = args[1]
        const amount = args.length >= 3 ? parseInt(args[2]) : 1

        if (isNaN(amount) || amount < 1) {
            console.log('Amount must be a positive number')
            return
        }

        taskQueue.enqueue({
            name: `craft: ${itemName} x${amount}`,
            execute: async () => {
                return await crafting.craft(state.bot, itemName, amount)
            }
        })
    }

    if (args[0] === 'goto') {
        if (args.length < 2) {
            console.log('Usage: goto [x] [y] [z] OR goto [blockName]')
            return
        }

        // Check if it's coordinates (3 numeric arguments) or block name (1 argument)
        if (args.length >= 4) {
            // Coordinate format: goto x y z
            const x = parseFloat(args[1].replace(",", "."))
            const y = parseFloat(args[2].replace(",", "."))
            const z = parseFloat(args[3].replace(",", "."))

            // Validate coordinates
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                console.log('Invalid coordinates. X, Y, Z must be numbers')
                return
            }

            taskQueue.enqueue({
                name: `goto: (${x}, ${y}, ${z})`,
                execute: async () => {
                    return await explorer.gotoPosition(state.bot, x, y, z)
                }
            })
        } else {
            // Block name format: goto blockName
            const blockName = args[1]

            taskQueue.enqueue({
                name: `goto: ${blockName}`,
                execute: async () => {
                    return await explorer.gotoBlock(state.bot, blockName)
                }
            })
        }
    }

    if (args[0] === 'randomwalk') {
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
                console.log('Invalid distance values, using defaults (16, 32)')
            }
        }

        console.log(`Random walk with distances: ${minDist} to ${maxDist} blocks`)

        taskQueue.enqueue({
            name: `randomwalk: ${minDist}-${maxDist} blocks`,
            execute: async () => {
                return await explorer.randomExplore(state.bot, minDist, maxDist)
            }
        })
    }
}

module.exports = { processCommand }