import * as express from "express";
import * as http from "http";
import * as socketIo from "socket.io";

import { Message } from "./model";
import { User } from './model/user.model';

export class Server {
    public port:number = 8080;
    public app: any;
    private server: any;
    private io: any;

    constructor() {
        this.createApp();
        this.config();
        this.addEndpoints();
        this.createServer();
        this.sockets();
        this.listen();
    }

    private createApp(): void {
        this.app = express();
    }

    private createServer(): void {
        this.server = http.createServer(this.app);
    }

    private config(): void {
        this.port = parseInt(process.env.PORT) || 8080;
        this.app.use(function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        });
    }

    private sockets(): void {
        this.io = socketIo(this.server);
    }

    private listen(): void {
        let listenPort = this.port;
        this.server.listen(this.port, "0.0.0.0", function() {
            console.log('Running server on port %s', listenPort);
        });

        this.io.on('connect', (socket: any) => {
            console.log('Connected client on port %s.', listenPort);
            socket.on('message', (m: Message) => {
                console.log('[server](message): %s', JSON.stringify(m));
                this.io.emit('message', m);
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected');
            });
        });
    }

    private addEndpoints(): void {
        this.app.get('/spotifyauth/:code', function (req: any, res: any) {
            let request = require("request");
            let postData = {
                grant_type: 'authorization_code',
                code: req.params.code,
                redirect_uri: 'http://3296c2b0.ngrok.io:8080/token',
                client_id: '62a8dc0ad3224977a880734a85a3c92a',
                client_secret: '4d964a1c589d417581330da90b4a36c1'
            };
            request.post({url:'https://accounts.spotify.com/api/token', form: postData}, function(err: any, httpResponse: any, body: any){
                res.send(body)
            });
        });

        this.app.get('/token', (req: any, res: any) => {
            this.io.emit('message', <Message>{
                from: <User>{
                    id: 0,
                    name: 'Server'
                },
                type: 11,
                content: req.query
            });
            res.send('<html><head><script>(function() { setTimeout(function() { window.close(); }, 1000); })();</script></head><body><h1>CLOSING THIS WINDOW...</h1></body></html>');
        });
    }
}
