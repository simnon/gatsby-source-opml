const xmlParser = require("xml2json")
const fs = require("fs")
const path = require("path")
const uuid = require("uuid")
const fetch = require("node-fetch")
const stripTags = require("striptags")

exports.sourceNodes = async (
  { actions, createNodeId, createContentDigest },
  configOptions
) => {
  const { createNode } = actions

  delete configOptions.plugins

  const podcasts = await readPodcastsListFromFile(configOptions.file)

  for (const podcast of podcasts) {
    const nodeId = createNodeId(`opml-podcast-${uuid.v4()}`)
    const nodeContent = await processPodcastContent(podcast)
    const nodeData = Object.assign({}, nodeContent, {
      id: nodeId,
      parent: null,
      children: [],
      internal: {
        type: `OpmlPodcast`,
        content: JSON.stringify(nodeContent),
        contentDigest: createContentDigest(nodeContent),
      },
    })

    createNode(nodeData)
  }
}

const processPodcastContent = async podcast => {
  const response = await fetch(podcast.xmlUrl)
  const data = await response.text()
  const json = xmlParser.toJson(data, { object: true })

  console.log(`${podcast.text}: ${json.rss.channel.copyright}`)

  return {
    name: podcast.text,
    url: json.rss.channel.link,
    description: stripTags(json.rss.channel.description),
    docs: json.rss.channel.docs,
    language: json.rss.channel.language,
  }
}

const readPodcastsListFromFile = async filePath => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(__dirname, "../..", filePath), (error, data) => {
      if (error) {
        reject(error)

        return
      }

      const json = xmlParser.toJson(data, { object: true })

      resolve(json.opml.body.outline.outline)
    })
  })
}
