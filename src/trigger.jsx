import api, { route } from "@forge/api";
import { UpdateOperator, METHOD_TYPES } from "./label.mjs"

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
      const triggerOperator = new TriggerOperator()
      try {
        await triggerOperator.updateIDAndLabelForPage(pageId)
      } catch (error) {
        console.error(error)
      }
    }
  }
}

class TriggerOperator extends UpdateOperator {
  init(options) {
    this.baseUrl = ""
  }

  async requestConfluence(method, path, expectedCode, body = {}) {
    const routeUrl = route(`${this.baseUrl}${path}`)
    console.debug(`${method}: ${routeUrl.value}`)
    const response = await api.asApp().requestConfluence(routeUrl, {
      method,
      headers: {
        ...METHOD_TYPES[method],
      },
      ...body,
    });
    if (response.status !== expectedCode) {
      return response.text()
        .then(errorMsg => {
          throw new Error(`${method} ${routeUrl.value}
->${response.status} ${response.statusText}
->${errorMsg}`);
        });
    }
    return response;
  }
}
