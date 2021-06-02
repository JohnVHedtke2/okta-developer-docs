const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path')

// generate info that will provide both the list of additional Pages & any necessary extendPageData
// Convert util/guides to pull from that extended PageData as much as possible (reduce client-side load)
// Add to dev process (when will this require a restart?)
// Note: Perhaps remove the guides-list.json in favor of generating the data in config.js itself!
//
// Also blow up on sanity failures, so we can catch them at build time (even dev build)

console.warn('====== build-guides-info.js ======');

const GUIDE_ROOT = 'docs/guides';

const getFrontMatterFrom = text => text.replace(/.*^---\s/m, '').replace(/^---[\s\S]*/m, '');
const getMetaFor = path => yaml.safeLoad(getFrontMatterFrom( fs.readFileSync(`${path}/index.md`, { encoding: 'utf8'} ))); // TODO: Path sep?

const getFrameworksFor = path => {
  const entries = fs.readdirSync(path);
  return entries.filter( name => !name.includes('.')).sort(); // assume: no ext = dir, for more simple code
};

const guideInfo = {};

// Load frontmatter yaml to JS from root file index page
const allGuidesMeta = getMetaFor(GUIDE_ROOT);
// Iterate over the known universe of guides from previous step
allGuidesMeta.guides.forEach( guide => {
  // Load frontmatter yaml to JS from _those_ guides index pages
  // .meta{}
  // .sections[]
  const guideMeta = getMetaFor(`${GUIDE_ROOT}/${guide}`);
  guideMeta.guide = guide;
  guideInfo[`/${GUIDE_ROOT}/${guide}/`] = {...guideMeta};

  // if !guideMeta.sections
  //   // try to parse directly as a 'section' (do the inside of forEach loop)
  //   const frameworks = getFrameworksFor(GUIDE_ROOT/guide)
  // fi
  if (guideMeta.sections) {
    // parse as multi-section guide
    // iterate over the sections of this guide
    // this is to fill in all frameworks used in the guide sections
    guideMeta.sections.forEach( section => {
      // TODO: Informatively blow up if no such section
      // load frontmatter yaml to JS for the index page of the sections of this guide
      // .meta{}
      const sectionMeta = getMetaFor(`${GUIDE_ROOT}/${guide}/${section}`);
      // get all the directories under this section, count them each as a framework
      const frameworks = getFrameworksFor(`${GUIDE_ROOT}/${guide}/${section}`);
      if(!guideMeta.frameworks && frameworks.length) {
        // set default if none
        // (always runs on first iteration)
        guideMeta.frameworks = frameworks;
        guideMeta.mainFramework = guideMeta.mainFramework || frameworks[0];
      } else if (guideMeta.frameworks && frameworks.length) {
        // add more frameworks if defined in further sections
        guideMeta.frameworks = Array.from( new Set([...guideMeta.frameworks, ...frameworks]));
      }
    });
  } else {
    // try to parse as single-page guide
    // load frontmatter yaml to JS for the index page of the sections of this guide
    // .meta{}
    const sectionMeta = getMetaFor(`${GUIDE_ROOT}/${guide}`);
    // get all the directories under this section, count them each as a framework
    const frameworks = getFrameworksFor(`${GUIDE_ROOT}/${guide}`);
    if(!guideMeta.frameworks && frameworks.length) {
      // set default if none
      // (always runs on first iteration)
      guideMeta.frameworks = frameworks;
      guideMeta.mainFramework = guideMeta.mainFramework || frameworks[0];
    } else if (guideMeta.frameworks && frameworks.length) {
      // add more frameworks if defined in further sections
      guideMeta.frameworks = Array.from( new Set([...guideMeta.frameworks, ...frameworks]));
    }
  }

  // If a guide had no frameworks in any section
  guideMeta.frameworks = guideMeta.frameworks || [];
  
  // repeat now that we have a list of frameworks
  if (guideMeta.sections) {
    guideMeta.sections.forEach( section => {
      const sectionMeta = getMetaFor(`${GUIDE_ROOT}/${guide}/${section}`);
      [...guideMeta.frameworks, '-'].forEach( framework => {
        // here also we can put GUIDE_ROOT/guide/framework/ for single-page?
        guideInfo[`/${GUIDE_ROOT}/${guide}/${framework}/${section}/`] = {
          ...sectionMeta,
          sectionTitle: sectionMeta.title,
          guideTitle: guideMeta.title,
          title: `${sectionMeta.title} - ${guideMeta.title}`,
          toAdd: true, // used to flag additions compared to any existing page definitions
          mainFramework: guideMeta.mainFramework,
          filePath: path.resolve(__dirname, `../../${GUIDE_ROOT}/${guide}/${section}/index.md`)
        };
      });
    });
  } else {
    const sectionMeta = getMetaFor(`${GUIDE_ROOT}/${guide}`);
    [...guideMeta.frameworks, '-'].forEach( framework => {
      guideInfo[`/${GUIDE_ROOT}/${guide}/${framework}/`] = {
        // elim sectionmeta or guidemeta here
        ...sectionMeta,
        sectionTitle: sectionMeta.title,
        guideTitle: guideMeta.title,
        title: `${sectionMeta.title} - ${guideMeta.title}`,
        toAdd: true, // used to flag additions compared to any existing page definitions
        mainFramework: guideMeta.mainFramework,
        filePath: path.resolve(__dirname, `../../${GUIDE_ROOT}/${guide}/index.md`)
      };
    });
  }

  guideInfo[`/${GUIDE_ROOT}/${guide}/`] = {...guideMeta};
});

const additionalPagesForGuides = () => {
  return Object.entries(guideInfo)
    .filter( ([, info]) => info.toAdd )
    .map( ([path, info]) => ({
      ...info,
      path,
      content: ' ',
    }))
    .sort( (a, b) => a.path > b.path ? 1 : a.path < b.path ? -1 : 0 );
};

module.exports = {
  guideInfo,
  additionalPagesForGuides,
};
