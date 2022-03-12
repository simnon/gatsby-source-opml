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
    const content = await response.buffer()

    resolve({
      url: image.url,
      base64: content.toString("base64"),
    })
  })
}

exports.sourceNodes = async (
  commands,
  configOptions
) => {
  await createPodcastsDataSource(commands , configOptions)
  await createPodcastEpisodesSource(commands, configOptions)
}

const createPodcastEpisodesSource = async (
  { actions, createNodeId, createContentDigest },
  configOptions
) => {
  const { createNode } = actions

  // delete configOptions.plugins

  const podcasts = await readPodcastsListFromFile(configOptions.file)
  
  for (const podcast of podcasts) {
    const podcastTitle = podcast.title
    const episodes = flatten(podcast.outline).filter( n => n)

    for (const episode of episodes) {
      const nodeId = createNodeId(`opml-podcast-episode-${uuid.v4()}`)
      const episodeNodeContent = await processEpisodeContent(podcast, episode)
      if (!episodeNodeContent) {
        console.error('No Episode Content') 
        continue
      }

      const nodeData = Object.assign({}, episodeNodeContent, {
        id: nodeId,
        parent: null,
        children: [],
        internal: {
          type: `OpmlPodcastEpisodes`,
          content: JSON.stringify(episodeNodeContent),
          contentDigest: createContentDigest(episodeNodeContent),
        },
      })

      createNode(nodeData)
    }
  }
}

const createPodcastsDataSource = async (
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

const processEpisodeContent = async (podcast, episode) => {
  console.log('pod: ' + podcast.text + "ep: " + JSON.stringify(episode,null,2))
  try {
    return {
      name: episode.title,
      podcastTitle: podcast.title,
      publishDate: episode.pubDate,
      episodeData: episode.enclosureUrl,
      playedCount: episode.played ?? 0,
      favorited: (episode.userRecommendedDate !== undefined | null) ? true : false, 
    }
  } catch (_) {
    console.error('failed to parse episode content')
    return null
  }
}

const processPodcastContent = async podcast => {
  try {
    const response = await fetch(podcast.xmlUrl)
    const data = await response.text()
    const json = xmlParser.toJson(data, { object: true })

    if (!json || !json.rss || !json.rss.channel || !json.rss.channel.title) {
      return null
    }

    const podcastData = json.rss.channel
    const image = await processImage(podcastData.image)
    const podcastUrl =
      typeof podcastData.link === "string" ? podcastData.link : ""

    return {
      name: podcastData.title,
      url: podcastUrl,
      description: stripTags(podcastData.description || ""),
      docs: podcastData.docs || "",
      language: podcastData.language || "",
      author: podcastData["itunes:author"] || "",
      image,
    }
  } catch (_) {
    return null
  }
}


function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

function flatten(arr) {
  if (isIterable(arr)) {
    return ([].concat(...arr))
  }
  return [arr]
}

const readPodcastsListFromFile = async filePath => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(__dirname, "../..", filePath), (error, data) => {
      if (error) {
        reject(error)

        return
      }

      const json = xmlParser.toJson(data, { object: true })
      var flattenedFeeds = flatten(json.opml.body.outline)
      const podcasts = flattenedFeeds.flatMap(feed => { return feed.outline }).filter( n => n)
      resolve(podcasts)
    })
  })
}
