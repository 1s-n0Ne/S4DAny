// puppeteerMine.js - Simple mine command implementation
const { goals } = require('mineflayer-pathfinder')


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

module.exports = { randomExplore }