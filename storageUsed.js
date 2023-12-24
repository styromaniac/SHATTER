function updateStorageSize() {
    chrome.storage.local.get(null, function(items) {
        var size = 0;
        for (var key in items) {
            if (items.hasOwnProperty(key)) {
                size += JSON.stringify(items[key]).length;
            }
        }
        size = size / 1024 / 1024; // convert to megabytes
        document.getElementById('storage-size').innerText = 'Storage used: ' + size.toFixed(2) + ' MB';
    });
}

document.addEventListener('DOMContentLoaded', updateStorageSize);

chrome.storage.onChanged.addListener(updateStorageSize);