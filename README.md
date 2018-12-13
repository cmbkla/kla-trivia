
# KLA Trivia

For use at KLA events. Loads questions from my question repo. Synchronizes with Spotify to play music during each question.

__TODO__:
* Better recovery for the host on reload/close-open
* Dynamic game factors in a modal when you click "New Game"
* Dynamic question source
* Dynamic Spotify credentials

## Run Server
```bash
$ cd server
$ npm install -g gulp-cli
$ npm install
$ gulp build
$ npm start
```

The server will be running on port `8080`

## Run Client

```bash
$ cd client
$ npm install
$ ng serve -host 0.0.0.0
```

The client will be running on port `4200`

