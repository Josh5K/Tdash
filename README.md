# TDash CLI

A powerful CLI tool that generates static HTML dashboards for Terraform and OpenTofu repositories. Get instant insights into your infrastructure code with a beautiful, self-contained HTML report.

https://josh5k.github.io/Tdash/

## Features

- **Provider Analysis**: View all providers used across your Terraform/OpenTofu configuration
- **Module Overview**: See all modules and their usage patterns
- **Resource Inventory**: Comprehensive list of all resources defined in your code
- **Workspace Management**: Monitor multiple workspaces and their states
- **State Drift Detection**: Automatic plan execution to detect configuration drift
- **Static HTML Output**: Generate self-contained HTML files that can be shared or hosted anywhere
- **Multi-Tool Support**: Automatically detects and works with both Terraform and OpenTofu

## Prerequisites

- Node.js 16 or higher
- Terraform or OpenTofu installed and accessible in PATH
  - TDash automatically detects and uses OpenTofu (`tofu`) if available, otherwise falls back to Terraform (`terraform`)
  - OpenTofu is preferred when both are installed
- `hcl2json` binary (see installation instructions below)

### Installing hcl2json

TDash requires the `hcl2json` binary to parse Terraform files. Install it using one of these methods:

#### Linux/WSL:
```bash
wget https://github.com/tmccombs/hcl2json/releases/download/v0.6.7/hcl2json_linux_386

chmod +x hcl2json_linux_386

mv hcl2json_linux_386 ~/.local/bin/hcl2json
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

#### macOS:
```bash
# Using Homebrew
brew install tmccombs/tap/hcl2json

# Or download manually
curl -L https://github.com/tmccombs/hcl2json/releases/download/v0.6.7/hcl2json_darwin_amd64 -o hcl2json
chmod +x hcl2json
sudo mv hcl2json /usr/local/bin/
```

#### Windows:
Download from [GitHub releases](https://github.com/tmccombs/hcl2json/releases) and add to your PATH.

## Installation

### Manual Install:
```bash
# Clone the repository
git clone <repository-url>
cd tdash-cli

# Install dependencies
npm install

# Build the project
npm run build

# Make it executable
chmod +x dist/index.js
```

## Usage

### Basic Usage

```bash
# Generate dashboard for current directory
node dist/index.js generate

# Generate dashboard for specific directory
node dist/index.js generate /path/to/terraform/repo

# Generate dashboard with custom output file
node dist/index.js generate --output my-dashboard.html

# Automatically open browser after generation
node dist/index.js generate --browser
```

### Commands

- `tdash generate [path]` - Generate a static HTML dashboard for the specified Terraform/OpenTofu repository
- `tdash generate --output <file>` - Specify custom output file path (default: docs/tdash-dashboard.html)
- `tdash generate --browser` - Automatically open the browser after generation

## Dashboard Features

### Providers Section
- Lists all providers used in the configuration
- Shows provider versions and configurations
- Displays provider usage statistics

### Modules Section
- Overview of all modules used
- Module source and version information
- Module dependency relationships

### Resources Section
- Complete inventory of all resources
- Resource types and counts
- Resource dependencies and relationships

### Workspaces Section
- List of all available workspaces
- Current workspace status
- State drift detection with visual indicators
- Detailed drift reports showing resources to add, change, or destroy

## Output

The tool generates a self-contained HTML file that includes:
- All Terraform analysis data embedded directly in the HTML
- Modern, responsive design with tabs for different sections
- No external dependencies or server required
- Can be shared via email, hosted on any web server, or opened locally

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

## Troubleshooting

### Common Issues

1. **"hcl2json not found"**: Make sure hcl2json is installed and in your PATH
2. **"No Terraform files found"**: Ensure you're running the command from a directory with `.tf` files
4. **Drift detection fails**: Ensure Terraform is initialized and workspaces are set up correctly

### Debug Mode

Run with verbose logging:
```bash
DEBUG=* node dist/index.js generate
```

## Terraform/OpenTofu Detection

TDash automatically detects which tool is available on your system:

1. **OpenTofu Priority**: If OpenTofu (`tofu`) is available, it will be used first
2. **Terraform Fallback**: If OpenTofu is not available, Terraform (`terraform`) will be used
3. **Version Detection**: The tool will display which version is being used when generating dashboards

You can see which tool is being used in the console output when running the generate command. The detection is cached for performance, but you can clear the cache by restarting the CLI.

## License

MIT