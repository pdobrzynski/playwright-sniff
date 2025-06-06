import { PlaywrightSniff } from '../src/monitor';
import { defaultLogger } from '../src/utils';
import { test, expect } from './sniff-fixture';

// test.use({
//   sniffOptions: {
//       slowThreshold: 2000,
//       outputFile: 'sniffing-results.json',
//       outputHTML: 'sniffing-report.html',
//       captureScreenshots: false,
//       screenshotDir: './screenshots',
//       logger: defaultLogger
//     }
// })

test.describe('Example using playwright-sniff', () => {
  test('Basic usage of playwright-sniff', async ({ page }) => {
    // Initialize the monitoring with the page
    const sniff = new PlaywrightSniff({
      page,
      options: {
        slowThreshold: 2000,
        outputFile: 'sniffing-results.json',
        outputHTML: 'sniffing-report.html',
        captureScreenshots: false,
        screenshotDir: './screenshots',
      }
    });

    // Start monitoring
    sniff.setTestName(test.info().title);
    await sniff.start();

    // Example of measuring navigation action
    await sniff.measureAction(
      async () => { await page.goto('https://playwright.dev/') },
      'Open Playwright Page'
    );

    // Example of measuring click action
    await sniff.measureAction(
      async () => { await page.getByRole('link', { name: 'Get started' }).click() },
      'Click Link'
    );

    // Example of assertion action
    await sniff.measureAction(
      async () => {
        await expect(page.getByRole('button', { name: 'Installation' })).toBeVisible()
      },
      'Expects page to have a heading with the name of Installation'
    );

    // You can add custom failures
    sniff.addFailure('Example custom failure', 'custom', { additionalInfo: 'test' });

    // You can add custom showstoppers
    await sniff.addShowStopper('Manual check', 'Found an issue during manual verification');

    // Generate and save report
    //const reportPath = sniff.saveReport();
    //console.log(`Report saved to: ${reportPath}`);

    // Get results programmatically
    // const results = sniff.getResults();
    // console.log(`Average load time: ${results.reportData[0].avgLoadTime}ms`);
    // console.log(`Slow actions: ${results.reportData[0].pageLoadSteps.filter(step => step.slow).length}`);

    // Check for showstoppers
    // if (sniff.hasShowStoppers()) {
    //   const showstoppers = sniff.getShowStoppers();
    //   console.error('Showstoppers detected:');
    //   showstoppers.forEach(stopper => {
    //     console.error(`- ${stopper.label}: ${stopper.criticalError}`);
    //   });
    // }

    // Stop monitoring
    // sniff.stop();
  });

    test('playwright-sniff from sniff-fixture', async ({ page, sniff }) => {
    // Example of measuring navigation action
    await sniff.measureAction(
      async () => { await page.goto('https://playwright.dev/') },
      'Open Playwright Page'
    );

    // Example of measuring click action
    await sniff.measureAction(
      async () => { await page.getByRole('link', { name: 'Get started' }).click() },
      'Click Link'
    );

    // Example of assertion action
    await sniff.measureAction(
      async () => {
        await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible()
      },
      'Expects page to have a heading with the name of Installation'
    );
  });
});