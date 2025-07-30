async function craftSmall(bot, itemName, amount = 1) {
    const mcData = require('minecraft-data')(bot.version)
    const Recipe = require('prismarine-recipe')(bot.version).Recipe

    console.log(`Attempting to craft ${itemName} x${amount}`)

    // Validate item exists
    const itemType = mcData.itemsByName[itemName]
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

    // Calculate how many times to craft
    const resultCount = availableRecipe.result.count || 1
    const craftTimes = Math.ceil(amount / resultCount)

    console.log(`Will craft ${craftTimes} times to get ${amount} ${itemName}`)

    let totalCrafted = 0

    // Perform crafting
    for (let i = 0; i < craftTimes; i++) {
        try {
            // Use mineflayer's built-in crafting
            await bot.craft(availableRecipe, 1, null) // null means use inventory crafting
            totalCrafted += resultCount
            console.log(`Crafted ${resultCount} ${itemName}. Total: ${totalCrafted}`)

            // Small delay between crafts
            await new Promise(resolve => setTimeout(resolve, 300))

        } catch (error) {
            console.error(`Craft failed on attempt ${i + 1}: ${error.message}`)
            break
        }
    }

    if (totalCrafted === 0) {
        throw new Error(`Failed to craft any ${itemName}`)
    }

    console.log(`Successfully crafted ${totalCrafted} ${itemName}`)

    return {
        success: true,
        itemName: itemName,
        requested: amount,
        crafted: totalCrafted,
        message: `Crafted ${totalCrafted} ${itemName}`
    }
}

function findAvailableRecipe(bot, recipes) {
    // Try each recipe to see which one we can make
    for (const recipe of recipes) {
        if (canCraftRecipe(bot, recipe)) {
            return recipe
        }
    }
    return null
}

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
        const available = inventory
            .filter(item => item.type === parseInt(itemId))
            .reduce((sum, item) => sum + item.count, 0)

        if (available < count) {
            return false
        }
    }

    return true
}

module.exports = { craftSmall }