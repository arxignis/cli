/// <reference lib="deno.unstable" />
import { Command } from "jsr:@cliffy/command@^1.0.0-rc.7";
import { Input, Secret, Confirm } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { Table } from "jsr:@cliffy/table@^1.0.0-rc.7";
import { parse, stringify } from 'jsr:@std/yaml';
import { prompt } from "jsr:@cliffy/prompt@^1.0.0-rc.7";

interface Site {
  id: string;
  domain: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const plainConfig = {
  https_redirect: false,
  target: 'placeholder',
  hsts_enabled: false,
  url_normalization: false,
  ssl: 'flexible',
  av_scan: [],
  upload_limit: [],
  rate_limit: [],
  transformation: {
    request_headers: [],
    response_headers: [],
  },
  rewrite: [],
  waf: [],
  yara: [],
};

const CLI_API_URL = Deno.env.get('CLI_API_URL') || 'https://api.arxignis.com';
const CLI_SIGNUP_URL = Deno.env.get('CLI_SIGNUP_URL') || 'https://dash.arxignis.com/auth/signup';

const generateConfig = (domain: string) => {
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  const config = {
    ...plainConfig,
    target: cleanDomain,
  };
  return stringify(config);
};

const kvPath = Deno.env.get('HOME') + '/.ax';

const validateDomain = (value: string): string | true => {
  if (value.length < 3 || value.length > 253) {
    return 'Domain name must be between 3 and 253 characters long';
  }
  const parts = value.split('.');
  if (parts.length < 2) {
    return 'Domain name must include a TLD (e.g., example.com)';
  }
  const domain = parts[0];
  if (!domain.match(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/)) {
    return 'Domain name must be a valid domain name';
  }
  return true;
};

const validateUrl = (value: string): string | true => {
  const cleanValue = value.replace(/^https?:\/\//, '');

  if (/^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9])*$/.test(cleanValue) ||
      /^(\d{1,3}\.){3}\d{1,3}$/.test(cleanValue)) {
    return true;
  }
  return 'Please enter a valid domain name or IP address (e.g., example.com or 192.168.1.1)';
};

const httpRequest = async (url: string, method: string, headers: Record<string, string>, body: string) => {
  let response;
  if (method === 'GET' || method === 'DELETE' || method === 'HEAD') {
    response = await fetch(url, {
      method,
      headers,
    });
  } else {
    response = await fetch(url, {
      method,
      headers,
      body,
    });
  }
  if (!response.ok) {
    const errorData = await response.json();
    console.error('API Error:', errorData);
    Deno.exit(1);
  }
  return response;
};

const loginTest = async (token: string) => {
  const response = await httpRequest(`${CLI_API_URL}/v1/sites`, 'GET', {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Arxignis CLI {{version}}',
  }, '');
  if (!response.ok) {
    console.error('Login failed');
    Deno.exit(1);
  }
  return true;
};

const renderSitesTable = (sites: Site[]) => {
  if (!Array.isArray(sites)) {
    console.error('Invalid response format: expected an array of sites');
    Deno.exit(1);
  }

  if (sites.length === 0) {
    console.log('No sites found');
    return;
  }

  const headers = ['ID', 'Domain', 'Status', 'Created At', 'Updated At'];
  new Table()
    .header(headers)
    .body(sites.map((site: Site) => [
      site.id,
      site.domain,
      site.status,
      site.createdAt,
      site.updatedAt
    ] as string[]))
    .maxColWidth(30)
    .padding(1)
    .indent(2)
    .border()
    .render();
};

const fetchSites = async (token: string, domain?: string) => {
  const url = domain
    ? `${CLI_API_URL}/v1/sites/${domain}`
    : `${CLI_API_URL}/v1/sites`;

  try {
    const response = await httpRequest(url, 'GET', {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Arxignis CLI {{version}}',
    }, '');

    const data = await response.json();

    // If it's a single site response, wrap it in an array
    if (!Array.isArray(data)) {
      if (data && typeof data === 'object') {
        return [data as Site];
      }
      console.error('Invalid response format: expected an array or object');
      Deno.exit(1);
    }

    return data as Site[];
  } catch (error) {
    console.error('Error fetching sites:', error);
    Deno.exit(1);
  }
};

const siteCommand = new Command().command(
  'list',
  new Command().description('List all sites')
  .option('-d, --domain <domain:string>', 'Domain name', { required: false })
  .action(async (options: { domain?: string }) => {
    const token = await getLoginToken();
    const sites = await fetchSites(token as string, options.domain);
    renderSitesTable(sites);
  })
).command(
  'create',
  new Command().description('Create a new site')
  .option('-d, --domain <domain:string>', 'Domain name', { required: true })
  .action(async (options: { domain: string }) => {
    if (!options.domain) {
      const domain = await Input.prompt('Enter the domain name');
      options.domain = domain;
    }
    const token = await getLoginToken();
    const response = await httpRequest(`${CLI_API_URL}/v1/sites/${options.domain}`, 'POST', {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Arxignis CLI {{version}}',
    }, JSON.stringify({ domain: options.domain }));
    return response.body;
  })
);

const purgeCommand = new Command().command(
  'url-purge',
  new Command().description('Purge a specific URL from the cache')
  .option('-d, --domain <domain:string>', 'Domain name', { required: true })
  .option('-u, --url <url:string>', 'URL to purge', { required: true })
  .action(async (options: { domain: string, url: string }) => {
    const token = await getLoginToken();
    const response = await httpRequest(`${CLI_API_URL}/v1/sites/${options.domain}/purge`, 'POST', {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Arxignis CLI {{version}}',
    }, JSON.stringify({ type: 'url', url: options.url }));
    return response.body;
  })
  .command(
    'all',
    new Command().description('Purge all URLs from the cache')
    .option('-d, --domain <domain:string>', 'Domain name', { required: true })
    .action(async (options: { domain: string }) => {
      const token = await getLoginToken();
      const response = await httpRequest(`${CLI_API_URL}/v1/sites/${options.domain}/purge`, 'POST', {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Arxignis CLI {{version}}',
      }, JSON.stringify({ type: 'all' }));
      return response.body;
    })
  )
)

const getLoginToken = async () => {
  const kv = await Deno.openKv(`${kvPath}/cache.db`);
  const token = await kv.get(['token']);
  if (!token) {
    console.error('No token found');
    Deno.exit(1);
  }
  return token.value;
}

await new Command()
  .name('Arxignis CLI')
  .version('{{version}}')
  .description('CLI tool for managing Arxignis sites')
  .action(() => {
    console.log('Use --help to see available commands');
    Deno.exit(1);
  })
  .command('init')
  .description('Initialize the CLI')
  .action(async () => {
    const result = await prompt([{
      name: "hasToken",
      message: "Do you have a login token?",
      type: Confirm,
      after: async ({ hasToken }, next) => {
        if (!hasToken) {
          const url = CLI_SIGNUP_URL;
          console.log('Opening registration page...');
          const p = new Deno.Command('open', { args: [url] });
          await p.output();
          Deno.exit(0);
        }
        await next();
      }
    }, {
      name: "token",
      message: "Enter your token",
      type: Secret,
      minLength: 44,
      maxLength: 44,
      after: async ({ token }, next) => {
        const login = await loginTest(token as string);
        if (!login) {
          console.error('Login failed');
          Deno.exit(1);
        }
        await Deno.mkdir(kvPath, { recursive: true });
        const kv = await Deno.openKv(`${kvPath}/cache.db`);
        kv.set(['token'], token);
        console.info('Login successful');
        await next();
      }
    }, {
      name: "domainName",
      message: "Enter your domain name",
      type: Input,
      validate: (value) => {
        if (!value) return "Domain name is required";
        const validation = validateDomain(value);
        if (validation !== true) return validation;
        return true;
      }
    }, {
      name: "target",
      message: "Enter your target domain name or IP address",
      type: Input,
      validate: (value) => {
        if (!value) return "Target is required";
        const urlValidation = validateUrl(value);
        if (urlValidation !== true) return urlValidation;
        return true;
      }
    }]);

    try {
      await Deno.mkdir(`configs`, { recursive: true });
    } catch (error) {
      if (error instanceof Deno.errors.AlreadyExists) {
        console.info('Configs directory already exists');
      } else {
        console.error('Error creating configs directory:', error);
        Deno.exit(1);
      }
    }
    const configPath = `configs/${result.domainName as string}.yaml`;
    try {
      await Deno.stat(configPath);
      const overwrite = await prompt([{
        name: "confirm",
        message: `Config file for ${result.domainName} already exists. Overwrite?`,
        type: Confirm,
      }]);
      if (!overwrite.confirm) {
        console.info('Operation cancelled');
        Deno.exit(0);
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }

    try {
      await Deno.writeTextFile(configPath, generateConfig(result.target as string));
      console.info(`ax site create -d ${result.domainName}`);
      console.info(`ax site settings -d ${result.domainName} -c ${configPath}`);
    } catch (error) {
      console.error('Error writing config file:', error);
      Deno.exit(1);
    }
  })
  .command('register')
  .description('Register a new account')
  .action(async () => {
    const url = CLI_SIGNUP_URL;
    console.log('Opening registration page...');
    const p = new Deno.Command('open', { args: [url] });
    await p.output();
  })
  .command('login')
  .action(async () => {
    const token = await Secret.prompt({
      message: 'Enter your token',
      label: 'Token',
      hidden: true,
      minLength: 44,
      maxLength: 44,
    });
    const login = await loginTest(token);
    if (!login) {
      console.error('Login failed');
      Deno.exit(1);
    }
    await Deno.mkdir(kvPath, { recursive: true });
    const kv = await Deno.openKv(`${kvPath}/cache.db`);
    kv.set(['token'], token);
    console.info('Login successful');
  })
  .command('site', siteCommand)
  .description('Manage sites')
  .command('settings')
  .description('Manage site settings')
  .option('-d, --domain <domain:string>', 'Domain name', { required: true })
  .option('-c, --config <path:string>', 'Config file path', { required: true })
  .action(async (options: { domain: string, config: string }) => {
    try {
      const config = await Deno.readTextFile(options.config);
      const parsedConfig = parse(config);
      const validation = validateDomain(options.domain);
      if (validation !== true) {
        console.error(validation);
        Deno.exit(1);
      }
      const token = await getLoginToken();
      const response = await httpRequest(
        `${CLI_API_URL}/v1/site/settings/${options.domain}`,
        'POST',
        {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Arxignis CLI {{version}}',
        },
        JSON.stringify(parsedConfig)
      );
      console.log(await response.json());
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.error(`Config file not found: ${options.config}`);
      } else if (error instanceof Deno.errors.NotADirectory) {
        console.error(`Invalid config path: ${options.config}`);
      } else {
        console.error('Error reading config file:', error);
      }
      Deno.exit(1);
    }
  })
  .command('purge', purgeCommand)
  .description('Purge cache')
  .parse(Deno.args);
