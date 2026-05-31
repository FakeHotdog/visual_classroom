# Visual Classroom / Flask Backend

This repository contains the frontend and the backend code. 

The frontend code is in the `src` folder, while packed into the `dist` folder. The backend code is in the `app_h5.py` file, which serves the frontend files and provides APIs for the frontend to interact with the server.

This project uses Flask as the backend framework, which is a lightweight and easy-to-use web framework for Python. The frontend is built using Vite and JavaScript, which is a modern build tool that provides fast and efficient development experience.Typescript is more suitable for large-scale projects, but for this project, we choose JavaScript for simplicity and ease of use.

## Building the environment

### Install Python dependencies
```bash
pip install -r requirements.txt
```

### Install Node.js dependencies
```bash
cd web-classroom
npm install vite vue vue-router js-sha256
```

### Build the frontend
```bash
npm run build
```
Then the built files will be in the `dist` folder, which will be served by the Flask backend.

## Running the Application in Windows

### Run python file
For debugging, you can run: 

```powershell
python app_h5.py debug
```

For production: 

```powershell
pythonw app_h5.py *> serve.log
```

For killing the server: 

```powershell
taskkill /F /IM pythonw.exe
```

### Access the application

First run debug mode to initialize the database and create an admin user. From the terminal, you can see the shared IP address of the server, which is usually in the form of `http://<IP_ADDRESS>:5000`. You should remember this IP address, change the code in `src/App.vue Line 25`, and rebuild the frontend.

Then you can open a web browser and enter the IP address to access the application. In this way, you can run the application for production, and access it from other devices in the same network, such as your phone or another computer.

### Further what you can do

- You can also run the server in a cloud environment, such as AWS, Azure, or Google Cloud. In this way, you can access the application from anywhere in the world, not just in the same network. You need to set up a virtual machine, install Python and Flask, and run the server on it. Then you need to open the port 5000 for incoming traffic, and get the public IP address of the virtual machine. Finally, you can access the application using the public IP address.

- You can also use Docker to containerize the application, which makes it easier to deploy and manage. You can create a Dockerfile that defines the environment and dependencies for the application, and then build a Docker image from it. Finally, you can run a Docker container from the image, and access the application through the container's IP address or port mapping.