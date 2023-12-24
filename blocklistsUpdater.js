function updateBlocklists() {
    const pattern = /^(https:\/\/|http:\/\/localhost|http:\/\/127\.0\.0\.1|http:\/\/\[.*\]|.*\.ipfs\.localhost:8080|.*\.ipns\.localhost:8080|.*\.loki|.*\.onion|.*\.i2p)/;

    // Retrieve linked files for both categories
    ["url", "query"].forEach(category => {
        browser.storage.local.get(category + "LinkedChecksumFiles").then((result) => {
            let linkedFiles = result[category + "LinkedChecksumFiles"] || [];
            linkedFiles.forEach(url => {
                if (pattern.test(url)) {
                    fetch(url)
                        .then(response => response.text())
                        .then(data => {
                            let checksumsFromFile = data.split('\n').filter(line => line.trim() !== '');

                            // Update the storage
                            browser.storage.local.set({ [category + "Checksums"]: checksumsFromFile });

                            // Update the in-memory cache
                            if (category === "url") {
                                urlChecksumsCache = new Set(checksumsFromFile);
                            } else {
                                queryChecksumsCache = new Set(checksumsFromFile);
                            }
                        })
                        .catch(error => console.error(error));
                } else {
                    console.warn("Invalid URL. The URL must start with ...");
                }
            });
        });
    });
}
