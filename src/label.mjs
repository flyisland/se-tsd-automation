import slugify from 'slugify';

const TSD_LABEL_PREFIX = "tsd-"
const TSD_PROPERTY_KEYS = ["Solution Type", "Industry", "Horizontal", "Cloud Platform", "Status"]
const TSD_KEY_PREFIXS = TSD_PROPERTY_KEYS.map(key => TSD_LABEL_PREFIX + slugify(key, { lower: true, strict: true }))

export const METHOD_TYPES = {
  GET: { Accept: 'application/json', },
  POST: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  DELETE: {},
}

export class LabelOperator {
  constructor(options) {
    this.init(options)
  }

  init(options) {
    console.debug(`WARN: init() is called with ${options}`)
  }

  run() {
    try {
      if (this.options.pageId) {
        this.updateLabelsForPage(this.options.pageId)
      } else if (this.options.all) {
        this.updateLabelsForAllPages()
      }
    } catch (error) {
      console.error(error)
    }
  }

  updateLabelsForAllPages() {
    const cql = 'space=AT and type=page and label=test and (label="se-opportunity" or label="se-tsd")'
    let path = encodeURI(`/rest/api/content/search?cql=${cql}&limit=50`)
    this.fetchAllPages(path)
      .then(results => Promise.all(results.map(page => this.updateLabelsForPage(page.id))))
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

  async updateLabelsForPage(pageId) {
    const page = await this.fetchPageContent(pageId);
    const pageJson = await page.json();
    const labelsResp = await this.fetchLabels(pageId)
    const labelsJson = await labelsResp.json()
    console.info(`Title: ${pageJson.title}`);
    if (!labelsJson.results.some(l => (l.name === 'se-tsd' || l.name === 'se-opportunity'))) {
      console.error("This is not a valid TSD page!")
      return
    }
    const labels = analyzePropertiesAndLabels(pageJson, labelsJson);
    return await Promise.all([this.addLabels(pageId, labels.labelsToAdd), this.removeLabels(pageId, labels.labelsToRemove)]);
  }

  async requestConfluence(method, path, expectedCode, body = {}) {
    console.warn(`WARN: requestConfluence("${method}", "${path}", ${expectedCode}, ${body}) was called`)
  }

  fetchPageContent(pageId) {
    const path = `/api/v2/pages/${pageId}?body-format=storage`
    return this.requestConfluence("GET", path, 200)
  }

  fetchLabels(pageId) {
    const path = `/api/v2/pages/${pageId}/labels`
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

function tsdPropertiesToLabels(xhtml) {
  var result = [];
  const macroRegex = /<ac:structured-macro ac:name="details"[^>]*>(.*?)<\/ac:structured-macro>/gis
  const trRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const thRegex = /<th[^>]*>(.*?)<\/th>/i;
  const tdRegex = /<td[^>]*>(.*?)<\/td>/i;
  const allTagsRegex = /(<([^>]+)>)/gi

  for (const macro of xhtml.match(macroRegex)) {
    for (const row of macro.match(trRegex)) {
      var key, value;
      var match = thRegex.exec(row)
      if (match) {
        key = match[0].replace(allTagsRegex, "").trim()
        if (key.length === 0) { continue }
        if (!TSD_PROPERTY_KEYS.includes(key)) { continue }
      } else { continue }
      var match = tdRegex.exec(row)
      if (match) { value = match[0].replace(allTagsRegex, "").trim() } else { continue }
      result.push(TSD_LABEL_PREFIX + slugify(key, { lower: true, strict: true }) + "-" + slugify(value, { lower: true, strict: true }))
    }
  }

  return result
}

function analyzePropertiesAndLabels(pageJson, labelsJson) {
  const existedTSDLables = labelsJson.results
    .map(l => l.name)
    .filter(label => TSD_KEY_PREFIXS.some(prefix => label.startsWith(prefix)))

  // extract properties
  const xhtml = pageJson.body.storage.value
  const targetLabels = tsdPropertiesToLabels(xhtml)

  const labelsToRemove = existedTSDLables.filter(label => !targetLabels.includes(label))
  const labelsToAdd = targetLabels.filter(label => !existedTSDLables.includes(label))

  return { labelsToRemove, labelsToAdd }
}

function toLabelsBody(labels) {
  const out = []
  labels.forEach(name => out.push({ prefix: "global", name }));
  return out
}