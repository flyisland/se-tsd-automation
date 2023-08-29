import fetch from 'node-fetch';
import api, { route } from "@forge/api";
import { UpdateOperator, METHOD_TYPES } from "./update.mjs"

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
        const isValidTSDPage = await triggerOperator.updateIDAndLabelForPage(pageId)
        if (isValidTSDPage) {
          await callLambda(pageId)
        }
      } catch (error) {
        console.error(error)
      }
    }
  }
}

class TriggerOperator extends UpdateOperator {
  init(options) {
    this.baseUrl = ""
    this.executeMode = true // trgger will always run in execute mode
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

async function callLambda(pageId) {
  const jsonData = JSON.stringify({ pageId });
  const requestOpts = {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(jsonData),
    },
    body: jsonData,
  }
  const lambdaUrl = "https://xi4j4j1413.execute-api.us-east-1.amazonaws.com/produce"
  const response = await fetch(lambdaUrl, requestOpts);
  const result = await response.text()
  console.info(`Call Lambda: status=${response.status}, result=${result}`)
}