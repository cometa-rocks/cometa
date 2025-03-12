## To build the container image

1. build appium container image with name cometa/appium 
    `docker build -t cometa/appium -f appium/Dockerfile .`

2. Extended emulator image from cometa/appium container image
    `docker build -t cometa/emulator -f Dockerfile . > build.log 2>&1`
    `docker build -t cometa/emulator . > build.log 2>&1`
 
    `docker build -t cometa/emulator:Android_12.0_API30_x86_64 -f emulator/Dockerfile .`
    `docker build -t cometa/emulator:Android_12.0_API31_x86_64 -f emulator/Dockerfile .`



# Store build logs in the file, it is useful for debugging of building the emulators
docker build -t cometa/emulator:Android_12.0_API33_x86_64 -f Dockerfile . > build.log 2>&1

