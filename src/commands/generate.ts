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
}

export async function generateDashboard(path: string, options: GenerateOptions): Promise<void> {
  const spinner = ora('Initializing TDash...').start();
  
  try {
    // Validate the provided path
    const terraformPath = await validateTerraformPath(path);
    spinner.text = 'Analyzing Terraform/OpenTofu configuration...';
    
    // Generate the static dashboard
    const htmlContent = await generateStaticDashboard(terraformPath);
    
    // Determine output file path (default: docs/tdash-dashboard.html)
    let outputPath = options.output || join(process.cwd(), 'docs', 'tdash-dashboard.html');
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
    .option('-o, --output <file>', 'Output file path for static HTML (default: docs/tdash-dashboard.html)')
    .action(async (path: string, options: GenerateOptions) => {
      await generateDashboard(path, options);
    });
} 