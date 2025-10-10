import { sqlitePipeline } from './sqlite_vectordb';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface Config {
    ballerinaDir: string;
    voyageApiKey: string;
    dbPath: string;
    outputDir: string;
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): Config {
    const ballerinaDir = process.env.BALLERINA_DIR || 'ballerina';
    const voyageApiKey = process.env.VOYAGE_API_KEY || '';
    const dbPath = process.env.DB_PATH || 'outputs/sqlite_outputs/vector_database.db';
    const outputDir = process.env.OUTPUT_DIR || '/outputs/sqlite_outputs';

    return {
        ballerinaDir,
        voyageApiKey,
        dbPath,
        outputDir
    };
}

/**
 * Validate configuration
 */
async function validateConfig(config: Config): Promise<void> {
    // Check ballerina directory
    try {
        await fs.access(config.ballerinaDir);
    } catch {
        throw new Error(` Ballerina directory not found: ${config.ballerinaDir}`);
    }

    // Check API key
    if (!config.voyageApiKey || config.voyageApiKey.trim().length === 0) {
        throw new Error(' VOYAGE_API_KEY is empty or not set. Please set VOYAGE_API_KEY environment variable.');
    }

    console.log('✓ Configuration validated\n');
}

/**
 * Initialize output directories
 */
async function initializeOutputDirs(outputDir: string): Promise<void> {
    const dirs = [
        outputDir,
        path.join(outputDir, 'relevant_chunks'),
        path.join(outputDir, 'logs')
    ];

    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }

    console.log('✓ Output directories initialized\n');
}

/**
 * Setup file logging
 */
function setupLogging(outputDir: string): { logFile: string; close: () => void } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = path.join(outputDir, 'logs', `pipeline_${timestamp}.log`);

    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalTime = console.time;
    const originalTimeEnd = console.timeEnd;

    const writeLog = (message: string, level: string = 'INFO'): void => {
        try {
            const now = new Date().toISOString();
            const logMessage = `[${now}] [${level}] ${message}\n`;
            fsSync.appendFileSync(logFile, logMessage);
        } catch (err) {
            // Silently fail if logging fails
        }
    };

    console.log = (...args: any[]): void => {
        const message = args.join(' ');
        originalLog(...args);
        writeLog(message, 'INFO');
    };

    console.error = (...args: any[]): void => {
        const message = args.join(' ');
        originalError(...args);
        writeLog(message, 'ERROR');
    };

    console.warn = (...args: any[]): void => {
        const message = args.join(' ');
        originalWarn(...args);
        writeLog(message, 'WARN');
    };

    console.time = (label: string): void => {
        originalTime(label);
        writeLog(`Timer started: ${label}`, 'DEBUG');
    };

    console.timeEnd = (label: string): void => {
        originalTimeEnd(label);
        writeLog(`Timer ended: ${label}`, 'DEBUG');
    };

    const close = (): void => {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        console.time = originalTime;
        console.timeEnd = originalTimeEnd;
    };

    return { logFile, close };
}

/**
 * Display configuration summary
 */
function displayConfigSummary(config: Config): void {
    console.log(' SQLite Vector Database Pipeline Configuration...');
    console.log(` Ballerina Directory: ${config.ballerinaDir}`);
    console.log(` Database Path: ${config.dbPath}`);
    console.log(` Output Directory: ${config.outputDir}`);
    console.log(` Voyage API Key: ${config.voyageApiKey.substring(0, 10)}...`);
    console.log('\n' + '═'.repeat(61) + '\n');
}

/**
 * Display completion summary
 */
function displayCompletionSummary(config: Config, startTime: number): void {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '═'.repeat(61));
    console.log(' Pipeline Execution Completed Successfully!\n');
    console.log(` Total Duration: ${duration}s`);
    console.log(` Results Location: ${config.outputDir}`);
    console.log(` Database Location: ${config.dbPath}`);
    console.log('═'.repeat(61) + '\n');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    const startTime = Date.now();
    let loggerCleanup: { close: () => void } | null = null;

    console.log('\n Starting SQLite Vector Database Pipeline...\n');

    try {
        // Step 1: Load and validate configuration
        console.log(' Loading configuration...');
        const config = loadConfig();
        await validateConfig(config);
        displayConfigSummary(config);

        // Step 2: Initialize output directories and logging
        console.log(' Initializing output directories...');
        await initializeOutputDirs(config.outputDir);
        loggerCleanup = setupLogging(config.outputDir);
        console.log(' Logging initialized\n');

        // Step 3: Run the SQLite pipeline
        console.log(' Starting pipeline execution...\n');
        await sqlitePipeline(config.ballerinaDir, config.voyageApiKey);

        // Step 4: Success message
        displayCompletionSummary(config, startTime);

    } catch (error) {
        console.error('\n Pipeline execution failed!\n');

        if (error instanceof Error) {
            console.error(`Error Message: ${error.message}`);
            if (error.stack) {
                console.error(`\nStack Trace:\n${error.stack}`);
            }
        } else {
            console.error(`Unexpected error: ${JSON.stringify(error)}`);
        }

        process.exit(1);
    } finally {
        if (loggerCleanup) {
            loggerCleanup.close();
        }
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    console.error('\n Uncaught Exception:', error.message);
    if (error.stack) {
        console.error(error.stack);
    }
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
    console.error('\n Unhandled Promise Rejection');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n  Pipeline interrupted by user (SIGINT)');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n  Pipeline terminated (SIGTERM)');
    process.exit(0);
});

// Run main function
main().catch((error: Error) => {
    console.error('Fatal error in main:', error.message);
    process.exit(1);
});