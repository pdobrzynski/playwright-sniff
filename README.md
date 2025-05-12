# playwright-sniff

A monitoring library for Playwright that measures action times, catches showstoppers, and generates comprehensive reports. By default, it collects showstoppers throughout test execution rather than failing immediately, displaying all issues in a consolidated report at the end.

## Features

- 📊 **Performance Monitoring**: Track execution time for Playwright actions
- 🚨 **Showstopper Detection**: Identify and log critical issues that block test execution
- 📝 **Report Generation**: Create detailed reports of test execution performance
- 🔄 **Low Overhead**: Minimal impact on your existing Playwright tests
- 🌐 **Network Monitoring**: Track HTTP requests and detect slow or failed requests

## Installation

```bash
npm install playwright-sniff
```

## Basic Usage

```typescript
import { test } from '@playwright/test';
import { PlaywrightSniff } from 'playwright-sniff';

test('Monitor performance', async ({ page }) => {
  // Initialize the monitoring
  const sniff = new PlaywrightSniff({ page });
  
  // Start monitoring
  sniff.start();
  
  // Measure specific actions
  await sniff.measureAction(
    async () => { await page.goto('https://example.com') },
    'Navigation to home page'
  );
  
  await sniff.measureAction(
    async () => { await page.click('button.login') },
    'Click login button'
  );
  
  // Generate and save report
  sniff.saveReport();
  
  // Stop monitoring
  sniff.stop();
  
  // Check for showstoppers
  if (sniff.hasShowStoppers()) {
    throw new Error('Test failed due to detected showstoppers');
  }
});
```

## Integration with Playwright Tests (Recommended)

```typescript
import { test as base } from '@playwright/test';
import { PlaywrightSniff } from 'playwright-sniff';

export const test = base.extend<{
  sniffOptions: Required<SniffOptions>;
  sniff: PlaywrightSniff;
}>({
  // First fixture: provides the merged options
  sniffOptions: async ({}, use, testInfo) => {
    // Get default options from PlaywrightSniff class
    const defaultOptions = PlaywrightSniff.DEFAULT_OPTIONS;
    
    // Get options from playwright.config.ts if available
    const configOptions = testInfo.project.use?.sniffOptions || {};
    
    // Combine defaults with config options
    const options = {
      ...defaultOptions,
      ...configOptions
    };
    
    // Provide the combined options to the test
    await use(options);
  },
  
  // Second fixture: provides a preconfigured PlaywrightSniff instance
  sniff: async ({ page, sniffOptions }, use, testInfo) => {
    // Create a PlaywrightSniff instance with the merged options
    const sniff = new PlaywrightSniff({
      page,
      options: sniffOptions // Use the options from the sniffOptions fixture
    });

    await sniff.start();
    sniff.setTestName(testInfo.title)

    // Use the sniff instance in the test
    await use(sniff);
    
    // Capture and save final stats
    sniff.saveReport();
    sniff.generateHTMLReport();
    sniff.stop();
  }
});

// Use in tests
test('Example test with sniffing', async ({ page, sniff }) => {
  await sniff.measureAction(
    async () => { await page.goto('https://example.com') },
    'Open page'
  );
  
  // You can add custom failures
  sniff.addFailure('Example custom failure', 'custom');

  // You can add custom showstoppers
  await sniff.addShowStopper('Manual check', 'Found an issue during manual verification');
  // Rest of your test...
});
```
## Global configuration
```typescript
// You can set global configuration for all tests in playwright.config in the use: {} section
sniffOptions: {
      slowThreshold: 2000,
      outputFile: 'sniffing-results.json',
      outputHTML: 'sniffing-report.html',
      captureScreenshots: false,
    }

```
## Configuration Options

```typescript
const sniff = new PlaywrightSniff({
  page,
  options: {
    slowThreshold: 2000,     // Flag actions taking longer than 2000ms (default)
    captureScreenshots: true, // Take screenshots on showstoppers (default)
    screenshotDir: './screenshots', // Where to save screenshots (default)
    outputFile: 'sniffing-results.json', // Report filename (default)
    outputHTML: 'sniffing-report.html', // HTML report (default)
    logger: customLoggerFunction // Custom logging function (optional)
  }
});
```

## API Reference

### `PlaywrightSniff`

The main class that provides monitoring functionality.

#### Constructor

```typescript
new PlaywrightSniff({ page, options? })
```

#### Methods

- `start()`: Start monitoring Playwright actions
- `stop()`: Stop monitoring
- `measureAction(action: () => Promise<void>, label: string)`: Measure the execution time of an action/actions
- `addFailure(error: string, type?: 'console' | 'request' | 'custom', metadata?: Record<string, any>)`: Add a custom failure
- `addShowStopper(label: string, criticalError: string)`: Add a custom showstopper
- `getResults()`: Get the current monitoring results
- `saveReport(outputFile?: string)`: Generate and save a report to a file
- `generateHTMLReport(outputFile?: string)`: Generate html report based on test results
- `hasShowStoppers()`: Check if there are any showstoppers
- `getShowStoppers()`: Get the list of showstoppers
- `setupAlertHandler(locator: Locator)`: Setup handler for unwanted locator, e.g alert box

### Data Types

#### `ActionTiming`

Information about a measured action's performance.

```typescript
interface ActionTiming {
  label: string;      // Identifier for the action
  duration: number;   // Time taken in ms
  slow: boolean;      // Whether it exceeded the slow threshold
}
```

#### `ShowStopper`

Critical errors that should fail the test.

```typescript
interface ShowStopper {
  label: string;          // Where the error occurred
  criticalError: string;  // Error description
  screenshot?: string;    // Path to screenshot if captured
}
```

#### `Failures`

Non-critical fails like console error or 4xx request

```typescript
interface Failure {
  error: string | undefined;                // Error description
  type: 'console' | 'request' | 'custom';   // Type of failure
  requestUrl?: string;                      // URL of the request
  requestStatus?: number | null;            // Status code of the request
  requestMethod?: string;                   // HTTP method of the request
}
```

#### `SniffReport`

Complete report structure returned by `getResults()`.

```typescript
interface SniffReport {
  timestamp: string;
  passed: boolean;
  showStoppers: ShowStopper[];
  slowThreshold: number;
  pageLoadSteps: ActionTiming[];
  avgLoadTime: string | null;
  avgRequestTime: string | null;
  slowRequests: RequestDetails[];
  failures: Failure[];
}
```

### HTML Report
![htmlreport](https://github.com/user-attachments/assets/2e041b0d-1c83-4ec8-a128-82280c99b9fd)



## License

MIT
