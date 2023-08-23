# Confluence Trigger to do automation task on TSD pages

This is a confluence trigger to do automation task on TSD pages.

Tasks:

- [x] Extract the "AccountID" and "OpportunityID" from links and insert them back to the table
- [x] Update labels according to properties of "Solution Type", "Industry", Horizontal", "Cloud Platform" and "Status"
- [x] Export and upload the pdf file to TSDs folder

## Export and upload the pdf file to TSDs folder

Here are some of my finding:
1. Confluence Cloud does not offer an API for exporting PDFs.
1. Therefore, we need to simulate a multi-step browser behavior to export and download the PDF file.
1. Atlassian's serverless app development platform, Forge, currently only supports Node.js.
1. Forge's requestConfluence() method is based on "node-fetch," which does not support HTTP sessions.
1. I attempted to add HTTP session support to the requestConfluence() method for the PDF exporting process, but it did not work.
1. There is an open-source project called [atlassian-python-api](https://github.com/atlassian-api/atlassian-python-api) that offers PDF export features in Python.

Based on above finding, I chose to use an AWS Lambda application for handling the exporting and uploading, so this trigger just needs to send the pageId to the Lambda app.

Please check [se-oppts-automation-pdf](https://github.com/solacese/se-oppts-automation-pdf) for more detail about the AWS Lambda app.
