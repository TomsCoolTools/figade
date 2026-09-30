// How the site is built. You rarely need to touch this.
const crypto = require("crypto");
const fs = require("fs");

module.exports = function (eleventyConfig) {
  // Adds a short code to a file's link that changes whenever the file changes, e.g.
  // /css/style.css?v=3f9a1c2e, so browsers fetch the new copy straight after a deploy.
  eleventyConfig.addFilter("v", (url) =>
    url + "?v=" + crypto.createHash("md5").update(fs.readFileSync("static" + url)).digest("hex").slice(0, 8)
  );

  // How long a 16:9 clip can be at a size before the compressor drops to each resolution.
  // Uses the same rule as static/js/app.js (0.07 bits per pixel at 30fps, 94% of the size for
  // the video, sound at 64 or 96 kbps), so the numbers match what the tool really does.
  eleventyConfig.addFilter("fits", (mb) => {
    const bytes = mb * 1e6, audio = bytes <= 12e6 ? 64000 : 96000;
    const words = (sec) =>
      sec < 100 ? Math.round(sec) + " seconds"
      : sec < 600 ? Math.round(sec / 30) / 2 + " minutes"
      : Math.round(sec / 60) + " minutes";
    return [1080, 720, 480, 360].map((h) => {
      const perSecond = 0.07 * (h * 16 / 9) * h * 30 + audio;
      return { res: h + "p", time: words((bytes * 8 * 0.94) / perSecond) };
    });
  });

  // Structured data for a page with the compressor, so search engines know it is a free
  // browser tool, and what its questions and answers are. Everything in it is shown on the page.
  eleventyConfig.addFilter("toolSchema", (data) => {
    const url = data.site.url + (data.page.url.replace(".html", "").replace("/index", "/"));
    const home = data.page.url === "/";
    const graph = [
      {
        "@type": "WebApplication",
        name: home ? data.site.name : data.h1,
        url,
        description: data.description,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any",
        browserRequirements: "A current version of Chrome, Edge or Safari",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: data.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ];
    if (home) {
      graph.push(
        { "@type": "WebSite", name: data.site.name, url: data.site.url + "/" },
        {
          "@type": "Organization",
          name: data.site.name,
          url: data.site.url + "/",
          logo: data.site.url + "/img/android-chrome-512x512.png",
          email: data.site.contact,
          founder: { "@type": "Person", name: "Tom" },
        }
      );
    }
    return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  });

  // Everything in static/ is copied to the site as-is (css, js, img, favicon, robots.txt).
  eleventyConfig.addPassthroughCopy({ static: "/" });

  // The video encoder, served from this site so it loads fast. The version is set in package.json;
  // if you change it, change the jsDelivr fallback version in static/js/app.js to match.
  eleventyConfig.addPassthroughCopy({
    "node_modules/mediabunny/dist/bundles/mediabunny.min.mjs": "js/mediabunny.mjs",
  });

  // Turns a date into 2026-09-30 for the sitemap.
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));

  // The list of pages that belong in sitemap.xml: every real page except noindex ones.
  eleventyConfig.addCollection("sitemap", (collection) =>
    collection
      .getAll()
      .filter(
        (item) =>
          item.data.noindex !== true &&
          item.outputPath &&
          item.outputPath.endsWith(".html")
      )
  );

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
