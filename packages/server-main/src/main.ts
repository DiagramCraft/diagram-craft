import { getHelpText, parseArgs } from './config';
import { startServer } from './server';

const main = async () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    console.log(getHelpText());
    return;
  }

  try {
    await startServer(parsed);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

main();
