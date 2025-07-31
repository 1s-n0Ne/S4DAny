// puppeteerHunt.js - Simple mob hunting implementation with exploration
const armor = require('../Automata/puppeteerArmor')
const explorer = require('./puppeteerExplorer')

async function hunt(bot, mobType, maxCount = null) {
    console.log(`Starting hunt for ${mobType}${maxCount ? ` (max: ${maxCount})` : ' (all nearby)'}`)

    // Equip combat gear at the start
    try {
        await armor.equipSword(bot)
        await armor.equipShield(bot)
    } catch (error) {
        console.error('Failed to equip combat gear:', error.message)
    }

    let hunted = 0
    let exploreAttempts = 0
    const maxExploreAttempts = 5

    while ((maxCount === null || hunted < maxCount) && exploreAttempts < maxExploreAttempts) {
        // Find all entities of the specified type
        const targets = Object.values(bot.entities).filter(entity =>
            entity.name === mobType &&
            entity.position.distanceTo(bot.entity.position) < 32
        )

        if (targets.length === 0) {
            // No mobs found, try exploring
            console.log(`No ${mobType} found nearby, exploring... (attempt ${exploreAttempts + 1}/${maxExploreAttempts})`)

            try {
                await explorer.randomExplore(bot, 16, 48)
                exploreAttempts++

                // Give some time for entities to load after moving
                await new Promise(resolve => setTimeout(resolve, 2000))
                continue
            } catch (error) {
                console.error('Exploration failed:', error.message)
                exploreAttempts++
                continue
            }
        }

        // Reset explore attempts when mobs are found
        exploreAttempts = 0

        // Sort by distance (closest first)
        targets.sort((a, b) =>
            bot.entity.position.distanceTo(a.position) -
            bot.entity.position.distanceTo(b.position)
        )

        // Attack each target
        for (const target of targets) {
            if (maxCount !== null && hunted >= maxCount) break

            try {
                console.log(`Attacking ${mobType} at ${target.position.toString()}`)

                // Use PvP plugin to attack
                await bot.pvp.attack(target)

                // Wait for the attack to complete
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        bot.pvp.stop()
                        reject(new Error('Attack timeout'))
                    }, 30000) // 30 second timeout per mob

                    const onStoppedAttacking = () => {
                        clearTimeout(timeout)
                        cleanup()
                        resolve()
                    }

                    const onDeath = () => {
                        clearTimeout(timeout)
                        cleanup()
                        reject(new Error('Bot died during hunt'))
                    }

                    const cleanup = () => {
                        bot.removeListener('stoppedAttacking', onStoppedAttacking)
                        bot.removeListener('death', onDeath)
                    }

                    bot.once('stoppedAttacking', onStoppedAttacking)
                    bot.once('death', onDeath)
                })

                hunted++
                console.log(`Successfully hunted ${mobType}. Total: ${hunted}`)

                // Small delay between targets
                await new Promise(resolve => setTimeout(resolve, 1000))

            } catch (error) {
                console.error(`Failed to hunt ${mobType}: ${error.message}`)

                // Stop current attack if any
                await bot.pvp.stop()

                // If we died, break out of the hunt
                if (error.message === 'Bot died during hunt') {
                    throw error
                }
            }
        }

        // Small delay before looking for more targets
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Determine success based on whether we hunted at least one mob
    const success = hunted > 0

    if (!success) {
        console.log(`Hunt failed. Could not find any ${mobType} to hunt after ${maxExploreAttempts} exploration attempts`)
        throw new Error(`No ${mobType} found after exploring ${maxExploreAttempts} times`)
    }

    console.log(`Hunt completed. Hunted ${hunted} ${mobType}(s)`)

    return {
        success: true,
        mobType: mobType,
        hunted: hunted,
        requested: maxCount,
        message: `Hunted ${hunted} ${mobType}(s)${maxCount ? ` out of ${maxCount} requested` : ''}`
    }
}

module.exports = { hunt }