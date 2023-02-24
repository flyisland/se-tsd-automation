import fetch from 'node-fetch';
import { analyzePropertiesAndLabels } from "./label.mjs"

async function main() {
  const args = process.argv;
  if (args.length !== 4) {
    console.error("Usage: node labelcli.mjs {domain-prefix} {page-id}");
    return
  }
  if (!process.env.FORGE_EMAIL) {
    console.error("System environment variable 'FORGE_EMAIL' is NOT found")
    return
  }
  if (!process.env.FORGE_API_TOKEN) {
    console.error("System environment variable 'FORGE_API_TOKEN' is NOT found")
    return
  }
  const responseJson = await fetchPageContent(args[2], args[3])
  if (!responseJson) {
    return
  }
  const { labelsToRemove, labelsToAdd } = await analyzePropertiesAndLabels(responseJson)
  console.log("labelsToRemove:", labelsToRemove)
  console.log("labelsToAdd:", labelsToAdd)
}

async function fetchPageContent(domainPrefix, pageId) {
  const url = `https://${domainPrefix}.atlassian.net/wiki/rest/api/content/${pageId}?expand=metadata.labels,body.storage`
  console.error(`Fetching page "${url}"`)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${process.env.FORGE_EMAIL}:${process.env.FORGE_API_TOKEN}`).toString('base64')}`,
      'Accept': 'application/json'
    }
  });
  if (response.status !== 200) {
    console.error(`Response: ${response.status} ${response.statusText}`);
    console.error(await response.text());
    return null;
  }
  return await response.json()
}

main();