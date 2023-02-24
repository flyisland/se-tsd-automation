import api, { route } from "@forge/api";

export async function run(event, context) {
  if (!event) {
    console.log("Invalid event");
  } else {
    const contentType = event["content"]["type"]
    if (contentType !== "page") {
      console.log(`Invalid content type '${contentType}'`, JSON.stringify(event, null, 2));
    } else {
      const pageId = event["content"]["id"]
      console.log(`Page "${pageId}/${event["content"]["title"]}" is ${event["eventType"].split(":")[2]}`)
      await convertSummaryToLabels(pageId)
    }
  }
}

async function convertSummaryToLabels(pageId) {
  // 1. fetch labels and page body
  const propUrl = route`/wiki/rest/api/content/${pageId}?expand=metadata.labels,body.storage`
  const response = await api.asApp().requestConfluence(propUrl, {
    headers: { 'Accept': 'application/json' }
  });
  if (response.status !== 200) {
    console.error(`Response: ${response.status} ${response.statusText}`);
    console.error(await response.text());
    return;
  }

  // 2. extract labels
  const responseJson = await response.json()
  const labels = responseJson["metadata"]["labels"]["results"].map(item => item["label"])
  if (!labels.includes('se-tsd') && !labels.includes('se-opportunity')) {
    console.error("This is not a valid TSD page!")
    return
  }

  // 3. extract properties
  const xhtml = responseJson["body"]["storage"]["value"]
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xhtml, "text/xml");
  //  const { document } = (new JSDOM(xhtml)).window;
  // <ac:structured-macro ac:name="details" /> is the Page properties Macro
  const macros = xmlDoc.querySelectorAll('ac\\:structured-macro[ac\\:name="details"]');
  if (macros.length === 0) {
    console.error("There is no properties in this page!")
    return
  }
  for (const macro of macros) {
    const rows = macro.querySelectorAll("table tr")
    for (const tr of rows) {
      console.log(`${tr.querySelector("th").textContent}:  ${tr.querySelector("td").textContent}`)
    }
  }
}
