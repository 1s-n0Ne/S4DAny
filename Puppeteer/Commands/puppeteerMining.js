const explorer = require('./puppeteerExplorer')

async function mine(bot, blockNames, targetCount) {
    const mcData = require('minecraft-data')(bot.version)

    // Convert block names to IDs
    const blockTypes = []
    for (const blockName of blockNames) {
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

    console.log(`Starting to mine ${blockNames.join(', ')} x${targetCount}`)

    while (totalMined < targetCount) {
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
                continue
            } catch (error) {
                console.error('Exploration failed:', error.message)
                exploreAttempts++
                continue
            }
        }

        // Reset explore attempts when blocks are found
        exploreAttempts = 0

        // Create targets
        const targets = blocks
            .slice(0, Math.min(blocks.length, targetCount - totalMined))
            .map(pos => bot.blockAt(pos))
            .filter(block => block !== null)

        console.log(targets)

        if (targets.length === 0) {
            console.log('No valid targets found')
            continue
        }

        try {
            // Collect the blocks
            await bot.collectBlock.collect(targets)
            totalMined += targets.length
            console.log(`Mined ${targets.length} blocks. Total: ${totalMined}/${targetCount}`)
        } catch (error) {
            console.error('Failed to collect blocks:', error.message)
            // Try exploring after collection failure
            try {
                await randomExplore(bot, 16, 32)
            } catch (exploreError) {
                console.error('Recovery exploration failed:', exploreError.message)
            }
        }
    }

    console.log(`Mining completed. Mined ${totalMined} out of ${targetCount} requested blocks`)
    return {
        requested: targetCount,
        mined: totalMined,
        success: totalMined >= targetCount
    }
}

module.exports = { mine }