import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material';

import { MessageType } from '../shared/messageType';
import { Message } from '../shared/message.model';
import { User } from '../shared/user.model';
import { SocketService } from '../shared/socket.service';
import { DialogUserComponent } from '../dialog-user/dialog-user.component';
import { DialogUserType } from '../dialog-user/dialog-user-type';
import { Question } from '../shared/question.model';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/take';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

const AVATAR_URL = 'https://api.adorable.io/avatars/285';
// todo: need a way to invalidate stored user so they can pick a new name
@Component({
  selector: 'tcc-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit {
  type = MessageType;
  user: User;
  question: Question;
  questionImage: SafeResourceUrl;
  timeLeft: number;
  timerInterval: any;
  timerStarted: boolean;
  questionAnswer: string;
  answerSubmitted: boolean;
  messages: Message[] = [];
  messageContent: string;
  ioConnection: any;
  dialogRef: MatDialogRef<DialogUserComponent> | null;
  defaultDialogUserParams: any = {
    disableClose: true,
    data: {
      title: 'Welcome',
      dialogType: DialogUserType.NEW
    }
  };

  constructor(private socketService: SocketService,
    public dialog: MatDialog, private ds: DomSanitizer) { }

  ngOnInit(): void {
    this.initModel();

    let team = localStorage.getItem('team');
    if (team && team.length > 0) {
      this.user = JSON.parse(team);
      this.initIoConnection();
      this.sendNotification(MessageType.JOINED);
    } else {
      // Using timeout due to https://github.com/angular/angular/issues/14748
      setTimeout(() => {
        this.openUserPopup(this.defaultDialogUserParams);
      }, 0);
    }
    this.timerStarted = false;
  }

  private initModel(): void {
    const randomId = this.getRandomId();
    this.user = {
      id: randomId,
      avatar: `${AVATAR_URL}/${randomId}.png`
    };
  }

  private initIoConnection(): void {
    this.socketService.initSocket();

    this.ioConnection = this.socketService.onMessage()
      .subscribe((message: Message) => {
        if (message.type === MessageType.WHO && message.from.id != this.user.id) {
          this.user.gameId = message.content;
          this.sendNotification(MessageType.WHO, this.user);
        }
        if (message.type === MessageType.QUESTION) {
          if (this.question && this.question.type == 'picture') {
            this.questionImage = this.ds.bypassSecurityTrustResourceUrl(this.question.picture);
          } else {
            this.questionImage = '';
          }
          if (this.answerSubmitted === true && message.content && message.content.id == this.question.id) {
            this.question = message.content;
            return false;
          }
          this.question = message.content;

          if (message.content === null || (!this.question || !this.question.started)) {
            this.questionAnswer = null;
            this.answerSubmitted = false;
            if (message.content === null || !this.question) {
              this.timerStarted = false;
              this.timeLeft = 0;
              this.resetTimer();
            }
          }
          return;
        }
        if (message.type === MessageType.TIMER_SYNC) {
          this.timeLeft = message.content;
          if (!this.timerStarted && this.timeLeft > 0) {
            this.startTimer();
          }
        }
        if (message.type === MessageType.TIMER_START) {
          this.timeLeft = this.question.timeAllowed;
          this.startTimer();
        }
        if (message.type === MessageType.UPDATE_SCORE) {
          this.user.score = message.content.find(team => team.id === this.user.id).score;
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

  private openUserPopup(params): void {
    this.dialogRef = this.dialog.open(DialogUserComponent, params);
    this.dialogRef.afterClosed().subscribe(paramsDialog => {
      if (!paramsDialog) {
        return;
      }

      this.user.name = paramsDialog.username;
      localStorage.setItem('team', JSON.stringify(this.user));
      this.initIoConnection();
      this.sendNotification(MessageType.JOINED);
    });
  }

  // send message on socket server
  private sendNotification(type: MessageType, data?: any): void {
    let message: Message = {
      from: this.user,
      type: type,
      content: data
    };
    this.socketService.send(message);
  }


  public submitAnswer() {
    this.socketService.send({
      from: this.user,
      content: this.questionAnswer,
      type: MessageType.TEAM_ANSWER
    });
    this.answerSubmitted = true;
  }

  private resetTimer() {
    if (this.timerInterval != null) {
      this.timerStarted = false;
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

  public getTeamAnswerText() {
    if (this.question.type === 'choice') {
      return this.question.choices.find(questionChoice => questionChoice.letter === this.questionAnswer).value;
    }
    return this.questionAnswer;
  }
}
