// behaviors.js - Bot behavior implementations
const { Movements, goals } = require('mineflayer-pathfinder')
const config = require('../Intrisics/puppeteerConfig')
const state = require('../Intrisics/puppeteerState')
const armor = require('./puppeteerArmor')

function isPassiveMob(entity) {
    return config.PASSIVE_MOBS.includes(entity.name)
}

function findClosestPassiveMob(bot, radius = 10) {
    let closestEntity = bot.nearestEntity()
    let closestMob = null

    if (closestEntity && closestEntity.position.distanceTo(bot.entity.position) < radius &&
        isPassiveMob(closestEntity)) {
        closestMob = closestEntity
    }

    return closestMob
}

async function handleWandering(bot) {
    const currentTime = Date.now()

    // Check if we should start wandering (been idle for more than configured time)
    if (!state.isWandering && state.getTimeSinceLastActivity() > config.IDLE_TIME_BEFORE_WANDERING) {
        const mob = findClosestPassiveMob(bot, 30)

        if (mob) {
            console.log(`Bot bored. Mob found: following ${mob.name}`)
            state.isWandering = true
            state.wanderingStartTime = currentTime
            state.targetMob = mob

            // Start following the mob
            const defaultMove = new Movements(bot)
            bot.pathfinder.setMovements(defaultMove)

            const goal = new goals.GoalFollow(mob, 2) // Follow within 2 blocks
            bot.pathfinder.setGoal(goal, true)
        }
    }

    // Check if we should stop wandering
    if (state.isWandering && (currentTime - state.wanderingStartTime) > config.WANDERING_DURATION) {
        console.log('Bot finished wandering, going back to idle')
        state.isWandering = false
        state.targetMob = null
        state.updateActivity() // Reset idle timer

        // Stop following
        bot.pathfinder.setGoal(null)
    }

    // If we're wandering but lost our target, stop wandering
    if (state.isWandering && state.targetMob) {
        const distance = bot.entity.position.distanceTo(state.targetMob.position)
        if (distance > 15 || !state.targetMob.isValid) { // Mob too far or despawned
            console.log('Lost target mob, stopping wandering')
            state.isWandering = false
            state.targetMob = null
            state.updateActivity()
            bot.pathfinder.setGoal(null)
        }
    }
}

async function handleItemPickup(bot) {
    // Don't interrupt other behaviors
    if (state.isWandering) return false

    // If we're not currently picking up an item, look for one
    if (!state.isPickingUpItem) {
        const nearestEntity = bot.nearestEntity()
        const item = (nearestEntity?.name === 'item' &&
                     nearestEntity?.velocity.norm() < 1 &&
                     nearestEntity?.position.distanceTo(bot.entity.position) < config.ITEM_PICKUP_RANGE)
                    ? nearestEntity : null

        if (item) {
            console.log('Picking up item')

            state.isPickingUpItem = true
            state.targetItem = item

            try {
                const defaultMove = new Movements(bot)
                bot.pathfinder.setMovements(defaultMove)

                const goal = new goals.GoalBlock(item.position.x, item.position.y, item.position.z)
                bot.pathfinder.setGoal(goal, true)

                return true // We're now busy picking up an item
            } catch (error) {
                console.error('Error setting path to item:', error)
                state.isPickingUpItem = false
                state.targetItem = null
                return false
            }
        }
    } else {
        // We're currently picking up an item, check if we should stop
        if (!state.targetItem || !state.targetItem.isValid) {
            // Item was picked up or despawned
            console.log('Item picked up or despawned, stopping pickup behavior')
            state.isPickingUpItem = false
            state.targetItem = null
            bot.pathfinder.setGoal(null)
            return false
        }
        return true // Still picking up item
    }

    return false
}

function findSafeRetreatLocation(bot, retreatDistance = config.RETREAT_DISTANCE) {
    const botPos = bot.entity.position
    const hostiles = Object.values(bot.entities).filter(e => e.type === 'hostile')

    // Try different angles to find a safe direction
    const angles = [0, 45, 90, 135, 180, 225, 270, 315]

    for (const angle of angles) {
        const radians = (angle * Math.PI) / 180
        const x = botPos.x + Math.cos(radians) * retreatDistance
        const z = botPos.z + Math.sin(radians) * retreatDistance

        // Check if this direction moves away from hostiles
        let isSafe = true
        for (const hostile of hostiles) {
            const newDistance = Math.sqrt((x - hostile.position.x) ** 2 + (z - hostile.position.z) ** 2)
            const currentDistance = botPos.distanceTo(hostile.position)

            if (newDistance <= currentDistance) {
                isSafe = false
                break
            }
        }

        if (isSafe) {
            // Find a suitable Y coordinate (ground level)
            const y = botPos.y // Start with current Y, pathfinder will handle elevation
            return { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }
        }
    }

    // If no safe direction found, just move away from the closest hostile
    if (hostiles.length > 0) {
        const closestHostile = hostiles.reduce((closest, hostile) => {
            const dist1 = botPos.distanceTo(hostile.position)
            const dist2 = botPos.distanceTo(closest.position)
            return dist1 < dist2 ? hostile : closest
        })

        const dx = botPos.x - closestHostile.position.x
        const dz = botPos.z - closestHostile.position.z
        const length = Math.sqrt(dx * dx + dz * dz)

        if (length > 0) {
            const x = botPos.x + (dx / length) * retreatDistance
            const z = botPos.z + (dz / length) * retreatDistance
            return { x: Math.floor(x), y: Math.floor(botPos.y), z: Math.floor(z) }
        }
    }

    return null
}

function findNearbyHostile(bot, maxDistance = config.COMBAT_RANGE) {
    let entity = bot.nearestEntity()
    let closestHostile = null
    if (entity) {
        let distanceToEntity = entity.position.distanceTo(bot.entity.position)
        closestHostile = (entity.type === 'hostile' && distanceToEntity < maxDistance) ? entity : null
    }
    return closestHostile
}

async function handleCombat(bot) {
    const currentTime = Date.now()
    const botHealth = bot.health

    // Look for nearby hostiles to fight
    const hostile = findNearbyHostile(bot)

    // Check if we should retreat due to low health
    const shouldRetreat = botHealth <= config.RETREAT_HEALTH_THRESHOLD && !state.isRetreating && hostile

    if (shouldRetreat) {
        console.log(`Health low (${botHealth}/20), retreating!`)
        state.isRetreating = true
        state.isInCombat = false
        state.combatTarget = null
        state.retreatStartTime = currentTime

        // Find and move to a safe location
        const retreatLocation = findSafeRetreatLocation(bot)
        if (retreatLocation) {
            try {
                const defaultMove = new Movements(bot)
                defaultMove.canDig = false
                bot.pathfinder.setMovements(defaultMove)

                const goal = new goals.GoalBlock(retreatLocation.x, retreatLocation.y, retreatLocation.z)
                bot.pathfinder.setGoal(goal, true)

                console.log(`Retreating to ${retreatLocation.x}, ${retreatLocation.y}, ${retreatLocation.z}`)
            } catch (error) {
                console.error('Error setting retreat path:', error)
                state.isRetreating = false
            }
        } else {
            state.isRetreating = false
        }

        return true // We're now retreating
    }

    // Check if we should stop retreating
    if (state.isRetreating) {
        const hasRetreatTimeExpired = (currentTime - state.retreatStartTime) > config.RETREAT_DURATION
        const hasHealthRecovered = botHealth > config.RETREAT_HEALTH_THRESHOLD + 2 // Add some buffer

        if (hasRetreatTimeExpired || hasHealthRecovered) {
            console.log('Stopping retreat - health recovered or timeout reached')
            state.isRetreating = false
            bot.pathfinder.setGoal(null)
        } else {
            // Still retreating, don't do combat
            return true
        }
    }

    if (hostile) {
        // Start or continue combat
        if (!state.isInCombat) {
            console.log(`Engaging hostile: ${hostile.name}`)
            state.isInCombat = true
        }

        // Attack the hostile
        try {
            // Equip combat gear
            await armor.equipSword(bot)
            await armor.equipShield(bot)

            await bot.pvp.attack(hostile)
        } catch (error) {
            console.error('Error attacking hostile:', error)
        }

        return true // We're in combat
    } else {
        // No hostiles nearby, stop combat
        if (state.isInCombat) {
            console.log('No more hostiles nearby, exiting combat mode')
            state.isInCombat = false
        }
        return false // Not in combat
    }
}

async function botIdle(bot) {
    // Handle combat first (highest priority after explicit tasks)
    const inCombatOrRetreating = await handleCombat(bot)
    if (inCombatOrRetreating) {
        state.lastActivityTime = Date.now()
        return
    }

    // Handle item pickup
    const isPickingUp = await handleItemPickup(bot)
    if (isPickingUp) {
        state.lastActivityTime = Date.now()
        return
    }

    // Handle wandering behavior second
    await handleWandering(bot)

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

module.exports = {
    botIdle
}