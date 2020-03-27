const xmlParser = require("xml2json")
const fs = require("fs")
const path = require("path")
const uuid = require("uuid")
const fetch = require("node-fetch")
const stripTags = require("striptags")

const processImage = async image => {
  return new Promise(async (resolve, reject) => {
    if (!image || !image.url) {
      resolve(null)

      return
    }

    const response = await fetch(image.url)
    const base64 = await response.buffer().toString("base64")

    resolve({
      url: image.url,
      base64,
    })
  })
}

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

    if (!nodeContent) {
      continue
    }

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
  try {
    const response = await fetch(podcast.xmlUrl)
    const data = await response.text()
    const json = xmlParser.toJson(data, { object: true })

    if (!json || !json.rss || !json.rss.channel || !json.rss.channel.text) {
      return null
    }

    const podcast = json.rss.channel
    const image = await processImage(podcast.image)

    return {
      name: podcast.text,
      url: podcast.link || "",
      description: stripTags(podcast.description || ""),
      docs: podcast.docs || "",
      language: podcast.language || "",
      image,
    }
  } catch (_) {
    return null
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
