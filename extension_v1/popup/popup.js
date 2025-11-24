document.getElementById('openSidebar').addEventListener('click', async () => {
    const currentWindow = await chrome.windows.getCurrent();
    chrome.sidePanel.open({ windowId: currentWindow.id });
    window.close(); // Close the popup
});
