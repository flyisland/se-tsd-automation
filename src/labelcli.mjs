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
      .catch(err => console.error(err))
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
          return response.text()
            .then(errorMsg => {
              throw new Error(`${method} ${url}
->${response.status} ${response.statusText}
->${errorMsg}`)
            })
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
    return this.requestConfluence("POST", path, 200, { body: JSON.stringify(bodyData) })
  }

  removeLabels(pageId, labelsToRemove) {
    console.info("labelsToRemove:", JSON.stringify(labelsToRemove))
    return Promise.all(labelsToRemove.map(label => {
      const path = `/wiki/rest/api/content/${pageId}/label/${label}`
      return this.requestConfluence("DELETE", path, 204)
    }))
  }
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