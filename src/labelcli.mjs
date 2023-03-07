import fetch from 'node-fetch';
import https from 'node:https';
import { LabelOperator, METHOD_TYPES } from "./label.mjs"

export class CliOperator extends LabelOperator {
  init(options) {
    this.options = options

    this.baseUrl = `https://${options.domain}.atlassian.net/wiki`
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
}