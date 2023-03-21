import slugify from 'slugify';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

export const METHOD_TYPES = {
  GET: { Accept: 'application/json', },
  POST: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  PUT: {
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

  // 1. extract page properties from the body in xhtml
  // 2. extract IDs from Account and Opportunity urls
  // 3. update the page properties <table> for new ID
  updatePageProperties(bodyXhtml) {
    const doc = new DOMParser().parseFromString(bodyXhtml, 'text/xhtml')
    // find the "details" macro
    const macros = doc.getElementsByTagName("ac:structured-macro")
    let detailsMacro;
    for (let i = 0; i < macros.length; i++) {
      if (macros.item(i).getAttribute("ac:name") === "details") {
        detailsMacro = macros.item(i)
        break
      }
    }
    const pageProperties = {}
    if (!detailsMacro) {
      // There is NO macro "details" in this page!
      return { pageProperties }
    }

    const idDefs = [{
      keyStartsWith: "SalesForce Account", descKey: "AccountID", regex: /\/([^\/]+)\/view/,
    }, {
      keyStartsWith: "SalesForce Opportunity", descKey: "OpportunityID", regex: /\/([^\/]+)\/view/,
    }]

    // convert the <table> into properties
    const tbody = getFirstElementByTagNames(detailsMacro, ["ac:rich-text-body", "table", "tbody"])
    const trs = tbody.getElementsByTagName("tr")
    for (let i = 0; i < trs.length; i++) {
      const th = getFirstElementByTagNames(trs.item(i), "th")
      const key = th.textContent
      const td = getFirstElementByTagNames(trs.item(i), "td")
      const a = getFirstElementByTagNames(td, "a")
      if (a) {
        pageProperties[key] = a.getAttribute("href")
      } else {
        pageProperties[key] = td.textContent.trim()
      }
      for (const idDef of idDefs) {
        if (key.startsWith(idDef.keyStartsWith)) {
          idDef.srcKey = key
        }
        if (idDef.descKey === key) {
          idDef.td = td
        }
      }
    }

    // extract id from url
    const newProperties = {}
    for (const idDef of idDefs) {
      if (!idDef.srcKey) continue
      if (!pageProperties[idDef.srcKey]) continue
      const id = getIdFromUrl(pageProperties[idDef.srcKey], idDef.regex)
      if (!id) continue
      if (pageProperties[idDef.descKey]) {
        if (pageProperties[idDef.descKey] === id) continue
        // remvoe existing value
        removeAllChildElements(idDef.td)
        const idDoc = new DOMParser().parseFromString(`<p>${id}</p>`, "text/xhtml")
        idDef.td.appendChild(idDoc)
      } else {
        // insert
        const trDoc = new DOMParser().parseFromString(`<tr><th><p><strong>${idDef.descKey}</strong></p></th><td><p>${id}</p></td></tr>`, "text/xhtml")
        tbody.appendChild(trDoc.documentElement)
      }
      newProperties[idDef.descKey] = id
    }

    return {
      pageProperties, newProperties,
      updatedBodyXhtml: Object.keys(newProperties).length > 0 ? new XMLSerializer().serializeToString(doc) : undefined
    }
  }

  async updateIDAndLabelForPage(pageId) {
    const labelsResp = await this.fetchLabels(pageId)
    const labelsJson = await labelsResp.json()
    if (!labelsJson.results.some(l => (l.name === 'se-tsd' || l.name === 'se-opportunity'))) {
      console.error("This is not a valid TSD page!")
      return
    }

    const pageResp = await this.fetchPageContent(pageId);
    const pageJson = await pageResp.json();
    let bodyXhtml = pageJson.body.storage.value
    if (!bodyXhtml.startsWith("<div")) {
      // make sure the body is a valid xhtml string
      bodyXhtml = "<div>" + bodyXhtml + "</div>"
    }
    const { pageProperties, newProperties, updatedBodyXhtml } = this.updatePageProperties(bodyXhtml)
    if (updatedBodyXhtml) {
      const bodyData = {
        id: pageId,
        status: "current",
        title: pageJson.title,
        spaceId: pageJson.spaceId,
        body: {
          representation: "storage",
          value: updatedBodyXhtml,
        },
        version: {
          number: pageJson.version.number + 1,
          message: "Updated by SE Automation",
        }
      };
      await this.updatePage(pageId, bodyData)
    }
    console.info("pageProperties:")
    console.info(pageProperties)
    console.info("newProperties:")
    console.info(newProperties)

    if (Object.keys(pageProperties).length > 0) {
      // found valid macro "details" in this page
      const { labelsToRemove, labelsToAdd } = analyzePropertiesAndLabels(pageProperties, labelsJson);
      await Promise.all([this.addLabels(pageId, labelsToAdd), this.removeLabels(pageId, labelsToRemove)])
    }
  }

  async updatePage(pageId, bodyData) {
    const path = `/wiki/api/v2/pages/${pageId}`
    const response = await this.requestConfluence("PUT", path, 200, { body: JSON.stringify(bodyData) })
    return await response.json()
  }

  async requestConfluence(method, path, expectedCode, body = {}) {
    console.warn(`WARN: requestConfluence("${method}", "${path}", ${expectedCode}, ${body}) was called`)
  }

  fetchPageContent(pageId) {
    const path = `/wiki/api/v2/pages/${pageId}?body-format=storage`
    return this.requestConfluence("GET", path, 200)
  }

  fetchLabels(pageId) {
    const path = `/wiki/api/v2/pages/${pageId}/labels`
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

const TSD_PROPERTY_KEYS = ["Solution Type", "Industry", "Horizontal", "Cloud Platform"]
const TSD_PROPERTY_VALUES = [
  "Event Driven Integration",
  "High Performance",
  "IOT/IIOT",
  "Kafka/Competition",
  "App Modernisation",
  "SAP",
  "Boomi",
  "Analytics/Steaming",
  "Capital Markets",
  "Retail Banking",
  "Telco",
  "Manufacturing CPG / Pharma",
  "Manufacturing Hi Tech",
  "Retail",
  "Transportation",
  "Aviation",
  "Resource",
  "Energy",
  "Education",
  "Insurance / Superannuation / Pension",
  "Government",
  "AWS",
  "GCP",
  "Azure",
  "TenCent",
  "Hybrid",
  "On Prem",
  "Other",
  "Software",
  "Cloud Service",
  "Cloud Platform",
  "Event Portal",
  "Appliance",
  "Hybrid",
].map(v => slugify(v, { lower: true, strict: true }))
const STATUS_PREFIX = "status-"
function analyzePropertiesAndLabels(pageProperties, labelsJson) {
  const targetLabels = TSD_PROPERTY_KEYS
    .map(k => pageProperties[k])
    .filter(v => v) // filter out empty properties
    .map(v => slugify(v, { lower: true, strict: true }))
  if (pageProperties["Status"]) {
    targetLabels.push(STATUS_PREFIX + slugify(pageProperties["Status"], { lower: true, strict: true }))
  }

  const existedTSDLables = labelsJson.results
    .map(l => l.name)
    .filter(label => label.startsWith(STATUS_PREFIX)
      || TSD_PROPERTY_VALUES.includes(label)
      || targetLabels.includes(label))

  const labelsToRemove = existedTSDLables.filter(label => !targetLabels.includes(label))
  const labelsToAdd = targetLabels.filter(label => !existedTSDLables.includes(label))

  return { labelsToRemove, labelsToAdd }
}

function toLabelsBody(labels) {
  const out = []
  labels.forEach(name => out.push({ prefix: "global", name }));
  return out
}

function getFirstElementByTagNames(node, tags) {
  var firstElement = node
  if (typeof tags === "string") {
    tags = [tags]
  }
  for (const tag of tags) {
    const elements = node.getElementsByTagName(tag)
    if (elements.length === 0) return undefined
    firstElement = elements.item(0)
  }
  return firstElement
}

function getIdFromUrl(url, regex) {
  const out = regex.exec(url)
  if (out) {
    return out[1]
  } else {
    return undefined
  }
}

function removeAllChildElements(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}