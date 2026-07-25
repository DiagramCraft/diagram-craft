import 'dotenv/config';
import { readConfig } from './config.js';
import { syncOrganization, printReport } from './sync.js';

const main = async (): Promise<void> => {
  try {
    // Parse configuration
    const config = readConfig(process.argv.slice(2));

    // Run sync
    const report = await syncOrganization(config.githubOrg, config);

    // Print report
    printReport(report);

    // Exit with error code if there were failures
    if (report.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

main();
