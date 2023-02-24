import fetch from 'node-fetch';
import { setTSDLabels } from "./label.mjs"

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
  const url = `https://${args[2]}.atlassian.net/wiki/rest/api/content/${args[3]}?expand=metadata.labels,body.storage`
  const responseJson = await fetchPageContent(url)
  if (!responseJson) {
    return
  }
  await setTSDLabels(responseJson)
}

async function fetchPageContent(url) {
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