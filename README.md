# AI Memory Collector 🧠

**A "Second Brain" for your AI conversations.**

AI Memory Collector is a Chrome Extension that automatically captures, organizes, and *remembers* your conversations across **ChatGPT**, **Gemini**, and **Claude**. It acts as a persistent memory layer, allowing you to search and retrieve context from past conversations instantly.

![AI Memory Logo](extension_v2/images/logo_master.png)

## 🚀 Features

*   **Universal Capture**: Works seamlessly on ChatGPT, Gemini, Claude, and Perplexity.
*   **Cloud Persistence**: Your data is stored securely in **Neon (Serverless Postgres)**, ensuring it survives browser restarts and syncs across devices.
*   **Vector Search**: Find memories by *meaning*, not just keywords (powered by local HNSW vector search).
*   **Liquid UI**: A non-intrusive sidebar that blends into your AI interface.
*   **Project Management**: Organize chats into dedicated projects to keep your workflows clean.

## 🛠️ Tech Stack

*   **Frontend**: Chrome Extension (Manifest V3), Vanilla JavaScript
*   **Backend**: Node.js, Express (Deployed on **Vercel**)
*   **Database**: **Neon** (Serverless Postgres)
*   **Search**: SQLite WASM + HNSW (Local Vector Search)

---

## 📥 Installation Guide

Since this extension is in **Developer Preview**, you need to install it manually using Chrome's Developer Mode. Don't worry, it's safe and takes 1 minute!

### Step 1: Download the Code
1.  Click the green **Code** button above and select **Download ZIP**.
2.  Unzip the file to a folder on your computer.
    *   *Note: You will see a folder named `extension_v2`. This is the one we need.*

### Step 2: Open Chrome Extensions
1.  Open Google Chrome.
2.  In the address bar, type: `chrome://extensions` and press Enter.
3.  (Or go to the "Puzzle Piece" icon 🧩 -> Manage Extensions).

### Step 3: Enable Developer Mode
1.  Look at the **top right corner** of the Extensions page.
2.  Toggle the switch for **Developer mode** to **ON**. 🔵

### Step 4: Load the Extension
1.  Click the button that says **Load unpacked** (top left).
2.  A file picker will open. Navigate to the folder where you unzipped the code.
3.  **Select the `extension_v2` folder**.
    *   *Important: Select the folder itself, not a file inside it.*

### Step 5: Pin & Use!
1.  The **AI Memory Collector** should now appear in your list!
2.  Click the **Puzzle Piece** 🧩 in your Chrome toolbar.
3.  Click the **Pin** 📌 icon next to AI Memory Collector to keep it visible.
4.  Go to ChatGPT or Gemini, and you will see the sidebar appear!

---

## ☁️ Setup (For Developers)

If you want to run your own backend server (optional):

1.  **Clone the repo**:
    ```bash
    git clone https://github.com/tohin003/AI-Memory.git
    ```
2.  **Navigate to Server**:
    ```bash
    cd server
    ```
3.  **Install Dependencies**:
    ```bash
    npm install
    ```
4.  **Configure Environment**:
    Create a `.env` file with:
    ```env
    POSTGRES_URL=your_neon_connection_string
    SECRET_KEY=your_random_secret
    ```
5.  **Run Locally**:
    ```bash
    npm start
    ```

## 📄 License

MIT License. Feel free to fork and build upon this project!
