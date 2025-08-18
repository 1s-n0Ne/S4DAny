// puppeteerFollowing.js - Following task implementation
const { Movements, goals } = require('mineflayer-pathfinder')
const config = require('../Intrisics/puppeteerConfig')
const state = require('../Intrisics/puppeteerState')

// Import logging
const { createModuleLogger } = require('../System/puppeteerLogger')
const log = createModuleLogger('Following')

function checkIfTargetStationary(currentTargetPos, currentTime) {
    // If we don't have a previous position, record current position
    if (!state.targetLastPosition) {
        state.targetLastPosition = currentTargetPos.clone()
        state.targetStationaryStartTime = currentTime
        state.targetStationaryArea = {
            minX: currentTargetPos.x - config.STATIONARY_AREA_SIZE / 2,
            maxX: currentTargetPos.x + config.STATIONARY_AREA_SIZE / 2,
            minY: currentTargetPos.y - config.STATIONARY_HEIGHT / 2,
            maxY: currentTargetPos.y + config.STATIONARY_HEIGHT / 2,
            minZ: currentTargetPos.z - config.STATIONARY_AREA_SIZE / 2,
            maxZ: currentTargetPos.z + config.STATIONARY_AREA_SIZE / 2
        }
        return { isStationary: false, stationaryDuration: 0 }
    }

    // Check if target is still within the defined stationary area
    const isInArea = (
        currentTargetPos.x >= state.targetStationaryArea.minX &&
        currentTargetPos.x <= state.targetStationaryArea.maxX &&
        currentTargetPos.y >= state.targetStationaryArea.minY &&
        currentTargetPos.y <= state.targetStationaryArea.maxY &&
        currentTargetPos.z >= state.targetStationaryArea.minZ &&
        currentTargetPos.z <= state.targetStationaryArea.maxZ
    )

    if (isInArea) {
        // Target is still in the same area, check if enough time has passed
        const stationaryDuration = currentTime - state.targetStationaryStartTime
        if (stationaryDuration >= config.STATIONARY_TIME_THRESHOLD) {
            return { isStationary: true, stationaryDuration }
        }
        return { isStationary: false, stationaryDuration }
    } else {
        // Target moved outside the area, reset the stationary tracking
        state.targetLastPosition = currentTargetPos.clone()
        state.targetStationaryStartTime = currentTime
        state.targetStationaryArea = {
            minX: currentTargetPos.x - config.STATIONARY_AREA_SIZE / 2,
            maxX: currentTargetPos.x + config.STATIONARY_AREA_SIZE / 2,
            minY: currentTargetPos.y - config.STATIONARY_HEIGHT / 2,
            maxY: currentTargetPos.y + config.STATIONARY_HEIGHT / 2,
            minZ: currentTargetPos.z - config.STATIONARY_AREA_SIZE / 2,
            maxZ: currentTargetPos.z + config.STATIONARY_AREA_SIZE / 2
        }
        return { isStationary: false, stationaryDuration: 0 }
    }
}

async function followPlayer(bot, playerName) {
    log.info(`Starting to follow ${playerName}`)

    // Initialize following state
    state.isFollowing = true
    state.followingTarget = playerName
    state.followingStartTime = Date.now()
    state.targetLastPosition = null
    state.targetStationaryStartTime = 0
    state.targetStationaryArea = null

    // Reset any conflicting idle behaviors
    state.stopItemPickup()
    if (state.isWandering) {
        state.isWandering = false
        state.targetMob = null
    }

    return new Promise((resolve, reject) => {
        const followLoop = async () => {
            const currentTime = Date.now()

            // Check if target player still exists
            const targetPlayer = bot.players[state.followingTarget]?.entity
            if (!targetPlayer || !targetPlayer.isValid) {
                log.warn(`Lost target player: ${state.followingTarget}`)
                cleanup()
                resolve({
                    success: true,
                    reason: 'target_lost',
                    message: `Lost target player: ${state.followingTarget}`
                })
                return
            }

            const botPos = bot.entity.position
            const targetPos = targetPlayer.position
            const distanceToTarget = botPos.distanceTo(targetPos)

            // Check both conditions
            const isWithinRange = distanceToTarget <= 5
            const stationaryCheckResult = checkIfTargetStationary(targetPos, currentTime)
            const isTargetStationary = stationaryCheckResult.isStationary

            // Stop only if BOTH conditions are met
            if (isWithinRange && isTargetStationary) {
                log.info(`Stop conditions met: within range (${distanceToTarget.toFixed(1)} blocks) AND target stationary for ${(stationaryCheckResult.stationaryDuration / 1000).toFixed(1)}s`)
                cleanup()
                resolve({
                    success: true,
                    reason: 'both_conditions_met',
                    message: `Stopped following ${state.followingTarget}: within ${distanceToTarget.toFixed(1)} blocks and target stationary for ${(stationaryCheckResult.stationaryDuration / 1000).toFixed(1)}s`
                })
                return
            }

            // Optional: Log current status for debugging
            if (isWithinRange) {
                log.debug(`Within range (${distanceToTarget.toFixed(1)} blocks) but target is still moving`)
            } else if (isTargetStationary) {
                log.debug(`Target stationary for ${(stationaryCheckResult.stationaryDuration / 1000).toFixed(1)}s but not within range (${distanceToTarget.toFixed(1)} blocks)`)
            }

            // Check if we should stop following (external stop)
            if (!state.isFollowing) {
                log.info('Following was stopped externally')
                cleanup()
                resolve({
                    success: true,
                    reason: 'stopped_externally',
                    message: 'Following was stopped'
                })
                return
            }

            // Continue following - update pathfinding goal
            try {
                const followMovements = new Movements(bot)
                followMovements.canDig = false // Don't dig while following
                followMovements.allow1by1towers = false
                bot.pathfinder.setMovements(followMovements)

                // Use GoalFollow for smooth following behavior, stay 3-4 blocks away
                const goal = new goals.GoalFollow(targetPlayer, 3)
                bot.pathfinder.setGoal(goal, true)
                log.info(`Following ${state.followingTarget} (distance: ${distanceToTarget.toFixed(1)} blocks)`)

            } catch (error) {
                log.error(`Error updating follow goal: ${error.message}`, { stack: error.stack })
                cleanup()
                reject(new Error(`Failed to update follow goal: ${error.message}`))
                return
            }

            // Continue the loop
            setTimeout(followLoop, 1000) // Check every second
        }

        let cleanup = () => {
            state.isFollowing = false
            state.followingTarget = null
            state.followingStartTime = 0
            state.targetLastPosition = null
            state.targetStationaryStartTime = 0
            state.targetStationaryArea = null

            if (bot && bot.pathfinder) {
                bot.pathfinder.setGoal(null)
            }
        }

        // Error handlers
        const onError = (error) => {
            log.error(`Bot error during following: ${error.message}`, { stack: error.stack })
            cleanup()
            reject(new Error(`Bot error: ${error.message}`))
        }

        const onEnd = () => {
            log.warn('Bot disconnected during following')
            cleanup()
            reject(new Error('Bot disconnected'))
        }

        // Add error listeners
        bot.on('error', onError)
        bot.on('end', onEnd)

        // Cleanup function to remove listeners
        const originalCleanup = cleanup
        cleanup = () => {
            bot.removeListener('error', onError)
            bot.removeListener('end', onEnd)
            originalCleanup()
        }

        // Check if player exists before starting
        const targetPlayer = bot.players[playerName]?.entity
        if (!targetPlayer) {
            cleanup()
            reject(new Error(`Player '${playerName}' not found`))
            return
        }

        // Start the follow loop
        followLoop()
    })
}

function stopFollowing(bot) {
    if (state.isFollowing) {
        log.info(`Stopping follow of ${state.followingTarget}`)
        state.isFollowing = false

        if (bot && bot.pathfinder) {
            bot.pathfinder.setGoal(null)
        }

        return {
            success: true,
            message: `Stopped following ${state.followingTarget}`
        }
    } else {
        return {
            success: false,
            message: 'Bot is not currently following anyone'
        }
    }
}

module.exports = {
    followPlayer,
    stopFollowing
}