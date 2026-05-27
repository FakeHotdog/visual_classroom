# Visual Classroom / Flask Backend

This repository contains the backend code. 

## How to Expose the Local Server to the Internet (using Cloudflare Quick Tunnel)

If you want to expose your local development server to the internet without a public IP or port forwarding, you can use **Cloudflare Quick Tunnel** (trycloudflare).

### Prerequisites
Install the `cloudflared` CLI. On Windows, you can install it via winget:
```powershell
winget install --id Cloudflare.cloudflared
```

### Usage Steps

**Step 1: Start your local Flask server**
Run your backend application as usual. It will start on localhost (e.g., `http://127.0.0.1:8000`).
```powershell
python app.py
```
*(Leave this terminal window open)*

**Step 2: Start the Cloudflare Tunnel**
Open a **new** terminal window and run the following command to start the tunnel, pointing it to your local server's port:
```powershell
cloudflared tunnel --url http://127.0.0.1:8000
```

**Step 3: Get your public URL**
In the output of the second terminal, look for a line containing a URL that ends with `trycloudflare.com`. It will look something like this:
```text
https://your-random-words.trycloudflare.com
```

You can now use this HTTPS URL in your frontend app (like WeChat Mini Program) to communicate with your local backend.

### ⚠️ Important Notes
- The URL is **temporary**. Every time you stop and restart the `cloudflared` command, a new random URL will be generated.
- You must keep **both** terminal windows open (one for Flask, one for cloudflared) for the tunnel to work.

## Running the Application in Windows

### Build distribution package
'''powershell
npm run build
'''

### Run python file
For debugging, you can run: 

'''powershell
python app_h5.py
'''

For production: 

'''powershell
pythonw app_h5.py prod *> app.log
'''

For killing the server: 

'''powershell
taskkill /F /IM pythonw.exe
'''