import { Command, Option } from "commander";
import { CliOperator } from "./updatecli.mjs"

const program = new Command();

program
  .name("autotsd")
  .description("CLI to perform automation on TSD pages")
  .version("0.0.1");

program.command("label")
  .description("Sync labels on a page to its TSD properties")
  .addOption(new Option("-u, --forge-email <forgeEmail>", "the email address associated with your Atlassian account").env("FORGE_EMAIL"))
  .addOption(new Option("-k, --forge-api-token <forgeApiToken>", "your Atlassian API token").env("FORGE_API_TOKEN"))
  .option("-d, --domain <domain>", "Confluence domain name, for example, your-domain.atlassian.net", "sol-jira")
  .option("-s, --space <space>", "The sapce you want to work on", "AT")
  .option("-p, --page-id <pageId>", "Page Id")
  .addOption(new Option("--all", "Perform the automation on all pages").conflicts("pageId"))
  .action((options) => {
    if (!options.pageId && !options.all) {
      console.error("Either --page-id or --all must be specified")
      return
    }

    const cliOperator = new CliOperator(options)
    cliOperator.run()
  });

program.parse();