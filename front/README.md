# Cometa

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 1.7.3.

## Development server

Run `docker-compose -f docker-compose-dev-111.yml up -d --force-recreate` to automatically start cometa-front in development mode.

You might need to remove container, if installation is unclean or broken. Execute `docker-compose -f docker-compose-dev-111.yml rm  --force` to clean up the docker.

Alternatively run manually `npx ng serve --host 0.0.0.0 --port 4200 --disable-host-check` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files. Going directly to server:4200 will most likely produce CORS-errors, as backend is running on another port.

The apache `config openidc.conf_local` has mod_rewrite configured to access URL at "/debug" and reverse proxy URLs to server:4200 without problems regarding CORS-header. Use `https://localhost/debug/#/new` for running over SSL to the debug URL of `ng serve`.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `-prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).

## Loading the app into a container

Requires docker and docker-compose to be installed.

## License

Copyright 2021 COMETA ROCKS S.L.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
