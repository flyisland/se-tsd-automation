import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import fs from 'fs'

function getFirstElementByTagNames(node, tags) {
  var firstElement = node
  for (const tag of tags) {
    firstElement = node.getElementsByTagName(tag).item(0)
  }
  return firstElement
}

fs.readFile('byd.txt', 'utf8', (err, data) => {
  if (err) {
    console.error(err);
  } else {
    const doc = new DOMParser().parseFromString("<div>" + data + "</div>", 'text/xhtml')
    const tbody = getFirstElementByTagNames(doc, ["ac:structured-macro", "ac:rich-text-body", "table", "tbody"])

    const trDoc = new DOMParser().parseFromString(`<tr><th><p><strong>OpportunityID</strong></p></th><td><p>0010z00001YlCFEAA3</p></td></tr>`, "text/xhtml")
    tbody.appendChild(trDoc.documentElement)

    console.info(new XMLSerializer().serializeToString(doc))
  }
});