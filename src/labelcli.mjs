import fetch from 'node-fetch';
import https from 'node:https';
import { UpdateOperator, METHOD_TYPES } from "./label.mjs"

export class CliOperator extends UpdateOperator {
  init(options) {
    this.options = options

    this.baseUrl = `https://${options.domain}.atlassian.net/`
    this.space = options.space
    this.Authorization = `Basic ${Buffer.from(`${options.forgeEmail}:${options.forgeApiToken}`).toString('base64')}`
    this.agent = new https.Agent({ keepAlive: true })
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
    const response = await fetch(url, requestOpts);
    if (response.status !== expectedCode) {
      return response.text()
        .then(errorMsg => {
          throw new Error(`${method} ${url}
->${response.status} ${response.statusText}
->${errorMsg}`);
        });
    }
    return response;
  }

  run() {
    try {
      if (this.options.pageId) {
        this.updateIDAndLabelForPage(this.options.pageId)
      } else if (this.options.all) {
        this.updateLabelsForAllPages()
      }
    } catch (error) {
      console.error(error)
    }
  }

  updateLabelsForAllPages() {
    const cql = `space=${this.space} and type=page and (label="se-opportunity" or label="se-tsd")`
    let path = encodeURI(`/wiki/rest/api/content/search?cql=${cql}&limit=50`)
    this.fetchAllPages(path)
      .then(results => results.map(
        result => {
          return {
            id: result.id,
            title: result.title,
            webui: this.baseUrl + "wiki" + result._links.webui,
          }
        }
      )) // todo, call updateIDAndLabelForPage() for each page
      .then(pages => pages.forEach(page => {
        this.printProperties(page)
      }))
  }

  async printProperties(page) {
    const pageResp = await this.fetchPageContent(page.id);
    const pageJson = await pageResp.json();
    let bodyXhtml = pageJson.body.storage.value
    if (!bodyXhtml.startsWith("<div")) {
      // make sure the body is a valid xhtml string
      bodyXhtml = "<div>" + bodyXhtml + "</div>"
    }
    const { pageProperties, newProperties, updatedBodyXhtml } = this.updatePageProperties(bodyXhtml)
    if (newProperties && Object.keys(newProperties).length === 2) return
    const all = { ...pageProperties, ...newProperties }
    if (all["AccountID"] && all["OpportunityID"]) return
    console.info("-".repeat(20))
    console.info(page)
    console.info("pageProperties:")
    console.info(pageProperties)
    console.info("newProperties:")
    console.info(newProperties)
  }


  fetchAllPages(path, results = []) {
    return this.requestConfluence("GET", path, 200)
      .then(response => response.json())
      .then(responseJson => {
        const newResults = results.concat(responseJson.results)
        if (responseJson._links.next) {
          return this.fetchAllPages(responseJson._links.context + responseJson._links.next, newResults)
        } else {
          return newResults
        }
      })
  }
}