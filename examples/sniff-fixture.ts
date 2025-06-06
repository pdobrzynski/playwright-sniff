import {test as base} from "@playwright/test"
import { SniffOptions } from "../src/types";
import { PlaywrightSniff } from "../src/monitor";

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
    
    sniff.setTestName(testInfo.title)
    await sniff.start();
    

    // Use the sniff instance in the test
    await use(sniff);
    
    // Capture and save final stats
    // sniff.saveReport();
    // sniff.generateHTMLReport();
    sniff.stop();
  }
});

export { expect } from '@playwright/test';