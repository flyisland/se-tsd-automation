import api, { route } from "@forge/api";
import { setTSDLabels } from "./label.mjs"

export async function run(event, context) {
  if (!event) {
    console.error("Invalid event");
  } else {
    const contentType = event["content"]["type"]
    if (contentType !== "page") {
      console.error(`Invalid content type '${contentType}'`, JSON.stringify(event, null, 2));
    } else {
      const pageId = event["content"]["id"]
      console.info(`Page "${pageId}/${event["content"]["title"]}" is ${event["eventType"].split(":")[2]}`)
      const responseJson = await fetchPageContent(pageId)
      if (!responseJson) {
        return
      }
      await setTSDLabels(responseJson)
    }
  }
}

async function fetchPageContent(pageId) {
  const propUrl = route`/wiki/rest/api/content/${pageId}?expand=metadata.labels,body.storage`
  const response = await api.asApp().requestConfluence(propUrl, {
    headers: { 'Accept': 'application/json' }
  });
  if (response.status !== 200) {
    console.error(`Response: ${response.status} ${response.statusText}`);
    console.error(await response.text());
    return;
  }
  const responseJson = await response.json()
  return responseJson
}