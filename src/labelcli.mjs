import fetch from 'node-fetch';
import { analyzePropertiesAndLabels, toLabelsBody } from "./label.mjs"

export async function labelcli(options) {
  const responseJson = await fetchPageContent(options)
  if (!responseJson) {
    return
  }
  console.info(`"${responseJson.title}"`)
  const { labelsToRemove, labelsToAdd } = await analyzePropertiesAndLabels(responseJson)
  console.info("labelsToRemove:", labelsToRemove)
  console.info("labelsToAdd:", labelsToAdd)
  if (labelsToAdd.length > 0) {
    const out = await addLabels(options, labelsToAdd)
  }
  if (labelsToRemove.length > 0) {
    await removeLabels(options, labelsToRemove)
  }
}

async function fetchPageContent(options) {
  const url = `https://${options.domain}.atlassian.net/wiki/rest/api/content/${options.pageId}?expand=metadata.labels,body.storage`
  console.debug(url)
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

async function addLabels(options, labelsToAdd) {
  const bodyData = toLabelsBody(labelsToAdd)
  const url = `https://${options.domain}.atlassian.net/wiki/rest/api/content/${options.pageId}/label`
  console.debug(url)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${options.forgeEmail}:${options.forgeApiToken}`).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyData)
  });
  if (response.status !== 200) {
    console.error(`Response: ${response.status} ${response.statusText}`);
    console.error(await response.text());
    return null;
  }
  return await response.json()
}

async function removeLabels(options, labelsToRemove) {
  labelsToRemove.forEach(async label => {
    const url = `https://${options.domain}.atlassian.net/wiki/rest/api/content/${options.pageId}/label/${label}`
    console.debug(url)
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${options.forgeEmail}:${options.forgeApiToken}`).toString('base64')}`,
      },
    });
    if (response.status !== 200) {
      console.error(`Response: ${response.status} ${response.statusText}`);
      console.error(await response.text());
      return null;
    }
  });
}