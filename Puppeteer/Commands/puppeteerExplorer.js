// puppeteerMine.js - Simple mine command implementation
const { goals } = require('mineflayer-pathfinder')

// Move to a block position
async function moveToBlock(bot, block) {
    const pos = block.position

    console.log(`Moving to crafting table at (${pos.x}, ${pos.y}, ${pos.z})`)

    // Set goal to get near the crafting table (within 3 blocks)
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
                reject(new Error('Cannot reach crafting table'))
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

    // Look at the crafting table
    await bot.lookAt(block.position.offset(0.5, 0.5, 0.5))
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
    randomExplore,
    moveToBlock
}