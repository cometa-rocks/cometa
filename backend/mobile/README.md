# Cometa Android Emulator Docker Repository

## Overview

Welcome to the **Cometa Android Emulator Docker Repository**! This repository provides Docker images for Android emulators designed to simplify and accelerate mobile app testing. With features like remote access, Appium integration, video recording, and dynamic app installation, these containerized Android emulators are perfect for scalable, cloud-ready testing solutions.

## Features

1. **Appium Integration**: Connect seamlessly with Appium Inspector to create and debug your tests.
2. **Remote Access**: Access the emulator remotely via VNC or NoVNC to interact with the mobile screen.
3. **Screen Recording**: Automatically record your test sessions by enabling a simple configuration.
4. **Dynamic App Installation**: Upload and install apps dynamically during your tests.
5. **Scalable Testing**: Run multiple emulators simultaneously in a cloud environment for parallel testing.

---

## Getting Started

### Prerequisites

- Docker installed on your system
- A valid Cometa.rocks Enterprise Edition subscription (see License section below)

### Pull the Docker Image

```bash
docker pull cometa/emulator
```

### Run the Emulator with Docker-Compose

To simplify deployment, use the following `docker-compose.yml` file:

```yaml
services:
  cometa-emulator:
    image: cometa/emulator:Android_12.0_API31_x86_64    
    working_dir: /app 
    devices:
      # - "/dev/kvm:/dev/kvm"  # If you have KVM device then pass KVM device for hardware acceleration
      - "./video:/video"  
      - "./apps:/tmp"  
    privileged: true
    ports:
    - "4723:4723"
    - "6080:6080"
    - "5900:5900"
    environment:
      - AUTO_RECORD=true
    networks:
      - testing
    restart: always

networks:
  testing:
    driver: "bridge"
```

Save this file as `docker-compose.yml` and run:

```bash
docker-compose up -d
```

---

### Environment Variables

- `AUTO_RECORD=true`: Enables automatic screen recording of the emulator session.

---

### Sample Configuration for Appium Tests

**App Installation**

Mount the directory containing your app files to the `./apps` directory in the container and specify the app file in your Appium configuration:

```yaml
- "./apps:/tmp"
```

In your Appium script:

```python
configuration["capabilities"]["app"] = "/tmp/your_app.apk"
```

**Recording Video Sessions**

Mount the directory where you want to save your video to the container:

```yaml
- "./video:/video"  
```

To enable video recording, include the following in your Appium configuration:

```python
configuration = {...your_capabilities}
configuration["capabilities"]["record_video"] = True  
options = AppiumOptions() 
options.load_capabilities(configuration["capabilities"])
```

The emulator will automatically record the video of your Appium session and save it with the session ID as the filename in `.mp4` format under the `./video` directory.

---

## Documentation

### Accessing the Emulator

- **VNC**: Connect to `localhost:5900` using a VNC viewer.
- **NoVNC**: Open `http://localhost:6080` in your browser for a web-based interface.

---

### Recording Test Sessions

Set the `AUTO_RECORD=true` environment variable when running the container to automatically save video recordings of your tests in the `./video` directory.

Additionally, using Appium capabilities as shown above will ensure that the video recording is tied to your Appium session.

---

## License

### The Cometa.rocks Commercial License (the “Commercial License”)

Copyright (c) 2020-present Cometa.rocks

With regard to the Software:

This software and associated documentation files (the "Software") may only be used in production if you (and any entity that you represent) have agreed to, and are in compliance with, the Subscription Terms, or other agreements governing the use of the Software, as mutually agreed by you and Cometa.rocks, and otherwise have a valid Enterprise Edition subscription ("Commercial Subscription") for the correct number of hosts as defined in the "Commercial Terms ("Hosts"). Subject to the foregoing sentence, you are free to modify this Software and publish patches to the Software. You agree that Cometa.rocks and/or its licensors (as applicable) retain all right, title, and interest in and to all such modifications and/or patches, and all such modifications and/or patches may only be used, copied, modified, displayed, distributed, or otherwise exploited with a valid Commercial Subscription for the correct number of hosts. Notwithstanding the foregoing, you may copy and modify the Software for development and testing purposes, without requiring a subscription. You agree that Cometa.rocks and/or its licensors (as applicable) retain all right, title, and interest in and to all such modifications. You are not granted any other rights beyond what is expressly stated herein. Subject to the foregoing, it is forbidden to copy, merge, publish, distribute, sublicense, and/or sell the Software.

This Commercial License applies only to the part of this Software that is not distributed under the AGPLv3 license. Any part of this Software distributed under the MIT license or which is served client-side as an image, font, cascading stylesheet (CSS), file which produces or is compiled, arranged, augmented, or combined into client-side JavaScript, in whole or in part, is copyrighted under the AGPLv3 license. The full text of this Commercial License shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

For all third-party components incorporated into the Cometa.rocks Software, those components are licensed under the original license provided by the owner of the applicable component.

Enterprise features may or may not be sponsored by third-party organizations or individuals. Is code marked as "sponsored by Amvara," then the mentioned organization is exempted from the need of purchasing an "Enterprise License" and is entitled to use the Software "as is" without further obligations.

---

## Contributing

We welcome contributions from the community! Please ensure compliance with the license terms when submitting patches or modifications.

---

## Support

For support and inquiries, reach out to [support@cometa.rocks](mailto:support@cometa.rocks).
