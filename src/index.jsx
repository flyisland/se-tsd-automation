import api, { route } from "@forge/api";

export async function run(event, context) {
  if (!event) {
    console.log("Invalid event");
  } else {
    const contentType=event["content"]["type"]
    if (contentType!=="page"){
      console.log(`Invalid content type '${contentType}'`, JSON.stringify(event, null, 2));
    }else{
      const contentId=event["content"]["id"]
      await checkPageProperties(contentId)
      await checkPageLabels(contentId)
    }
  }
}

async function checkPageProperties(pageId){
  const propUrl = route`/wiki/api/v2/pages/${pageId}/properties` 
  console.log(propUrl)
  const response = await api.asApp().requestConfluence(propUrl, {
    headers: {
      'Accept': 'application/json'
    }
  });  
  console.log(`Response: ${response.status} ${response.statusText}`);
  console.log(await response.json());
}

async function checkPageLabels(pageId){
  const labelsUrl = route`/wiki/api/v2/pages/${pageId}/labels` 
  console.log(labelsUrl)
  const response = await api.asApp().requestConfluence(labelsUrl, {
    headers: {
      'Accept': 'application/json'
    }
  });  
  console.log(`Response: ${response.status} ${response.statusText}`);
  console.log(await response.json());
}