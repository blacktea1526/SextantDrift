import { pathToFileURL } from 'node:url';

export interface GenerateConfigOptions {
  rootDir: string;
  reporterPath: string;
  runnerPath: string;
  includeFiles: string[];
}

export function generateConfigSource(options: GenerateConfigOptions): string {
  const { rootDir, reporterPath, runnerPath, includeFiles } = options;
  const reporterUrl = pathToFileURL(reporterPath).href;

  return `import CustomReporter from ${JSON.stringify(reporterUrl)};

export default {
  test: {
    root: ${JSON.stringify(rootDir)},
    watch: false,
    retry: 0,
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 2,
      },
    },
    maxWorkers: 2,
    minWorkers: 1,
    include: ${JSON.stringify(includeFiles)},
    runner: ${JSON.stringify(runnerPath)},
    reporters: [
      new CustomReporter(),
    ],
    passWithNoTests: true,
    includeTaskLocation: true,
    dangerouslyIgnoreUnhandledErrors: false,
  },
};
`;
}
