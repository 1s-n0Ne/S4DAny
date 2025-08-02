// puppeteerMine.js - Simple mine command implementation
const { goals } = require('mineflayer-pathfinder')
const state = require('../Intrisics/puppeteerState')

// Import logging
const { createModuleLogger } = require('../System/puppeteerLogger')
const log = createModuleLogger('Explorer')

// Find nearest crafting table
async function findBlock(bot, blockName) {
    const blockId = state.mcData.blocksByName[blockName].id

    // Search for block within 32 blocks
    const blocksMatch = bot.findBlocks({
        matching: blockId,
        maxDistance: 32,
        count: 10
    })

    if (blocksMatch.length === 0) {
        return null
    }

    // Sort by distance and find the closest accessible one
    const botPos = bot.entity.position
    blocksMatch.sort((a, b) => {
        const distA = botPos.distanceTo(a)
        const distB = botPos.distanceTo(b)
        return distA - distB
    })

    // Return the first valid block
    for (const pos of blocksMatch) {
        const block = bot.blockAt(pos)
        if (block && block.name === blockName) {
            return block
        }
    }

    return null
}

// Move to a block position
async function moveToBlock(bot, block) {
    const pos = block.position

    log.info(`Moving to ${block.name} at (${pos.x}, ${pos.y}, ${pos.z})`)

    // Set goal to get near the block (within 3 blocks)
    bot.pathfinder.setGoal(new goals.GoalNear(pos.x, pos.y, pos.z, 3))

    // Wait for pathfinding to complete
    await new Promise((resolve, reject) => {
        const onGoalReached = () => {
            cleanup()
            resolve()
        }

        const onPathUpdate = (results) => {
            if (results.status === 'noPath') {
                cleanup()
                reject(new Error(`Cannot reach ${block.name}`))
            }
        }

        const cleanup = () => {
            bot.removeListener('goal_reached', onGoalReached)
            bot.removeListener('path_update', onPathUpdate)
        }

        bot.once('goal_reached', onGoalReached)
        bot.on('path_update', onPathUpdate)

        // Timeout after 15 seconds
        setTimeout(() => {
            cleanup()
            bot.pathfinder.setGoal(null)
            reject(new Error('Pathfinding timeout'))
        }, 15000)
    })

    // Look at the block
    if (block.position.offset) {
        await bot.lookAt(block.position.offset(0.5, 0.5, 0.5))
    }
}

// Find and go to a specific block type using existing findBlock and moveToBlock functions
async function gotoBlock(bot, blockName) {
    log.info(`Looking for ${blockName}...`)

    // Use the existing findBlock function to locate the block
    const block = await findBlock(bot, blockName)

    if (!block) {
        throw new Error(`No ${blockName} found within search range`)
    }

    log.info(`Found ${blockName} at (${block.position.x}, ${block.position.y}, ${block.position.z})`)

    // Use the existing moveToBlock function to move to it
    await moveToBlock(bot, block)

    return {
        success: true,
        blockName: blockName,
        position: block.position,
        message: `Found and reached ${blockName} at (${block.position.x}, ${block.position.y}, ${block.position.z})`
    }
}

// Go to specific coordinates
async function gotoPosition(bot, x, y, z) {
    const targetX = Math.floor(x)
    const targetY = Math.floor(y)
    const targetZ = Math.floor(z)

    log.info(`Moving to position (${targetX}, ${targetY}, ${targetZ})`)

    // Create a virtual block object at the target position
    const virtualBlock = {
        position: {
            x: targetX,
            y: targetY,
            z: targetZ
        }
    }

    try {
        // Use moveToBlock function under the hood
        await moveToBlock(bot, virtualBlock)

        log.info(`Successfully reached position (${targetX}, ${targetY}, ${targetZ})`)
        return {
            success: true,
            position: { x: targetX, y: targetY, z: targetZ },
            message: `Reached position (${targetX}, ${targetY}, ${targetZ})`
        }
    } catch (error) {
        // Re-throw with more specific error message for position navigation
        throw new Error(`Cannot reach position (${targetX}, ${targetY}, ${targetZ}): ${error.message}`)
    }
}

async function randomExplore(bot, minDist, maxDist) {
    return new Promise((resolve, reject) => {
        const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

        const xOff = randomInt(-1, 1) * randomInt(minDist, maxDist)
        const zOff = randomInt(-1, 1) * randomInt(minDist, maxDist)

        const newPos = bot.entity.position.offset(xOff, 0, zOff)

        bot.pathfinder.setGoal(new goals.GoalNear(newPos.x, newPos.y, newPos.z, 2))

        const onGoalReached = () => {
            cleanup()
            resolve()
        }

        const onPathUpdate = (results) => {
            if (results.status === 'noPath') {
                cleanup()
                reject(new Error('No path found'))
            }
        }

        const cleanup = () => {
            bot.removeListener('goal_reached', onGoalReached)
            bot.removeListener('path_update', onPathUpdate)
        }

        bot.once('goal_reached', onGoalReached)
        bot.on('path_update', onPathUpdate)

        // Timeout after 20 seconds
        setTimeout(() => {
            cleanup()
            bot.pathfinder.setGoal(null)
            reject(new Error('Exploration timeout'))
        }, 20000)
    })
}

module.exports = {
    findBlock,
    randomExplore,
    moveToBlock,
    gotoPosition,
    gotoBlock
}