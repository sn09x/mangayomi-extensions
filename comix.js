function mangaFromItem(item, titleSlug) {
    // Extract and build the new URL format
    const newUrl = `https://site.com/title/r${item.id}-${titleSlug}`;
    // ... your existing code
}

function getDetail(url) {
    // Parse the new URL format
    const regex = /https:\/\/site.com\/title\/r(\d+)-(\w+)/;
    const match = url.match(regex);
    if (match) {
        const id = match[1];
        const title = match[2];
        // ... your existing code to handle the id and title
    }
}

function getPageList(url) {
    // Handle the new URL structure
    const regex = /https:\/\/site.com\/title\/r(\d+)-(\w+)/;
    const match = url.match(regex);
    if (match) {
        const id = match[1];
        // ... your existing code to retrieve the page list
    }
}
