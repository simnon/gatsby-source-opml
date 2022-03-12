/**
 * Configure your Gatsby site with this file.
 *
 * See: https://www.gatsbyjs.com/docs/gatsby-config/
 */

module.exports = {
  plugins: [{
      resolve: require.resolve(`../`),
      options: {
        // Url to opml file, relative to project root directory
        file: `projects/gatsby-source-opml/example-site/data/overcast.opml`,
        name: `opml`,
      },
    }],
}
