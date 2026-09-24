import { runScenarioValidationCli } from '../src/scenario/cli.ts';

process.exitCode = await runScenarioValidationCli(process.argv.slice(2));
