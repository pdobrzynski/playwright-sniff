import fs from 'fs';
import { LogLevel } from './types';

/**
 * Current version of the library
 */
export const VERSION = '0.1.0';

/**
 * Clean an error message by removing ANSI codes and truncating
 */
export function cleanErrorMessage(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw);
  
  // Remove ANSI color codes
  const stripped = message.replace(/\u001b\[[0-9;]*m/g, '');
  return stripped
  // Take only the first line
  return stripped.split('\n')[0];
}

/**
 * Calculate the average of an array of numbers
 */
export function calculateAverage(values: number[]): string | null {
  if (!values.length) return null;
  const total = values.reduce((acc, val) => acc + val, 0);
  return (total / values.length).toFixed(2);
}

/**
 * Calculate percentile value from an array of numbers
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (!values.length) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Format a duration in milliseconds to a readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Format a date to a readable string
 */
export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substr(0, 19);
}

/**
 * Create a directory if it doesn't exist
 */
export function createDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Default logger function
 */
export function defaultLogger(message: string, level: LogLevel): void {
  const timestamp = new Date().toISOString();
  
  switch (level) {
    case LogLevel.ERROR:
      console.error(`[${timestamp}] ERROR: ${message}`);
      break;
    case LogLevel.WARN:
      console.warn(`[${timestamp}] WARN: ${message}`);
      break;
    case LogLevel.INFO:
      console.info(`[${timestamp}] INFO: ${message}`);
      break;
    case LogLevel.DEBUG:
      console.debug(`[${timestamp}] DEBUG: ${message}`);
      break;
  }
}

/**
 * Generate a timestamp string for filenames
 */
export function generateTimestamp(): string {
  return new Date().toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .replace('T', '_')
    .replace('Z', '');
}