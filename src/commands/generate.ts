import { Command } from 'commander';
import { generateStaticDashboard } from '../utils/dashboard-generator';
import { openBrowser } from '../utils/browser';
import { validateTerraformPath } from '../utils/validation';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';

interface GenerateOptions {
  browser: boolean;
  output?: string;
  datadog?: boolean;
  'datadog-site'?: string;
  'datadog-prefix'?: string;
  'datadog-tags'?: string;
  'datadog-api-key'?: string;
  'datadog-app-key'?: string;
  repository?: string;
  environment?: string;
}

export async function generateDashboard(path: string, options: GenerateOptions): Promise<void> {
  const spinner = ora('Initializing TDash...').start();
  
  try {
    // Validate the provided path
    const terraformPath = await validateTerraformPath(path);
    spinner.text = 'Analyzing Terraform/OpenTofu configuration...';
    
    // Prepare Datadog options if enabled
    const dashboardOptions: any = {};
    if (options.datadog) {
      dashboardOptions.enableDatadogMetrics = true;
      dashboardOptions.datadogConfig = {
        site: options['datadog-site'],
        prefix: options['datadog-prefix'],
        tags: options['datadog-tags'] ? options['datadog-tags'].split(',').map(tag => tag.trim()) : undefined,
        apiKey: options['datadog-api-key'],
        appKey: options['datadog-app-key']
      };
      dashboardOptions.repository = options.repository;
      dashboardOptions.environment = options.environment;
    }
    
    // Generate the static dashboard
    const htmlContent = await generateStaticDashboard(terraformPath, dashboardOptions);
    
    // Determine output file path. By default we will write to docs/index.html to make it easier to deploy to github pages.
    let outputPath = options.output || join(process.cwd(), 'docs', 'index.html');
    outputPath = resolve(outputPath);
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    // Write the HTML file
    spinner.text = 'Generating dashboard...';
    writeFileSync(outputPath, htmlContent, 'utf-8');
    
    spinner.succeed('TDash dashboard generated successfully!');
    
    console.log(chalk.green(`\n📊 Dashboard saved to: ${chalk.underline(outputPath)}`));
    
    // Open browser if requested
    if (options.browser) {
      const fileUrl = `file://${outputPath}`;
      await openBrowser(fileUrl);
    } else {
      console.log(chalk.yellow(`\nOpen the file in your browser to view the dashboard:`));
      console.log(chalk.cyan(`  ${outputPath}`));
    }
    
  } catch (error) {
    spinner.fail('Failed to generate TDash dashboard');
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

export function registerGenerateCommand(program: Command): void {
  program
    .command('generate <path>')
    .description('Generate a static HTML dashboard for Terraform/OpenTofu repository')
    .option('--browser', 'Open browser automatically')
    .option('-o, --output <file>', 'Output file path for static HTML (default: docs/index.html)')
    .option('--datadog', 'Enable Datadog metrics sending')
    .option('--datadog-site <site>', 'Datadog site (default: datadoghq.com)')
    .option('--datadog-prefix <prefix>', 'Metric prefix (default: tdash.)')
    .option('--datadog-tags <tags>', 'Comma-separated list of tags')
    .option('--datadog-api-key <key>', 'Datadog API key')
    .option('--datadog-app-key <key>', 'Datadog App key')
    .option('--repository <name>', 'Repository name for metrics tagging')
    .option('--environment <env>', 'Environment name for metrics tagging')
    .action(async (path: string, options: GenerateOptions) => {
      await generateDashboard(path, options);
    });
} 