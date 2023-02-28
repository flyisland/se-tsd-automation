import fetch from 'node-fetch';
import { analyzePropertiesAndLabels } from "./label.mjs"

export async function labelcli(options) {
  const responseJson = await fetchPageContent(options)
  if (!responseJson) {
    return
  }
  console.info(`"${responseJson.title}"`)
  const { labelsToRemove, labelsToAdd } = await analyzePropertiesAndLabels(responseJson)
  console.info("labelsToRemove:", labelsToRemove)
  console.info("labelsToAdd:", labelsToAdd)
}

async function fetchPageContent(options) {
  const url = `https://${options.domain}.atlassian.net/wiki/rest/api/content/${options.pageId}?expand=metadata.labels,body.storage`
  console.debug(`Fetching page "${url}"`)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${options.forgeEmail}:${options.forgeApiToken}`).toString('base64')}`,
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
