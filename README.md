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
pythonw app_h5.py
```

And the log will be written to the serve.log file. You can check the log file to see if there are any errors or issues with the server.

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

# Course Review / Flask Backend

This repository contains the backend code for the course review system. The backend is built using Flask, which is a lightweight and easy-to-use web framework for Python. The backend provides APIs for the frontend to interact with the server, such as user authentication, course management, and review management. The backend also uses SQLAlchemy as the ORM (Object-Relational Mapping) tool to interact with the database, which makes it easier to manage the database and perform CRUD (Create, Read, Update, Delete) operations. The backend also uses Flask-CORS to handle Cross-Origin Resource Sharing (CORS) issues, which allows the frontend to make requests to the backend from a different origin. The backend also uses Flask-Limiter to limit the rate of requests, which helps to prevent abuse and protect the server from being overwhelmed. The backend also uses Flask-Mail to send emails, which can be used for user registration, password reset, and notifications. The backend also uses PyJWT to handle JSON Web Tokens (JWT), which is a secure way to transmit information between parties as a JSON object. The backend also uses python-dotenv to load environment variables from a .env file, which helps to keep sensitive information such as database credentials and secret keys out of the codebase. The backend also uses Flask-Migrate to handle database migrations, which allows you to manage changes to the database schema over time.

## Building the environment

Same as the Flask backend in the Visual Classroom project.

## Running the Application

Same as the Flask backend in the Visual Classroom project.

## Why I won't continue developing the backend

As we all know, Tsinghua University has a very strict policy on other's evaluation of courses, which is the main reason why I won't continue developing the backend. The course review system is a very useful tool for students to share their experiences and opinions about courses, but it also has the potential to cause problems if not used properly. The strict policy on course evaluation in Tsinghua University makes it difficult to implement a course review system without violating the policy. Therefore, I have decided to focus on other projects that are more feasible and less likely to cause issues.

Luckily, there are some substitute platforms that can be used for course reviews, such as [yourschool.cc](https://yourschool.cc/thubook) or [Tsinghua Courses](https://tsinghua.app/courses). These platforms provide a similar functionality for students to share their experiences and opinions about courses, and they are more compliant with the policies of Tsinghua University. Therefore, I recommend using these platforms for course reviews instead of developing a new backend for the course review system.