function updateList(category) {
    const fileList = document.getElementById(category + "FileList");
    fileList.innerHTML = '';

    browser.storage.local.get(category + "LinkedChecksumFiles").then((result) => {
        let linkedFiles = result[category + "LinkedChecksumFiles"] || [];
        linkedFiles.forEach((file) => {
            const listItem = document.createElement("li");
            const fileNameSpan = document.createElement("span");
            fileNameSpan.className = "fileName";
            fileNameSpan.textContent = file;
            const removeButton = document.createElement("button");
            removeButton.className = "removeButton";
            removeButton.textContent = "Remove";
            removeButton.onclick = function() {
                removeFile(file, category);
            };
            listItem.appendChild(fileNameSpan);
            listItem.appendChild(removeButton);
            fileList.appendChild(listItem);
        });
    });
}

function linkChecksumFile(category) {
    let url = document.getElementById(category + "ChecksumFileURL").value.trim();
    const pattern = /^(https:\/\/|http:\/\/localhost|http:\/\/127\.0\.0\.1|http:\/\/\[.*\]|.*\.ipfs\.localhost:8080|.*\.ipns\.localhost:8080|.*\.loki|.*\.onion|.*\.i2p)/;

    if (pattern.test(url)) {
        browser.storage.local.get(category + "LinkedChecksumFiles").then((result) => {
            let linkedFiles = result[category + "LinkedChecksumFiles"] || [];

            // Check if the URL is already in the linked files
            if (linkedFiles.includes(url)) {
                console.warn("URL already exists in the blocklist. Skipping addition.");
                return; // If the URL is found, exit the function early
            }

            fetch(url)
                .then(response => response.text())
                .then(data => {
                    let checksumsFromFile = data.split('\n').filter(line => line.trim() !== '');
                    browser.storage.local.get(category + "Checksums").then((result) => {
                        let checksums = result[category + "Checksums"] || [];
                        checksums = checksums.concat(checksumsFromFile);
                        browser.storage.local.set({ [category + "Checksums"]: checksums });
                    });
                    linkedFiles.push(url);
                    browser.storage.local.set({ [category + "LinkedChecksumFiles"]: linkedFiles });
                    updateList(category);
                })
                .catch(error => console.error(error));
        });
    } else {
        console.warn("Invalid URL. The URL must adhere to specific protocols or networks such as HTTPS, localhost, 127.0.0.1, Yggdrasil Network, IPFS, Lokinet, Tor, or I2P. Make sure to verify the URL and its source before proceeding.");
    }
}

function removeFile(fileUrl, category) {
    browser.storage.local.get([category + "LinkedChecksumFiles", category + "Checksums"]).then((result) => {
        let linkedFiles = result[category + "LinkedChecksumFiles"] || [];
        linkedFiles = linkedFiles.filter(file => file !== fileUrl);
        browser.storage.local.set({ [category + "LinkedChecksumFiles"]: linkedFiles });
        let checksums = new Set(result[category + "Checksums"] || []);
        fetch(fileUrl)
            .then(response => response.text())
            .then(data => {
                let checksumsFromFile = data.split('\n').filter(line => line.trim() !== '');
                checksumsFromFile.forEach(cs => checksums.delete(cs));
                browser.storage.local.set({ [category + "Checksums"]: Array.from(checksums) }); // Convert Set to Array
                updateList(category);
            })
            .catch(error => console.error(error));
    });
}

document.getElementById("linkQueryChecksumFile").addEventListener("click", () => linkChecksumFile("query"));
document.getElementById("linkURLChecksumFile").addEventListener("click", () => linkChecksumFile("url"));
updateList("query"); // Initialize the query list
updateList("url"); // Initialize the URL list