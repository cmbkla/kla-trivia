import { Component, OnInit } from '@angular/core';

import { MessageType } from '../shared/messageType';
import { Message } from '../shared/message.model';
import { User } from '../shared/user.model';
import { SocketService } from '../shared/socket.service';
import { Question } from '../shared/question.model';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/take';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

const AVATAR_URL = 'https://api.adorable.io/avatars/285';
//  /${randomId}.png
@Component({
  selector: 'tcc-display',
  templateUrl: './display.component.html',
  styleUrls: ['./display.component.css']
})
export class DisplayComponent implements OnInit {
  isFinal: boolean;
  type = MessageType;
  questionImage: SafeResourceUrl;
  user: User;
  question: Question;
  timerInterval: any;
  timeLeft: number;
  timerStarted: boolean;
  messages: Message[] = [];
  ioConnection: any;
  showingLeaderboard: boolean;
  teams: Array<User>;
  avatarUrl: string;

  constructor(private socketService: SocketService, private ds: DomSanitizer) { }

  ngOnInit(): void {
    this.initModel();
    // Using timeout due to https://github.com/angular/angular/issues/14748
    this.timerStarted = false;
    this.initIoConnection();
    this.sendNotification(MessageType.JOINED);
  }

  private initModel(): void {
    const randomId = this.getRandomId();
    this.user = {
      id: randomId,
      name: 'Display',
      avatar: ''
    };
    this.teams = [];
    this.showingLeaderboard = false;
    this.avatarUrl = AVATAR_URL;
  }

  private initIoConnection(): void {
    this.socketService.initSocket();

    this.ioConnection = this.socketService.onMessage()
      .subscribe((message: Message) => {
        if (message.type === MessageType.QUESTION) {
          this.isFinal = false;
          this.showingLeaderboard = false;
          this.question = message.content;
          if (this.question && this.question.type == 'picture') {
            this.questionImage = this.ds.bypassSecurityTrustResourceUrl('data:image/jpeg;base64,' + this.question.picture);
          } else {
            this.questionImage = '';
          }
        }
        if (message.type === MessageType.TIMER_SYNC) {
          this.timeLeft = message.content;
          if (!this.timerStarted && this.timeLeft > 0) {
            this.startTimer();
          }
        }
        if (message.type === MessageType.TIMER_START) {
          this.isFinal = false;
          this.timeLeft = this.question.timeAllowed;
          this.startTimer();
        }

        if (message.type === MessageType.UPDATE_SCORE) {
          this.teams = message.content.sort(function(a,b){
            return a.score < b.score ? 1 : a.score > b.score ? -1 : 0
          });
        }

        if (message.type === MessageType.DISPLAY_SCOREBOARD) {
          this.questionImage = '';
          this.showingLeaderboard = true;
          this.isFinal = false;
          if (message.content === true) {
            this.isFinal = true;
          }
        }

        this.messages.push(message);
      });

    this.socketService.onConnect()
      .subscribe(() => {
      });

    this.socketService.onDisconnect()
      .subscribe(() => {
      });
  }

  private getRandomId(): number {
    return Math.floor(Math.random() * (1000000)) + 1;
  }

  public sendNotification(type: MessageType): void {
    let message: Message = {
      from: this.user,
      type: type
    };
    this.socketService.send(message);
  }

  private resetTimer() {
    if (this.timerInterval != null) {
      this.timerInterval.unsubscribe();
      this.timerInterval = null;
    }
  }

  private startTimer() {
    if (this.timerStarted) {
      return true;
    }
    this.resetTimer();
    this.timerStarted = true;
    let interval = Observable.timer(0, 1000)
      .take(this.timeLeft);
    this.timerInterval = interval.subscribe(
      function (t) {
        if (this.timeLeft > 15) {
          this.timerTick(t)
        } else {
          this.resetTimer();
        }
      }.bind(this),
      function (err) {
      }.bind(this),
      function () {
        this.resetTimer();
      }.bind(this)
    );
  }
  private timerTick(t) {
    this.timeLeft = this.timeLeft - 1;
  }
  public timeIsShort() {
    return this.timeLeft <= 10 && this.timeLeft > 0;
  }
  public formatTimer() {
    let sec_num = this.timeLeft; // don't forget the second param
    let hours   = Math.floor(sec_num / 3600).toString();
    let minutes = Math.floor((sec_num - (parseInt(hours) * 3600)) / 60).toString();
    let seconds = (sec_num - (parseInt(hours) * 3600) - (parseInt(minutes) * 60)).toString();

    if (parseInt(hours)   < 10) {hours   = "0"+hours;}
    if (parseInt(minutes) < 10) {minutes = "0"+minutes;}
    if (parseInt(seconds) < 10) {seconds = "0"+seconds;}
    return (hours !== '00' ? hours+':' : '')+minutes+':'+seconds;
  }

  public getAnswerText() {
    if (this.question.type === 'choice') {
      return this.question.choices.find(questionChoice => questionChoice.letter === this.question.answer).value;
    }
    return this.question.answer;
  }
}
