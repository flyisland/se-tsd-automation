import slugify from 'slugify';

const TSD_LABEL_PREFIX = "tsd-"
const TSD_PROPERTY_KEYS = ["Solution Type", "Industry", "Horizontal", "Cloud Platform", "Status"]
const TSD_KEY_PREFIXS = TSD_PROPERTY_KEYS.map(key => TSD_LABEL_PREFIX + slugify(key, { lower: true, strict: true }))

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

export async function analyzePropertiesAndLabels(responseJson) {
  // extract existed labels
  const labels = responseJson["metadata"]["labels"]["results"].map(item => item["label"])
  if (!labels.includes('se-tsd') && !labels.includes('se-opportunity')) {
    console.error("This is not a valid TSD page!")
    return
  }
  const existedTSDLables = labels.filter(label => TSD_KEY_PREFIXS.some(prefix => label.startsWith(prefix)))

  // extract properties
  const xhtml = responseJson["body"]["storage"]["value"]
  const targetLabels = tsdPropertiesToLabels(xhtml)

  const labelsToRemove = existedTSDLables.filter(label => !targetLabels.includes(label))
  const labelsToAdd = targetLabels.filter(label => !existedTSDLables.includes(label))

  return { labelsToRemove, labelsToAdd }
}

export function toLabelsBody(labels) {
  const out = []
  labels.forEach(name => out.push({ prefix: "global", name }));
  return out
}