// puppeteerCrafting.js - Combined crafting functionality for both 2x2 and crafting table
const { goals } = require('mineflayer-pathfinder')

const explorer = require('./puppeteerExplorer')
const state = require('../Intrisics/puppeteerState')

const { createModuleLogger } = require('../System/puppeteerLogger')
const log = createModuleLogger('Crafting')

// Craft using 2x2 player inventory grid
async function craftSmall(bot, itemName, amount = 1) {
    const Recipe = require('prismarine-recipe')(bot.version).Recipe

    log.info(`Attempting to craft ${itemName} x${amount}`)

    // Validate item exists
    const itemType = state.mcData.itemsByName[itemName]
    if (!itemType) {
        throw new Error(`Unknown item: ${itemName}`)
    }

    // Find recipes for this item
    const allRecipes = Recipe.find(itemType.id)
    if (allRecipes.length === 0) {
        throw new Error(`No recipes found for ${itemName}`)
    }

    // Filter to only 2x2 recipes
    const smallRecipes = allRecipes.filter(recipe => !recipe.requiresTable)
    if (smallRecipes.length === 0) {
        throw new Error(`${itemName} requires a crafting table`)
    }

    // Find a recipe we can craft with current inventory
    const availableRecipe = findAvailableRecipe(bot, smallRecipes)
    if (!availableRecipe) {
        throw new Error(`Missing ingredients to craft ${itemName}`)
    }

    // Perform crafting
    return await performCrafting(bot, availableRecipe, itemName, amount, null)
}

// Craft using crafting table
async function craft(bot, itemName, amount = 1) {
    const Recipe = require('prismarine-recipe')(bot.version).Recipe

    log.info(`Attempting to craft ${itemName} x${amount} using crafting table`)

    // Validate item exists
    const itemType = state.mcData.itemsByName[itemName]
    if (!itemType) {
        throw new Error(`Unknown item: ${itemName}`)
    }

    // Find recipes for this item
    const allRecipes = Recipe.find(itemType.id)
    if (allRecipes.length === 0) {
        throw new Error(`No recipes found for ${itemName}`)
    }

    // Find a recipe we can craft with current inventory
    const availableRecipe = findAvailableRecipe(bot, allRecipes)
    if (!availableRecipe) {
        throw new Error(`Missing ingredients to craft ${itemName}`)
    }

    // Find nearest crafting table
    log.info('Looking for crafting table...')
    const craftingTable = await explorer.findBlock(bot,'crafting_table')
    if (!craftingTable) {
        throw new Error('No crafting table found nearby')
    }

    log.info(`Found crafting table at ${craftingTable.position}`)

    // Move to crafting table
    await explorer.moveToBlock(bot, craftingTable)

    // Wait a bit to ensure we're in position
    await new Promise(resolve => setTimeout(resolve, 500))

    // Get fresh reference to the crafting table block after moving
    const freshCraftingTable = bot.blockAt(craftingTable.position)
    if (!freshCraftingTable || freshCraftingTable.name !== 'crafting_table') {
        throw new Error('Lost reference to crafting table')
    }

    // No need to open the crafting table - bot.craft handles that internally
    log.info('Ready to craft...')

    let nowAttempts = 0
    const maxCraftAttempts = 10

    while (nowAttempts < maxCraftAttempts) {
        try {
            // Perform crafting - pass the block, not a window
            return await performCrafting(bot, availableRecipe, itemName, amount, freshCraftingTable)

        } catch (error) {
            if (error.message.includes('Failed to craft any') || nowAttempts < maxCraftAttempts) {
                log.warn('Protocol error. Clicking again')
                nowAttempts++
            }
            else throw error
        }
    }

}

// Shared function to perform the actual crafting
async function performCrafting(bot, recipe, itemName, amount, craftingTable) {
    // Calculate how many times to craft
    const resultCount = recipe.result.count || 1
    const craftTimes = Math.ceil(amount / resultCount)

    log.info(`Will craft ${craftTimes} times to get ${amount} ${itemName}`)

    let totalCrafted = 0

    // Get initial inventory count of the target item
    const initialCount = getItemCount(bot, itemName)

    // Perform crafting
    for (let i = 0; i < craftTimes; i++) {
        try {
            // Check if we still have ingredients
            if (!canCraftRecipe(bot, recipe)) {
                log.warn('Out of ingredients')
                break
            }

            // Store inventory state before crafting
            const beforeCraftCount = getItemCount(bot, itemName)

            // Set up error listener for protocol errors
            let protocolError = null
            const errorHandler = (err) => {
                if (err.message && err.message.includes('PartialReadError')) {
                    protocolError = err
                    log.error('Protocol error detected during crafting:', {
                        stack: err.stack
                    })
                }
            }

            // Add temporary error listener
            bot._client.on('error', errorHandler)

            try {
                // Use mineflayer's built-in crafting - pass the block for crafting table, null for inventory
                await bot.craft(recipe, 1, craftingTable)

                // Wait a bit for inventory to update
                await new Promise(resolve => setTimeout(resolve, 500))

                // Verify the craft actually succeeded by checking inventory
                const afterCraftCount = getItemCount(bot, itemName)
                const actualCrafted = afterCraftCount - beforeCraftCount

                if (actualCrafted > 0) {
                    totalCrafted += actualCrafted
                    log.info(`Crafted ${actualCrafted} ${itemName}. Total: ${totalCrafted}`)
                } else {
                    log.warn(`Craft appears to have failed - no items were created`)
                    throw new Error('Craft failed - no items created')
                }

            } finally {
                // Remove error listener
                bot._client.removeListener('error', errorHandler)
            }

            // Small delay between crafts
            await new Promise(resolve => setTimeout(resolve, 300))

        } catch (error) {
            log.error(`Craft failed on attempt ${i + 1}: ${error.message}`)

            // If it's a protocol error, we might want to abort completely
            if (error.message.includes('Protocol error')) {
                log.error('Aborting crafting due to protocol error')
                throw new Error('Craft failed - protocol error')
            }
        }
    }

    // Final verification
    const finalCount = getItemCount(bot, itemName)
    const actualTotalCrafted = finalCount - initialCount

    if (actualTotalCrafted > 0) {
        totalCrafted = actualTotalCrafted // Use the actual count
    }

    if (totalCrafted === 0) {
        throw new Error(`Failed to craft any ${itemName}`)
    }

    log.info(`Successfully crafted ${totalCrafted} ${itemName}`)

    return {
        success: true,
        itemName: itemName,
        requested: amount,
        crafted: totalCrafted,
        message: `Crafted ${totalCrafted} ${itemName}${craftingTable ? ' using crafting table' : ''}`
    }
}

// Helper function to count items in inventory
function getItemCount(bot, itemName) {
    const item = state.mcData.itemsByName[itemName]
    if (!item) return 0

    return bot.inventory.items()
        .filter(invItem => invItem.type === item.id)
        .reduce((sum, invItem) => sum + invItem.count, 0)
}

// Find a recipe that we have ingredients for
function findAvailableRecipe(bot, recipes) {
    // Try each recipe to see which one we can make
    for (const recipe of recipes) {
        if (canCraftRecipe(bot, recipe)) {
            return recipe
        }
    }
    return null
}

// Check if we have enough ingredients for a recipe
function canCraftRecipe(bot, recipe) {
    const inventory = bot.inventory.items()
    const required = {}

    // Count required items
    if (recipe.inShape) {
        // Shaped recipe
        for (const row of recipe.inShape) {
            for (const item of row) {
                if (item && item.id !== null) {
                    required[item.id] = (required[item.id] || 0) + (item.count || 1)
                }
            }
        }
    } else if (recipe.ingredients) {
        // Shapeless recipe
        for (const item of recipe.ingredients) {
            if (item && item.id !== null) {
                required[item.id] = (required[item.id] || 0) + (item.count || 1)
            }
        }
    }

    // Check if we have enough of each item
    for (const [itemId, count] of Object.entries(required)) {
        // Recipe badness. Looking for item -1???
        if (itemId === '-1') continue

        const available = inventory
            .filter(item => item.type === parseInt(itemId))
            .reduce((sum, item) => sum + item.count, 0)

        if (available < count) {
            return false
        }
    }

    return true
}

module.exports = {
    craftSmall,
    craft
}