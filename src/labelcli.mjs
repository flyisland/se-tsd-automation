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

    this.baseUrl = `https://${options.domain}.atlassian.net/wiki`
    this.Authorization = `Basic ${Buffer.from(`${options.forgeEmail}:${options.forgeApiToken}`).toString('base64')}`
    this.agent = new https.Agent({ keepAlive: true })
  }

  run() {
    if (this.options.pageId) {
      this.updateLabelsForPage(this.options.pageId)
        .catch(err => console.error(err))

    } else if (this.options.all) {
      this.updateLabelsForAllPages()
    }
  }

  updateLabelsForAllPages() {
    const cql = 'space=AT and type=page and (label="se-opportunity" or label="se-tsd")'
    let path = encodeURI(`/rest/api/content/search?cql=${cql}&limit=50`)
    this.fetchAllPages(path)
      .then(results => results.forEach(page => console.info(`${page.id}: ${page.title}`)))
  }

  fetchAllPages(path, results = []) {
    return this.requestConfluence("GET", path, 200)
      .then(response => response.json())
      .then(responseJson => {
        const newResults = results.concat(responseJson.results)
        if (responseJson._links.next) {
          return this.fetchAllPages(responseJson._links.next, newResults)
        } else {
          return newResults
        }
      })
  }

  updateLabelsForPage(pageId) {
    return this.fetchPageContent(pageId)
      .then(response => response.json())
      .then(responseJson => {
        console.info(`Title: ${responseJson.title}`)
        return analyzePropertiesAndLabels(responseJson)
      })
      .then(labels => Promise.all([this.addLabels(pageId, labels.labelsToAdd), this.removeLabels(pageId, labels.labelsToRemove)]))
  }

  requestConfluence(method, path, expectedCode, body = {}) {
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
      .then(response => {
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
    const path = `/rest/api/content/${pageId}?expand=metadata.labels,body.storage`
    return this.requestConfluence("GET", path, 200)
  }

  addLabels(pageId, labelsToAdd) {
    console.info("labelsToAdd:", JSON.stringify(labelsToAdd))
    if (labelsToAdd.length === 0) { return }
    const bodyData = toLabelsBody(labelsToAdd)
    const path = `/rest/api/content/${pageId}/label`
    return this.requestConfluence("POST", path, 200, { body: JSON.stringify(bodyData) })
  }

  removeLabels(pageId, labelsToRemove) {
    console.info("labelsToRemove:", JSON.stringify(labelsToRemove))
    return Promise.all(labelsToRemove.map(label => {
      const path = `/rest/api/content/${pageId}/label/${label}`
      return this.requestConfluence("DELETE", path, 204)
    }))
  }
}
