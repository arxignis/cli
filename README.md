# Arxignis CLI

## 🎉 Join Our Discord Community! 🎉

Come hang out with us and be part of our awesome community on Discord! Whether you're here to chat, get support, or just have fun, everyone is welcome.

[![Join us on Discord](https://img.shields.io/badge/Join%20Us%20on-Discord-5865F2?logo=discord&logoColor=white)](https://discord.gg/jzsW5Q6s9q)

See you there! 💬✨

A command-line interface tool for managing Arxignis sites and their settings.

## Installation

1. Make sure you have [Deno](https://deno.land/) installed
2. Clone this repository
3. Compile the CLI:
```bash
deno task compile
```

The compiled binary will be available at `dist/ax`.

## Configuration

### Environment Variables

- `CLI_API_URL`: API endpoint URL (default: https://api.arxignis.com.)

### Local Storage

The CLI stores authentication tokens in `~/.ax/cache.db`.

## Usage

### Initialization

Initialize the CLI with your first site configuration:

```bash
./ax init
```

This will:
1. Check if you have a login token
2. Guide you through registration if needed
3. Help you set up your first site configuration
4. Create a config file in the `configs` directory

### Authentication

```bash
# Register a new account
./ax register

# Login with your token
./ax login
```

### Managing Sites

#### List Sites
```bash
# List all sites
./ax site list

# List a specific site
./ax site list -d example.com
```

#### Create Site
```bash
# Create a site with domain specified
./ax site create -d example.com

# Create a site with interactive domain input
./ax site create
```

### Cache Management

#### Purge Cache
```bash
# Purge a specific URL from the cache
./ax purge url-purge -d example.com -u https://example.com/path

# Purge all URLs from the cache for a domain
./ax purge all -d example.com
```

### Managing Settings

Update site settings using a YAML configuration file:

```bash
./ax settings -d example.com -c configs/example.com.yaml
```

The config file should follow this structure:
```yaml
https_redirect: false
target: example.com
hsts_enabled: false
ssl: flexible
rate_limit: []
upload_limit: []
av_scan: []
transformation:
  request_headers: []
  response_headers: []
rewrite: []
waf: []
yara: []
```
[Check example config](./example/example_com.yaml)

## Development

```bash
# Run tests
deno task test

# Compile the CLI
deno task compile
```

## Error Handling

The CLI provides clear error messages for:
- Invalid domain names
- Authentication failures
- API errors
- Invalid response formats
- Missing configuration
- File operation errors

## API Endpoints

The CLI interacts with the following API endpoints:
- `${CLI_API_URL}/v1/sites`
- `${CLI_API_URL}/v1/site/settings/{domain}`

## Requirements

- Deno 1.0.0 or higher
- Internet connection for API access
- Valid Arxignis account and API token

## License

[You can read license here](./License)
