import { getHelpText, parseArgs } from './config';
import { startServer } from './server';
import { createLogger } from './logger';

const log = createLogger('main');

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    console.log(getHelpText());
    return;
  }

  try {
    await startServer(parsed);
  } catch (error) {
    log.error('Failed to start server', error);
    process.exit(1);
  }
};

main();
