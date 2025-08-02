// Intrisics/puppeteerLogger.js - Centralized logging configuration
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
const oldLogsDir = path.join(logsDir, 'old');

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

if (!fs.existsSync(oldLogsDir)) {
    fs.mkdirSync(oldLogsDir, { recursive: true });
}

// Function to format timestamp for archived log files
function getTimestampString() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${day}-${month}-${year}-${hours}:${minutes}:${seconds}`;
}

// Function to archive existing log files
function archiveExistingLogs() {
    const latestLogPath = path.join(logsDir, 'latest.log');
    const errorsLogPath = path.join(logsDir, 'errors.log');

    const timestamp = getTimestampString();

    // Archive latest.log if it exists
    if (fs.existsSync(latestLogPath)) {
        const stats = fs.statSync(latestLogPath);
        if (stats.size > 0) { // Only archive if file has content
            const archivedLatestPath = path.join(oldLogsDir, `${timestamp}.log`);
            fs.renameSync(latestLogPath, archivedLatestPath);
        } else {
            fs.unlinkSync(latestLogPath); // Remove empty file
        }
    }

    // Archive errors.log if it exists
    if (fs.existsSync(errorsLogPath)) {
        const stats = fs.statSync(errorsLogPath);
        if (stats.size > 0) { // Only archive if file has content
            const archivedErrorsPath = path.join(oldLogsDir, `error_${timestamp}.log`);
            fs.renameSync(errorsLogPath, archivedErrorsPath);
        } else {
            fs.unlinkSync(errorsLogPath); // Remove empty file
        }
    }
}

// Archive existing logs before creating new logger
archiveExistingLogs();

// Custom format that mimics Minecraft server logs
const minecraftFormat = winston.format.printf((info) => {
    const { timestamp, level, label, message } = info;

    // Format timestamp as HH:mm:ss
    const time = new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    // Format level to match Minecraft (uppercase, fixed width)
    const formattedLevel = level.toUpperCase().padEnd(5);

    // Include module label if provided
    const moduleLabel = label ? `[${label}] ` : '';

    // Base log line
    let logLine = `[${time} ${formattedLevel}]: ${moduleLabel}${message}`;

    // For ERROR level, add stack trace if available
    if (level === 'error' && info.stack) {
        logLine += '\n' + info.stack;
    }

    return logLine;
});

// Create the logger
const logger = winston.createLogger({
    level: 'info', // Can be changed to 'debug' when needed
    format: winston.format.combine(
        winston.format.timestamp(),
        minecraftFormat
    ),
    transports: [
        // Main log file - always overwrite on start
        new winston.transports.File({
            filename: path.join(logsDir, 'latest.log'),
            options: { flags: 'w' } // 'w' flag overwrites the file
        }),

        // Error-only log file - always overwrite on start
        new winston.transports.File({
            filename: path.join(logsDir, 'errors.log'),
            level: 'error',
            options: { flags: 'w' } // 'w' flag overwrites the file
        })
    ]
});

// Function to gracefully close and archive logs when program exits
function archiveLogsOnExit() {
    const timestamp = getTimestampString();
    const latestLogPath = path.join(logsDir, 'latest.log');
    const errorsLogPath = path.join(logsDir, 'errors.log');

    // Close all transports first
    logger.end();

    // Small delay to ensure files are closed
    setTimeout(() => {
        try {
            // Archive latest.log
            if (fs.existsSync(latestLogPath)) {
                const stats = fs.statSync(latestLogPath);
                if (stats.size > 0) {
                    const archivedLatestPath = path.join(oldLogsDir, `${timestamp}.log`);
                    fs.renameSync(latestLogPath, archivedLatestPath);
                }
            }

            // Archive errors.log
            if (fs.existsSync(errorsLogPath)) {
                const stats = fs.statSync(errorsLogPath);
                if (stats.size > 0) {
                    const archivedErrorsPath = path.join(oldLogsDir, `error_${timestamp}.log`);
                    fs.renameSync(errorsLogPath, archivedErrorsPath);
                }
            }
        } catch (error) {
            console.error('Error archiving logs on exit:', error.message);
        }
    }, 100);
}

// Register exit handlers
process.on('SIGINT', () => {
    archiveLogsOnExit();
    setTimeout(() => process.exit(0), 200);
});

process.on('SIGTERM', () => {
    archiveLogsOnExit();
    setTimeout(() => process.exit(0), 200);
});

// Helper function to create module-specific loggers
function createModuleLogger(moduleName) {
    return {
        error: (message, meta = {}) => logger.error(message, { label: moduleName, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { label: moduleName, ...meta }),
        info: (message, meta = {}) => logger.info(message, { label: moduleName, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { label: moduleName, ...meta })
    };
}

module.exports = {
    logger,
    createModuleLogger
};