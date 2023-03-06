import fetch from 'node-fetch';
import https from 'node:https';
import { analyzePropertiesAndLabels, toLabelsBody } from "./label.mjs"

const METHOD_TYPES = {
  GET: { Accept: 'application/json', },
  POST: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  DELETE: {},
}

export class LabelOperator {
  constructor(options) {
    this.options = options

    this.baseUrl = `https://${options.domain}.atlassian.net`
    this.Authorization = `Basic ${Buffer.from(`${options.forgeEmail}:${options.forgeApiToken}`).toString('base64')}`
    this.agent = new https.Agent({ keepAlive: true })
  }

  run() {
    this.updateLabelsForPage(this.options.pageId)
  }

  updateLabelsForPage(pageId) {
    this.fetchPageContent(pageId)
      .then(response => response.json())
      .then(responseJson => {
        console.info(`Title: ${responseJson.title}`)
        return analyzePropertiesAndLabels(responseJson)
      })
      .then(labels => Promise.all([this.addLabels(pageId, labels.labelsToAdd), this.removeLabels(pageId, labels.labelsToRemove)]))
      .catch(err => console.error(`ERROR: ${err}`))
  }

  handleAllPages() {

  }

  async requestConfluence(method, path, expectedCode, body = {}) {
    const url = this.baseUrl + path
    console.debug(`${method} ${url}`)
    const requestOpts = {
      method,
      headers: {
        Authorization: this.Authorization,
        ...METHOD_TYPES[method],
      },
      agent: this.agent,
      ...body,
    }
    return fetch(url, requestOpts)
      .then(async response => {
        if (response.status !== expectedCode) {
          throw makeHTTPError(method, url, response)
        }
        return response
      })
  }

  fetchPageContent(pageId) {
    const path = `/wiki/rest/api/content/${pageId}?expand=metadata.labels,body.storage`
    return this.requestConfluence("GET", path, 200)
  }

  addLabels(pageId, labelsToAdd) {
    console.info("labelsToAdd:", JSON.stringify(labelsToAdd))
    if (labelsToAdd.length === 0) { return }
    const bodyData = toLabelsBody(labelsToAdd)
    const path = `/wiki/rest/api/content/${pageId}/label`
    return this.requestConfluence("POST", path, 204, { body: JSON.stringify(bodyData) })
  }

  removeLabels(pageId, labelsToRemove) {
    console.info("labelsToRemove:", JSON.stringify(labelsToRemove))
    return Promise.all(labelsToRemove.map(label => {
      const path = `/wiki/rest/api/content/${pageId}/label/${label}`
      return this.requestConfluence("DELETE", path, 204)
    }))
  }
}

async function makeHTTPError(method, url, response) {
  const err = `ERROR: ${method} ${url}
  ${response.status} ${response.statusText}
  ${await response.text()}`
  return Error(err)
}

export async function labelcli(options) {
  if (options.all) {
    return handleAllTSDs(options)
  }
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
  const requestOpts = {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${options.forgeEmail}:${options.forgeApiToken}`).toString('base64')}`,
      'Accept': 'application/json'
    }
  }
  console.debug(requestOpts)
  const response = await fetch(url, requestOpts);
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

async function handleAllTSDs(options) {
  const cql = 'space=AT and type=page and (label="se-opportunity" or label="se-tsd")'
  let url = encodeURI(`https://${options.domain}.atlassian.net/wiki/rest/api/content/search?cql=${cql}&limit=50`)
  do {
    const responseJson = await cqlSearch(options, url)
    responseJson.results.forEach(page => console.info(`${page.id}: ${page.title}`))
    console.info(`start: ${responseJson.start}, limit: ${responseJson.limit}, size: ${responseJson.size}`)
    if (responseJson._links.next) {
      url = responseJson._links.base + responseJson._links.next
    } else {
      url = undefined
    }
  } while (url)
}

async function cqlSearch(options, url) {
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