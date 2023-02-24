import slugify from 'slugify';

const TSD_LABEL_PREFIX = "tsd-"
const TSD_PROPERTY_KEYS = ["Solution Type", "Industry", "Horizontal", "Cloud Platform", "Status"]

export function tsdPropertiesToLabels(html) {
  var result = [];
  const macroRegex = /<ac:structured-macro ac:name="details"[^>]*>(.*?)<\/ac:structured-macro>/gis
  const trRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const thRegex = /<th[^>]*>(.*?)<\/th>/i;
  const tdRegex = /<td[^>]*>(.*?)<\/td>/i;

  const macros = html.match(macroRegex)
  for (const macro of macros) {
    const rows = macro.match(trRegex)
    for (const row of rows) {
      var key, value;
      var match = thRegex.exec(row)
      if (match) {
        key = match[0].replace(/(<([^>]+)>)/gi, "").trim()
        if (key.length === 0) { continue }
        if (!TSD_PROPERTY_KEYS.includes(key)) { continue }
      } else { continue }
      var match = tdRegex.exec(row)
      if (match) { value = match[0].replace(/(<([^>]+)>)/gi, "").trim() } else { continue }
      result.push(TSD_LABEL_PREFIX + slugify(key, { lower: true, strict: true }) + "-" + slugify(value, { lower: true, strict: true }))
    }
  }

  return result
}