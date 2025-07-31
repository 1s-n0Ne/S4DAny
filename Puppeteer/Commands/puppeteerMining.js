const explorer = require('./puppeteerExplorer')

async function mine(bot, blockNames, targetCount) {
    const mcData = require('minecraft-data')(bot.version)

    // Convert block names to IDs
    const blockTypes = []
    for (const blockName of blockNames) {
        // Special case: bedrock is never mineable
        if (blockName === 'bedrock') {
            throw new Error('Cannot mine bedrock - it is unbreakable')
        }

        const blockType = mcData.blocksByName[blockName]
        if (!blockType) {
            console.log(`Unknown block type: ${blockName}`)
            continue
        }
        blockTypes.push(blockType.id)
    }

    if (blockTypes.length === 0) {
        throw new Error('No valid block types specified')
    }

    let totalMined = 0
    let exploreAttempts = 0
    const maxExploreAttempts = 10
    let foundUnharvestableBlock = false
    let unharvestableBlockName = ''

    console.log(`Starting to mine ${blockNames.join(', ')} x${targetCount}`)

    while (totalMined < targetCount && !foundUnharvestableBlock) {
        // Find blocks
        const blocks = bot.findBlocks({
            matching: blockTypes,
            maxDistance: 64,
            count: targetCount - totalMined
        })

        if (blocks.length === 0) {
            // No blocks found, try exploring
            if (exploreAttempts >= maxExploreAttempts) {
                console.log(`No more blocks found after ${maxExploreAttempts} exploration attempts`)
                break
            }

            console.log(`No blocks found, exploring... (attempt ${exploreAttempts + 1}/${maxExploreAttempts})`)

            try {
                await explorer.randomExplore(bot, 32, 64)
                exploreAttempts++
                // Give some time for chunks to load
                await new Promise(resolve => setTimeout(resolve, 1000))
                continue
            } catch (error) {
                console.error('Exploration failed:', error.message)
                exploreAttempts++
                continue
            }
        }

        // Reset explore attempts when blocks are found
        exploreAttempts = 0

        // Filter blocks to only harvestable ones
        const harvestableTargets = []

        for (const pos of blocks) {
            if (harvestableTargets.length >= targetCount - totalMined) break

            const block = bot.blockAt(pos)
            if (!block) continue

            // Get currently held item ID (null if empty hand)
            const heldItem = bot.heldItem
            const heldItemId = heldItem ? heldItem.type : null

            // Check if we can harvest this block with current item
            const canHarvest = block.canHarvest(heldItemId)

            // Also check dig time - if it's Infinity, we definitely can't mine it
            const digTime = block.digTime(heldItemId)

            if (!canHarvest || digTime === Infinity) {
                console.log(`Cannot harvest ${block.name} at ${pos} with current tool (held item: ${heldItem ? heldItem.name : 'empty hand'})`)

                // Check if any tool in inventory could harvest this
                let foundUsableTool = false
                for (const item of bot.inventory.items()) {
                    if (block.canHarvest(item.type)) {
                        try {
                            console.log(`Equipping ${item.name} to harvest ${block.name}`)
                            await bot.equip(item, 'hand')
                            foundUsableTool = true
                            harvestableTargets.push(block)
                            break
                        } catch (err) {
                            console.error(`Failed to equip ${item.name}: ${err.message}`)
                        }
                    }
                }

                if (!foundUsableTool) {
                    console.log(`No tool in inventory can harvest ${block.name}`)
                    foundUnharvestableBlock = true
                    unharvestableBlockName = block.name
                    break
                }
            } else {
                harvestableTargets.push(block)
            }
        }

        // If we found unharvestable blocks and no harvestable ones, fail the task
        if (foundUnharvestableBlock && harvestableTargets.length === 0) {
            throw new Error(`Cannot mine ${unharvestableBlockName} - no suitable tool in inventory`)
        }

        if (harvestableTargets.length === 0) {
            console.log('No harvestable targets found, exploring...')
            try {
                await explorer.randomExplore(bot, 16, 32)
            } catch (error) {
                console.error('Recovery exploration failed:', error.message)
            }
            continue
        }

        try {
            // Set up a safety timeout for collectBlock
            let collectCompleted = false
            const safetyTimeout = setTimeout(() => {
                if (!collectCompleted) {
                    console.error('Mining taking too long, likely stuck')
                    // Force stop any ongoing collection
                    if (bot.pathfinder) {
                        bot.pathfinder.setGoal(null)
                    }
                }
            }, 30000) // 30 second safety timeout

            // Collect the blocks
            await bot.collectBlock.collect(harvestableTargets)
            collectCompleted = true
            clearTimeout(safetyTimeout)

            totalMined += harvestableTargets.length
            console.log(`Mined ${harvestableTargets.length} blocks. Total: ${totalMined}/${targetCount}`)
        } catch (error) {
            console.error('Failed to collect blocks:', error.message)

            // Check if the error is because we can't harvest the block
            if (error.message.includes('dig') || error.message.includes('harvest')) {
                throw new Error(`Cannot mine blocks - tool requirement issue: ${error.message}`)
            }

            // Try exploring after collection failure
            try {
                await explorer.randomExplore(bot, 16, 32)
            } catch (exploreError) {
                console.error('Recovery exploration failed:', exploreError.message)
            }
        }
    }

    // Final check - if we mined nothing and were asked to mine something, that's a failure
    if (totalMined === 0 && targetCount > 0) {
        if (foundUnharvestableBlock) {
            throw new Error(`Failed to mine any blocks - ${unharvestableBlockName} cannot be harvested with available tools`)
        } else {
            throw new Error(`Failed to mine any ${blockNames.join(' or ')} - none found or all unharvestable`)
        }
    }

    console.log(`Mining completed. Mined ${totalMined} out of ${targetCount} requested blocks`)
    return {
        requested: targetCount,
        mined: totalMined,
        success: totalMined >= targetCount,
        message: totalMined >= targetCount
            ? `Successfully mined ${totalMined} blocks`
            : `Partially completed: mined ${totalMined} out of ${targetCount} blocks`
    }
}

module.exports = { mine }