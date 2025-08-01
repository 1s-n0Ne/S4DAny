// puppeteerPlacement.js - Block placement functionality
const { goals } = require('mineflayer-pathfinder')
const { Vec3 } = require('vec3')

const config = require('../Intrisics/puppeteerConfig')
const state = require('../Intrisics/puppeteerState')

// Import logging
const { createModuleLogger } = require('../Intrisics/puppeteerLogger')
const log = createModuleLogger('Placement')

async function place(bot, blockName, x, y, z) {
    // Validate block type exists
    const blockType = state.mcData.blocksByName[blockName]
    if (!blockType) {
        throw new Error(`Unknown block type: ${blockName}`)
    }

    // Check if bot has the block in inventory
    const blockItem = bot.inventory.items().find(item => item.name === blockName)
    if (!blockItem) {
        throw new Error(`Block '${blockName}' not found in inventory`)
    }

    // Parse and validate coordinates
    const targetX = Math.floor(x)
    const targetY = Math.floor(y)
    const targetZ = Math.floor(z)

    log.info(`Attempting to place ${blockName} at (${targetX}, ${targetY}, ${targetZ})`)

    // Check if target position is valid (not air placement without support)
    const targetPos = new Vec3(targetX, targetY, targetZ)
    const targetBlock = bot.blockAt(targetPos)
    if (!targetBlock) {
        throw new Error(`Cannot access block at position (${targetX}, ${targetY}, ${targetZ})`)
    }

    // If target position is not air, we can't place there
    if (targetBlock.name !== 'air') {
        throw new Error(`Position (${targetX}, ${targetY}, ${targetZ}) is already occupied by ${targetBlock.name}`)
    }

    // Check for valid placement surface (block below, or adjacent blocks for support)
    const supportBlocks = [
        bot.blockAt(new Vec3(targetX, targetY - 1, targetZ)), // Below
        bot.blockAt(new Vec3(targetX + 1, targetY, targetZ)), // East
        bot.blockAt(new Vec3(targetX - 1, targetY, targetZ)), // West
        bot.blockAt(new Vec3(targetX, targetY, targetZ + 1)), // South
        bot.blockAt(new Vec3(targetX, targetY, targetZ - 1)), // North
        bot.blockAt(new Vec3(targetX, targetY + 1, targetZ))  // Above
    ]

    const validSupportBlock = supportBlocks.find(block =>
        block && block.name !== 'air' && block.name !== 'water' && block.name !== 'lava'
    )

    if (!validSupportBlock) {
        throw new Error(`No valid surface found to place block at (${targetX}, ${targetY}, ${targetZ})`)
    }

    // Calculate distance to target
    const botPosition = bot.entity.position
    const targetPosition = new Vec3(targetX, targetY, targetZ)
    const distance = botPosition.distanceTo(targetPosition)

    // Move closer if too far (within 4 blocks for placement)
    if (distance > 4) {
        log.info(`Moving closer to placement position (distance: ${distance.toFixed(2)})`)

        try {
            bot.pathfinder.setGoal(new goals.GoalNear(targetX, targetY, targetZ, 3))

            // Wait for pathfinding to complete
            await new Promise((resolve, reject) => {
                const onGoalReached = () => {
                    cleanup()
                    resolve()
                }

                const onPathUpdate = (results) => {
                    if (results.status === 'noPath') {
                        cleanup()
                        reject(new Error('Cannot reach placement position'))
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
        } catch (error) {
            throw new Error(`Failed to reach placement position: ${error.message}`)
        }
    }

    try {
        // Equip the block item
        await bot.equip(blockItem, 'hand')
        log.info(`Equipped ${blockName}`)

        // Find the reference block to place against
        const referenceBlock = validSupportBlock

        // Look at the reference block
        await bot.lookAt(referenceBlock.position.offset(0.5, 0.5, 0.5))

        // Calculate face vector for placement
        let faceVector
        const refPos = referenceBlock.position

        // Determine which face to place against based on relative position
        if (refPos.x === targetX && refPos.y === targetY - 1 && refPos.z === targetZ) {
            faceVector = { x: 0, y: 1, z: 0 } // Top face
        } else if (refPos.x === targetX + 1 && refPos.y === targetY && refPos.z === targetZ) {
            faceVector = { x: -1, y: 0, z: 0 } // West face
        } else if (refPos.x === targetX - 1 && refPos.y === targetY && refPos.z === targetZ) {
            faceVector = { x: 1, y: 0, z: 0 } // East face
        } else if (refPos.x === targetX && refPos.y === targetY && refPos.z === targetZ + 1) {
            faceVector = { x: 0, y: 0, z: -1 } // North face
        } else if (refPos.x === targetX && refPos.y === targetY && refPos.z === targetZ - 1) {
            faceVector = { x: 0, y: 0, z: 1 } // South face
        } else {
            faceVector = { x: 0, y: -1, z: 0 } // Bottom face (placing below)
        }

        // Place the block
        await bot.placeBlock(referenceBlock, faceVector)

        log.info(`Successfully placed ${blockName} at (${targetX}, ${targetY}, ${targetZ})`)

        return {
            success: true,
            blockName: blockName,
            position: { x: targetX, y: targetY, z: targetZ },
            referenceBlock: referenceBlock.name,
            referencePosition: referenceBlock.position
        }

    } catch (error) {
        throw new Error(`Failed to place block: ${error.message}`)
    }
}

async function placeNear(bot, blockName) {
    // Validate block type exists
    const blockType = state.mcData.blocksByName[blockName]
    if (!blockType) {
        throw new Error(`Unknown block type: ${blockName}`)
    }

    // Check if bot has the block in inventory
    const blockItem = bot.inventory.items().find(item => item.name === blockName)
    if (!blockItem) {
        throw new Error(`Block '${blockName}' not found in inventory`)
    }

    const botPos = bot.entity.position
    const searchRadius = 1 // 2x2x2 area around player (1 block in each direction)

    log.info(`Looking for placement spot for ${blockName} near player position`)

    // Generate all possible positions in the 2x2x2 bubble around the player
    const candidates = []

    for (let x = -searchRadius; x <= searchRadius; x++) {
        for (let y = -searchRadius; y <= searchRadius; y++) {
            for (let z = -searchRadius; z <= searchRadius; z++) {
                // Skip the player's exact position
                if (x === 0 && y === 0 && z === 0) continue

                const candidatePos = new Vec3(
                    Math.floor(botPos.x + x),
                    Math.floor(botPos.y + y),
                    Math.floor(botPos.z + z)
                )

                candidates.push(candidatePos)
            }
        }
    }

    log.info(`Checking ${candidates.length} possible positions`)

    // Sort candidates by preference (closer to player, lower Y first for stability)
    candidates.sort((a, b) => {
        const distA = botPos.distanceTo(a)
        const distB = botPos.distanceTo(b)

        // If distances are similar, prefer lower Y positions
        if (Math.abs(distA - distB) < 0.1) {
            return a.y - b.y
        }

        return distA - distB
    })

    // Check each candidate position
    for (const candidatePos of candidates) {
        try {
            const targetBlock = bot.blockAt(candidatePos)
            if (!targetBlock) continue

            // Skip if position is not air
            if (targetBlock.name !== 'air') continue

            // Check for valid support (at least one adjacent solid block)
            const supportPositions = [
                new Vec3(candidatePos.x, candidatePos.y - 1, candidatePos.z), // Below
                new Vec3(candidatePos.x + 1, candidatePos.y, candidatePos.z), // East
                new Vec3(candidatePos.x - 1, candidatePos.y, candidatePos.z), // West
                new Vec3(candidatePos.x, candidatePos.y, candidatePos.z + 1), // South
                new Vec3(candidatePos.x, candidatePos.y, candidatePos.z - 1), // North
                new Vec3(candidatePos.x, candidatePos.y + 1, candidatePos.z)  // Above
            ]

            const supportBlock = supportPositions.find(pos => {
                const block = bot.blockAt(pos)
                return block && block.name !== 'air' && block.name !== 'water' && block.name !== 'lava'
            })

            if (!supportBlock) continue

            // Found a valid position! Try to place the block
            log.info(`Found valid position at (${candidatePos.x}, ${candidatePos.y}, ${candidatePos.z})`)

            try {
                // Use the existing place function
                const result = await place(bot, blockName, candidatePos.x, candidatePos.y, candidatePos.z)
                log.info(`Successfully placed ${blockName} near player at (${candidatePos.x}, ${candidatePos.y}, ${candidatePos.z})`)

                return {
                    success: true,
                    blockName: blockName,
                    position: candidatePos,
                    message: `Placed ${blockName} at (${candidatePos.x}, ${candidatePos.y}, ${candidatePos.z})`
                }

            } catch (placeError) {
                // If placement fails at this position, try the next one
                log.error(`Failed to place at (${candidatePos.x}, ${candidatePos.y}, ${candidatePos.z}): ${placeError.message}`)
            }

        } catch (error) {
            // If there's an error checking this position, skip it
        }
    }

    // If we get here, no valid position was found
    throw new Error(`No valid placement position found for ${blockName} within 2x2x2 area around player`)
}

async function breakBlock(bot, x, y, z) {
    // Parse and validate coordinates
    const targetX = Math.floor(x)
    const targetY = Math.floor(y)
    const targetZ = Math.floor(z)

    log.info(`Attempting to break block at (${targetX}, ${targetY}, ${targetZ})`)

    // Get the target block
    const targetPos = new Vec3(targetX, targetY, targetZ)
    const targetBlock = bot.blockAt(targetPos)

    if (!targetBlock) {
        throw new Error(`Cannot access block at position (${targetX}, ${targetY}, ${targetZ})`)
    }

    // If block is already air, return success
    if (targetBlock.name === 'air') {
        log.info(`Block at (${targetX}, ${targetY}, ${targetZ}) is already air`)
        return {
            success: true,
            blockName: 'air',
            position: { x: targetX, y: targetY, z: targetZ },
            message: `Block at (${targetX}, ${targetY}, ${targetZ}) was already air`
        }
    }

    // Check if block is breakable
    const blockInfo = state.mcData.blocksByName[targetBlock.name]
    if (!blockInfo) {
        throw new Error(`Unknown block type: ${targetBlock.name}`)
    }

    // Check if block is unbreakable (hardness -1 means unbreakable like bedrock)
    if (blockInfo.hardness === -1) {
        throw new Error(`Block '${targetBlock.name}' is unbreakable`)
    }

    log.info(`Breaking ${targetBlock.name} (hardness: ${blockInfo.hardness})`)

    // Calculate distance to target
    const botPosition = bot.entity.position
    const distance = botPosition.distanceTo(targetPos)

    // Move closer if too far (within 4.5 blocks for breaking)
    if (distance > 4.5) {
        log.info(`Moving closer to target block (distance: ${distance.toFixed(2)})`)

        try {
            bot.pathfinder.setGoal(new goals.GoalNear(targetX, targetY, targetZ, 3))

            // Wait for pathfinding to complete
            await new Promise((resolve, reject) => {
                const onGoalReached = () => {
                    cleanup()
                    resolve()
                }

                const onPathUpdate = (results) => {
                    if (results.status === 'noPath') {
                        cleanup()
                        reject(new Error('Cannot reach target block'))
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
        } catch (error) {
            throw new Error(`Failed to reach target block: ${error.message}`)
        }
    }

    try {
        // Equip the best tool for this block
        await equipBestTool(bot, targetBlock)

        // Look at the block
        await bot.lookAt(targetBlock.position.offset(0.5, 0.5, 0.5))

        // Break the block
        log.info(`Breaking ${targetBlock.name} with equipped tool`)
        await bot.dig(targetBlock)

        log.info(`Successfully broke ${targetBlock.name} at (${targetX}, ${targetY}, ${targetZ})`)

        return {
            success: true,
            blockName: targetBlock.name,
            position: { x: targetX, y: targetY, z: targetZ },
            message: `Successfully broke ${targetBlock.name} at (${targetX}, ${targetY}, ${targetZ})`
        }

    } catch (error) {
        throw new Error(`Failed to break block: ${error.message}`)
    }
}

async function equipBestTool(bot, block) {
    // Get all tools in inventory
    const tools = bot.inventory.items().filter(item => {
        return item.name.includes('pickaxe') ||
               item.name.includes('axe') ||
               item.name.includes('shovel') ||
               item.name.includes('hoe') ||
               item.name.includes('sword') ||
               item.name.includes('shears')
    })

    if (tools.length === 0) {
        log.info('No tools available, using hand')
        return
    }

    // Determine the best tool for this block type
    let bestTool = null
    let bestEfficiency = 0

    // Tool effectiveness mapping based on block material
    const toolEffectiveness = {
        // Pickaxe blocks
        stone: ['pickaxe'],
        metal: ['pickaxe'],
        rock: ['pickaxe'],

        // Axe blocks
        wood: ['axe'],
        plant: ['axe'],

        // Shovel blocks
        earth: ['shovel'],
        sand: ['shovel'],
        snow: ['shovel'],

        // Sword blocks
        web: ['sword'],

        // Shears blocks
        wool: ['shears'],
        leaves: ['shears']
    }

    // Get block material type
    const blockInfo = state.mcData.blocksByName[block.name]
    let blockMaterial = 'default'

    // Try to determine material from block name patterns
    if (block.name.includes('stone') || block.name.includes('ore') ||
        block.name.includes('cobblestone') || block.name.includes('brick')) {
        blockMaterial = 'stone'
    } else if (block.name.includes('wood') || block.name.includes('log') ||
               block.name.includes('plank')) {
        blockMaterial = 'wood'
    } else if (block.name.includes('dirt') || block.name.includes('grass') ||
               block.name.includes('sand') || block.name.includes('gravel')) {
        blockMaterial = 'earth'
    } else if (block.name.includes('leaves')) {
        blockMaterial = 'leaves'
    } else if (block.name.includes('wool')) {
        blockMaterial = 'wool'
    } else if (block.name === 'web') {
        blockMaterial = 'web'
    }

    // Find the best tool for this material
    const preferredToolTypes = toolEffectiveness[blockMaterial] || []

    for (const tool of tools) {
        let efficiency = 1 // Base efficiency

        // Check if this tool type is preferred for this block
        const isPreferredTool = preferredToolTypes.some(toolType => tool.name.includes(toolType))
        if (isPreferredTool) {
            efficiency *= 5 // Preferred tools are much more efficient
        }

        // Add material bonus (better materials are more efficient)
        if (tool.name.includes('netherite')) efficiency *= 4
        else if (tool.name.includes('diamond')) efficiency *= 3.5
        else if (tool.name.includes('iron')) efficiency *= 2.5
        else if (tool.name.includes('stone')) efficiency *= 2
        else if (tool.name.includes('golden')) efficiency *= 3 // Fast but fragile
        else if (tool.name.includes('wooden')) efficiency *= 1.5

        // Add enchantment bonuses
        if (tool.enchants) {
            tool.enchants.forEach(enchant => {
                if (enchant.name === 'efficiency') {
                    efficiency *= (1 + enchant.lvl * 0.3)
                }
            })
        }

        // Consider durability (avoid tools about to break)
        const maxDurability = getToolMaxDurability(tool.name)
        const currentDurability = maxDurability - (tool.durabilityUsed || 0)

        if (currentDurability < 10) {
            efficiency *= 0.1 // Heavily penalize tools about to break
        }

        if (efficiency > bestEfficiency) {
            bestEfficiency = efficiency
            bestTool = tool
        }
    }

    if (bestTool) {
        log.info(`Equipping ${bestTool.name} for breaking ${block.name}`)
        await bot.equip(bestTool, 'hand')
    } else {
        log.info('No suitable tool found, using hand')
    }
}

function getToolMaxDurability(toolName) {
    return config.ITEM_DURABILITY_MAP[toolName] || 100
}

module.exports = { place, placeNear, breakBlock }