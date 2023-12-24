// Helper function for getting a checksum of a URL
function hashTextWithSHA3_512(text) {
    const shaObj = new jsSHA("SHA3-512", "TEXT", { encoding: "UTF8" });
    shaObj.update(text);
    return shaObj.getHash("HEX");
}

const searchEngines = {
    'google': 'q',
    'bing': 'q',
    'duckduckgo': 'q',
    'aol': 'q',
    'ask': 'q',
    'dogpile': 'q',
    'ecosia': 'q',
    'mojeek': 'q',
    'webcrawler': 'q',
    'info': 'q',
    'zapmeta': 'q',
    'hotbot': 'q',
    'teoma': 'q',
    'contenko': 'q',
    'yandex': 'text',
    'baidu': 'wd',
    'sogou': 'query',
    'swisscows': 'query',
    'metager': 'eingabe'
};

function getSearchQueryFromURL(url) {
  const urlObj = new URL(url);
  const hostnameParts = urlObj.hostname.split('.');
  const baseDomain = hostnameParts.length > 1 ? hostnameParts.slice(-2).join('.') : urlObj.hostname;
  const queryParam = searchEngines[baseDomain.split('.').slice(-2)[0]] || null;

  if (queryParam) {
    const query = urlObj.searchParams.get(queryParam);
    return query ? query.replace(/\\+/g, ' ') : null;
  }
  return null;
}

// In-memory cache for checksums
let queryChecksumsCache = new Set();
let urlChecksumsCache = new Set();

// Function to load checksums from storage to cache
function loadChecksums() {
    browser.storage.local.get(["queryChecksums", "urlChecksums"]).then((result) => {
        queryChecksumsCache = new Set(result.queryChecksums || []);
        urlChecksumsCache = new Set(result.urlChecksums || []);
    });
}

// Listen for changes in the storage and update the cache accordingly
browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        if (changes.queryChecksums) {
            queryChecksumsCache = new Set(changes.queryChecksums.newValue || []);
        }
        if (changes.urlChecksums) {
            urlChecksumsCache = new Set(changes.urlChecksums.newValue || []);
        }
    }
});

// Load the checksums into the cache when the extension starts
loadChecksums();

browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        let searchQuery = getSearchQueryFromURL(details.url);
        if (searchQuery) {
            let checksum = hashTextWithSHA3_512(searchQuery);
            if (queryChecksumsCache.has(checksum)) { // Use 'has' instead of 'includes'
                return { redirectUrl: browser.extension.getURL("warning.html") };
            }
        }
        return {cancel: false};
    },
    {urls: ["<all_urls>"]},
    ["blocking"]
);

// URL of public suffix list
const publicSuffixURL = 'https://publicsuffix.org/list/public_suffix_list.dat';

// Cache for public suffixes
let publicSuffixes = new Set();

// Function to fetch and parse public suffixes
function updatePublicSuffixes() {
  fetch(publicSuffixURL).then(response => response.text()).then(data => {
    publicSuffixes.clear();
    data.split('\n').forEach(line => {
      // Skip comments and empty lines
      if (!line.startsWith('//') && line.trim() !== '') {
        publicSuffixes.add(line.trim());
      }
    });
  });
}

// Function to determine the top-level domain using public suffixes
function getTopLevelDomain(parts) {
  for (let i = 1; i <= parts.length; i++) {
    const suffixCandidate = parts.slice(-i).join('.');
    if (publicSuffixes.has(suffixCandidate)) {
      return parts.slice(0, -i).join('.');
    }
  }
  return parts.join('.'); // Fallback to full hostname if no match found
}

// Function to hash and check the TLD against the blocklist
function checkTLDAgainstBlocklist(hostname) {
  const parts = hostname.split('.');
  const tld = getTopLevelDomain(parts); // Using public suffixes to find TLD
  if (tld) {
    const checksum = hashTextWithSHA3_512(tld); // Hash the TLD
    if (urlChecksumsCache.has(checksum)) { // Check against the blocklist
      return true;
    }
  }
  return false;
}

// Function to check each subdomain level against blocklist hashes
function checkSubdomainsAgainstBlocklist(hostname) {
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length; i++) {
    const subdomain = parts.slice(i).join('.');
    const checksum = hashTextWithSHA3_512(subdomain);
    if (urlChecksumsCache.has(checksum)) { // Assuming urlChecksumsCache contains the blocklist
      return true;
    }
  }
  return false;
}

// Function to get the public suffix from a hostname
function getPublicSuffix(hostname) {
  const parts = hostname.split('.');
  for (let i = parts.length; i > 0; i--) {
    const suffixCandidate = parts.slice(-i).join('.');
    if (publicSuffixes.has(suffixCandidate)) {
      return suffixCandidate;
    }
  }
  return '';
}

// Function to break down the hostname into SLD, TLD, and subdomains
function breakdownHostname(hostname) {
  const publicSuffix = getPublicSuffix(hostname);
  const remainingParts = hostname.replace(`.${publicSuffix}`, '').split('.');
  const sld = remainingParts.pop();
  const subdomains = remainingParts;

  return {
    sld,
    tld: publicSuffix,
    subdomains
  };
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const urlObj = new URL(details.url);
    const hostname = urlObj.hostname;

    // Break down the hostname into SLD, TLD, and subdomains
    const { subdomains } = breakdownHostname(hostname);

    // Block the request if there are more than 500 subdomains
    if (subdomains.length > 500) {
      return { redirectUrl: browser.extension.getURL("warning.html") };
    }

    // Block based on checksums of different domain lengths
    if (checkSubdomainsAgainstBlocklist(hostname) || checkTLDAgainstBlocklist(hostname)) {
      return { redirectUrl: browser.extension.getURL("warning.html") };
    }

    // Check for search query blocking
    let searchQuery = getSearchQueryFromURL(details.url);
    if (searchQuery) {
        let checksum = hashTextWithSHA3_512(searchQuery);
        if (queryChecksumsCache.has(checksum)) {
            return { redirectUrl: browser.extension.getURL("warning.html") };
        }
    }

    return {cancel: false};
  },
  {urls: ["<all_urls>"]},
  ["blocking"]
);

// Call the updatePublicSuffixes function at extension start
updatePublicSuffixes();

// Schedule updates every 24 hours
setInterval(updatePublicSuffixes, 24 * 60 * 60 * 1000);