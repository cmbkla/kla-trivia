import { Component, OnInit } from '@angular/core';
import { MessageType } from '../shared/messageType';
import { Message } from '../shared/message.model';
import { User } from '../shared/user.model';
import { SocketService } from '../shared/socket.service';
import { Question } from '../shared/question.model';
import { QuestionChoices } from '../shared/questionChoices.model';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/take';
import 'rxjs/add/operator/map';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const SPOTIFY_API_ENDPOINT = 'https://api.spotify.com/v1/';

@Component({
  selector: 'tcc-host',
  templateUrl: './host.component.html',
  styleUrls: ['./host.component.css']
})
export class HostComponent implements OnInit {
  newGameConfirm: boolean;
  type = MessageType;
  user: User;
  activeQuestion: Question;
  stateLabel: string;
  messages: Message[] = [];
  ioConnection: any;
  questionsLoading: boolean;
  questions: Array<Question>;
  questionCategories: Array<any>;
  teams: Array<User>;
  game: Array<any>;
  gameId: number;
  gameRounds: number;
  gameQuestionsPerRound: number;
  gamePoints: Array<number>;
  leadboardDisplayed:boolean;

  // subscribe for timer, time left in question, and value to store manual entry of time
  timerInterval: any;
  timeLeft: number;
  manualTime: number;

  // spotify access token and api call management
  spotifyLatch:boolean = false;
  gettingSpotifyLatch:boolean = false;
  spotifyCode: string;
  spotifyToken: any;
  spotifyApiQueue = [];
  spotifyApiState = false;
  spotifyPlayState = 'paused';
  spotifyMuteState = false;
  spotifyTrackList = [];

  constructor(private socketService: SocketService, private http: HttpClient) { }

  ngOnInit(): void {
    // setup data and connect to socket server
    this.initModel();
    this.initIoConnection();
    this.sendNotification(MessageType.JOINED);

    // check for existing game and questions
    let storedGame = localStorage.getItem('game');
    if (storedGame) {
      this.game = JSON.parse(storedGame);
      this.gameId = parseInt(localStorage.getItem('gameId'));

      let storedQuestions = localStorage.getItem('questions');
      if (storedQuestions) {
        this.questions = JSON.parse(storedQuestions);
        this.buildCategories();

        let storedActiveQuestion = localStorage.getItem('activeQuestion');
        try {
          if (storedActiveQuestion && JSON.parse(storedActiveQuestion) != null) {
            this.activeQuestion = JSON.parse(storedActiveQuestion);
            if (this.activeQuestion != null && this.activeQuestion.started) {
              this.timeLeft = parseInt(localStorage.getItem('timerLeft'));
              this.startQuestionTimer();
            }
          }
        } catch (e) {}
      }
    } else {
      this.createNewGame(false);
      this.user.gameId = this.gameId;
    }

    // poll to see what teams are connected
    this.sendNotification(MessageType.WHO, this.gameId);

    //this.setupSpotify();
  }

  // setup default values, including user
  private initModel(): void {
    const randomId = this.getRandomId();
    this.user = {
      id: randomId,
      avatar: '',
      name: 'Host'
    };
    this.teams = [];
    this.game = [];
    this.questions = [];
    this.questionCategories = [];
    this.gameRounds = 4;
    this.gameQuestionsPerRound = 4;
    this.gamePoints = [5, 10, 20, 40];
    this.spotifyToken = null;
  }

  // initialize connection to socket server, and handle messages on the socket
  private initIoConnection(): void {
    this.socketService.initSocket();

    this.ioConnection = this.socketService.onMessage()
      .subscribe((message: Message) => {
        this.handleMessage(message);
        this.messages.push(message);
      });

    this.socketService.onConnect()
      .subscribe(() => {
      });

    this.socketService.onDisconnect()
      .subscribe(() => {
      });
  }
  private handleMessage(message) {
    if (message.from.id === this.user.id) {
      return;
    }
    switch (message.type) {
      case MessageType.JOINED:
      case MessageType.WHO:
        if (typeof this.getTeam(message.from.id) === 'undefined') {
          if (message.from.name !== 'Host' && message.from.name !== 'Display') {
            message.from.score = 0;
            message.from.roundScore = [];
            this.teams.push(message.from);
          }
        }
        this.sendNotification(MessageType.QUESTION, this.activeQuestion);
        this.sendNotification(MessageType.TIMER_SYNC, this.timeLeft);
        this.calculateScore();
        this.sendNotification(MessageType.UPDATE_SCORE, this.teams);
        break;
      case MessageType.TEAM_ANSWER:
        if (!this.teamHasAnswered(message.from.id)) {
          this.addTeamAnswer(message);
        }
        break;
      case MessageType.TOKEN:
        this.spotifyCode = message.content.code;
        localStorage.setItem('spotifyCode', this.spotifyCode);
        this.spotifyApiQueue = [];
        this.getSpotifyAuth();
        break;
    }
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
  public translateMessageTypeToText(messageType) {
    switch (messageType) {
      case MessageType.JOINED:
        return 'JOINED';
      case MessageType.LEFT:
        return 'LEFT';
      case MessageType.CHAT:
        return 'CHAT';
      case MessageType.QUESTION:
        return 'QUESTION';
      case MessageType.TEAM_ANSWER:
        return 'TEAM_ANSWER';
      case MessageType.TIMER_START:
        return 'TIMER_START';
      case MessageType.TIMER_SYNC:
        return 'TIMER_SYNC';
      case MessageType.UPDATE_SCORE:
        return 'UPDATE_SCORE';
      case MessageType.DISPLAY_SCOREBOARD:
        return 'DISPLAY_SCOREBOARD';
      case MessageType.WHO:
        return 'WHO';
      case MessageType.SYSTEM:
        return 'SYSTEM';
      case MessageType.TOKEN:
        return 'TOKEN';
    }
    return messageType;
  }

  // generate a random ID
  private getRandomId(): number {
    return Math.floor(Math.random() * (1000000)) + 1;
  }

  // clear game state and questions
  public createNewGame(confirm?: boolean) {
    if (confirm !== false && this.newGameConfirm !== true) {
      this.newGameConfirm = true;
      setTimeout(function () {
        this.newGameConfirm = false;
      }.bind(this), 5000);
      return;
    }
    this.newGameConfirm = false;
    this.teams = [];
    this.game = [];
    this.questions = [];
    this.questionCategories = [];
    this.teams = [];
    this.gameId = this.getRandomId();
    this.activeQuestion = null;
    this.timeLeft = 0;
    this.storeGameData();
    this.sendNotification(MessageType.WHO, this.gameId);
    this.sendNotification(MessageType.QUESTION, null);
  }

  // find a team by team ID
  private getTeam(teamId: number) {
    return this.teams.find(team => team.id === teamId);
  }

  // determine whether team has answered  question
  private teamHasAnswered(teamId: number) {
    return this.activeQuestion.teamAnswers.find(teamAnswer => teamAnswer.team.id === teamId);
  }

  // adding a team answer from socket server message
  private addTeamAnswer(message: any) {
    let user: User = this.getTeam(message.from.id);
    let isCorrect = '?';
    if (this.activeQuestion.type === 'choice') {
      if (message.content.trim() == this.activeQuestion.answer.trim()) {
        isCorrect = 'Y';
      } else {
        isCorrect = 'N';
      }
    }
    this.activeQuestion.teamAnswers.push({
      team: user,
      answer: message.content,
      correct: isCorrect
    });
    this.storeGameData();
  }

  // manually mark an answer correct
  public markAnswer(answer, result) {
    answer.correct = result;
  }

  // display for button text in game control area
  public getQuestionState() {
    if (!this.activeQuestion) {
      return false;
    }

    if (!this.activeQuestion.categoryDisplayed) {
      this.stateLabel = 'Display Category';
      return true;
    }

    if (!this.activeQuestion.asked) {
      this.stateLabel = 'Display Question';
      return true;
    }

    if (!this.activeQuestion.started) {
      this.stateLabel = 'Display Timer';
      return true;
    }

    if (!this.activeQuestion.answerDisplayed) {
      this.stateLabel = 'Display Answer';
      return true;
    }

    if (!this.leadboardDisplayed) {
      this.stateLabel = 'Display Leaderboard';
      return true;
    }

    this.stateLabel = 'Next Question';
    return true;
  }

  // handler for game control button
  public advanceQuestionState() {
    if (!this.activeQuestion) {
      return false;
    }

    if (!this.activeQuestion.categoryDisplayed) {
      this.displayCategory();
      return true;
    }

    if (!this.activeQuestion.asked) {
      this.displayQuestion();
      return true;
    }

    if (!this.activeQuestion.started) {
      this.startQuestionTimer();
      return true;
    }

    if (!this.activeQuestion.answerDisplayed) {
      this.displayAnswer();
      return;
    }

    if (!this.leadboardDisplayed) {
      this.updateScoreAndShowLeaderboard();
      return;
    }

    this.resetForNextQuestion();
    return true;
  }

  // clicked on a question on the question list
  public openQuestion(questionId: number) {
    this.activeQuestion = this.questions[questionId];
  }

  // game control, checked an answer choice checkbox, revealing it to the players
  public revealChoice(choice: QuestionChoices) {
    choice.revealed = true;
    this.sendNotification(MessageType.QUESTION, this.activeQuestion);
  }

  // reset timer and unsubscribe from Observer
  private resetTimer() {
    if (this.timerInterval != null) {
      this.timerInterval.unsubscribe();
      this.timerInterval = null;
    }
  }

  // game control, start game timer observer
  private startQuestionTimer() {
    this.activeQuestion.started = true;
    if (this.spotifyLatch) {
      this.startSpotifyPlayback();
    } else {
      if (this.manualTime < 1) {
        return false;
      }
      this.timeLeft = this.manualTime;
      this.activeQuestion.timeAllowed = this.timeLeft;
      this.actuallyStartTimer();
      this.manualTime = 0;
    }
  }

  private actuallyStartTimer() {
    this.sendNotification(MessageType.QUESTION, this.activeQuestion);
    this.sendNotification(MessageType.TIMER_START);

    this.storeGameData();
    let interval = Observable.timer(0, 1000)
      .take(this.timeLeft);
    this.timerInterval = interval.subscribe(
      function (t) {
        if (this.timeLeft > 0) {
          this.timerTick(t)
        } else {
          this.timerIsDone();
        }
      }.bind(this),
      function (err) {
      }.bind(this),
      function () {
        if (this.timeLeft <= 1 && this.activeQuestion) {
          this.timerIsDone();
        }
      }.bind(this)
    );
  }

  private timerIsDone() {
    if (this.spotifyPlayState == 'playing') {
      this.spotifyControl('pause');
    }
    this.activeQuestion.timerDone = true;
    this.storeGameData();
    this.sendNotification(MessageType.QUESTION, this.activeQuestion);
    this.resetTimer();
  }

  // handle tick for game timer, send a TIMER_SYNC once there is less than 15 seconds
  private timerTick(t) {
    this.timeLeft = this.timeLeft - 1;
    if (this.timeLeft <= 1 && this.spotifyPlayState == 'playing') {
      this.spotifyControl('pause');
    }
    if (this.timeLeft % 10 === 0 || this.timeLeft < 15) {
      if (this.timeLeft > 9 && this.timeLeft % 10 === 0) {
        this.makeSpotifyPlayerApiCall(
          'get',
          'currently-playing',
          '',
          {},
          function (result) {
            this.timeLeft = Math.ceil(((<any>result).item.duration_ms - (<any>result).progress_ms) / 1000);
            this.sendNotification(MessageType.TIMER_SYNC, this.timeLeft);
          }.bind(this)
        );
      } else {
        this.sendNotification(MessageType.TIMER_SYNC, this.timeLeft);
      }
    }
    this.storeGameData();
  }

  // decide whether to make the timer text red
  public timeIsShort() {
    return this.timeLeft <= 10 && this.timeLeft > 0;
  }

  // format the timer seconds into a human-friendly display
  public formatTimer() {
    let sec_num = this.timeLeft; // don't forget the second param
    let hours   = Math.floor(sec_num / 3600).toString();
    let minutes = Math.floor((sec_num - (parseInt(hours) * 3600)) / 60).toString();
    let seconds = (sec_num - (parseInt(hours) * 3600) - (parseInt(minutes) * 60)).toString();

    if (parseInt(hours)   < 10) {hours   = '0'+hours;}
    if (parseInt(minutes) < 10) {minutes = '0'+minutes;}
    if (parseInt(seconds) < 10) {seconds = '0'+seconds;}
    return (hours !== '00' ? hours+':' : '')+minutes+':'+seconds;
  }

  // game control, display the category
  private displayCategory() {
    this.activeQuestion.categoryDisplayed = true;
    let gamePosition: any = this.getRoundAndQuestionNumber(true);
    this.activeQuestion.round = gamePosition.round;
    this.activeQuestion.questionNumber = gamePosition.question;
    if (this.gameQuestionsPerRound == gamePosition.question) {
      this.activeQuestion.isDoubler = true;
    }
    this.sendNotification(MessageType.QUESTION, this.activeQuestion);
  }

  // game control, display the question
  private displayQuestion() {
    this.activeQuestion.teamAnswers = [];
    this.activeQuestion.asked = true;
    this.storeGameData();
    this.sendNotification(MessageType.QUESTION, this.activeQuestion);
  }

  // game control, stop the timer and show the answer
  private displayAnswer() {
    if (this.spotifyPlayState == 'playing') {
      this.spotifyControl('pause');
    }
    this.activeQuestion.timerDone = true;
    this.activeQuestion.answerDisplayed = true;
    this.timeLeft = 0;
    this.resetTimer();
    this.sendNotification(MessageType.QUESTION, this.activeQuestion);
    if (this.activeQuestion) {
      this.game.push(this.activeQuestion);
      this.storeGameData();
    }
    this.storeGameData();
    return true;
  }

  // game control, store the active question and show the leaderboard
  public updateScoreAndShowLeaderboard() {
    this.calculateScore();
    this.sendNotification(MessageType.UPDATE_SCORE, this.teams);
    this.sendNotification(MessageType.DISPLAY_SCOREBOARD, this.gameIsComplete());
    this.leadboardDisplayed = true;
  }

  private calculateScore() {
    this.teams.forEach(team => {
      team.score = 0;
    });

    let points:number = this.gamePoints[0];
    let round:number = 0;
    let questionsThisRound:number = 0;
    let teamScoreRound = {};
    this.game.forEach(gameQuestion => {
      questionsThisRound++;

      this.teams.forEach(team => {
        let thisTeamAnswer = gameQuestion.teamAnswers.find(teamAnswer => teamAnswer.team.id === team.id);

        if (thisTeamAnswer && thisTeamAnswer.correct === 'Y') {
          if (typeof teamScoreRound[team.id] === 'undefined') {
            teamScoreRound[team.id] = 0;
          }
          if (questionsThisRound == this.gameQuestionsPerRound) {
            teamScoreRound[team.id] = teamScoreRound[team.id] * 2; // double dare
          } else {
            teamScoreRound[team.id] = teamScoreRound[team.id] + points; // regular
          }
        } else if(
          thisTeamAnswer && thisTeamAnswer.correct === 'N' &&
          questionsThisRound == this.gameQuestionsPerRound
        ) {
          teamScoreRound[team.id] = 0; // double dare wrong
        }
      });

      if (questionsThisRound == this.gameQuestionsPerRound) {
        this.teams.forEach(team => {
          if (typeof teamScoreRound[team.id] !== 'undefined') {
            team.score = team.score + teamScoreRound[team.id];
            team.roundScore.push(teamScoreRound[team.id]);
          } else {
            team.roundScore.push(0);
          }
        });
        round++;
        questionsThisRound = 0;
        points = this.gamePoints[round];
        teamScoreRound = {};
      }
    });

    // grab any leftover score
    if (questionsThisRound > 0) {
      this.teams.forEach(team => {
        if (typeof teamScoreRound[team.id] !== 'undefined') {
          team.score = team.score + teamScoreRound[team.id];
          team.roundScore.push(teamScoreRound[team.id]);
        } else {
          team.roundScore.push(0);
        }
      });
    }
  }

  // game control, reset active question and prepare for next question
  private resetForNextQuestion() {
    this.activeQuestion = null;
    this.leadboardDisplayed = false;
    this.timeLeft = 0;
    this.resetTimer();
    this.storeGameData();
    this.sendNotification(MessageType.QUESTION, this.activeQuestion);
  }

  // determine which round and question # we're on based on the game data
  public getRoundAndQuestionNumber(asObject?: boolean) {
    let round:number = 0;
    let questionsThisRound:number = 0;
    this.game.forEach(gameQuestion => {
      questionsThisRound++;
      if (questionsThisRound == this.gameQuestionsPerRound) {
        round++;
        questionsThisRound = 0;
      }
    });
    if (asObject === true) {
      return {
        round: round + 1,
        question: questionsThisRound + 1
      };
    }
    return 'Round: ' + (round+1) + ', question ' + (questionsThisRound+1);
  }

  public isDoubler() {
    let gameData: any = this.getRoundAndQuestionNumber(true);
    if (gameData.question == this.gameQuestionsPerRound) {
      return true;
    }
    return false;
  }

  public gameIsComplete() {
    let gameData: any = this.getRoundAndQuestionNumber(true);
    if (gameData.round >= this.gameRounds && gameData.question >= this.gameQuestionsPerRound) {
      return true;
    }
    return false;
  }

  // utility function to translate multiple-choice answer to text
  public getAnswerText() {
    if (this.activeQuestion.type === 'choice') {
      return this.activeQuestion.choices.find(questionChoice => questionChoice.letter === this.activeQuestion.answer).value;
    }
    return this.activeQuestion.answer;
  }

  // import questions from github repo
  /* This is fugly AF but it does work, so..... */
  public importQuestions() {
    this.questionsLoading = true;
    let validCategories = ['picture-this', 'people', 'animals', 'entertainment', 'history', 'humanities', 'movies', 'music', 'science-technology', 'sports', 'video-games', 'world', 'television', 'literature', 'hobbies', 'geography', 'brain-teasers'];
    let categoryMax = 20;
    let categoryComplete = 0;
    let questionId = 0;
    let re="#";

    // https://api.github.com/repos/cmbkla/OpenTriviaQA/contents/categories
    this.http.get('https://api.github.com/repos/cmbkla/OpenTriviaQA/contents/categories')
      .subscribe(categories => {

        Object.keys(categories).forEach(function (index) {
          if (validCategories.indexOf(categories[index].name) >= 0) {
            // kludge
            if (categories[index].name == 'science-technology') {
              categories[index].name = 'science & technology';
            }
            this.http.get(categories[index].download_url, {responseType: 'text'})
              .subscribe((questions: any) => {
                let categoryCount = 0;
                questions = questions.split(re);

                // shuffle potential questions
                for (let i = questions.length - 1; i > 0; i--) {
                  let j = Math.floor(Math.random() * (i + 1));
                  [questions[i], questions[j]] = [questions[j], questions[i]];
                }

                questions.forEach(function (question) {
                  categoryCount++;
                  if (categoryCount >= categoryMax) {
                    return true;
                  }

                  question = question.split("\n");
                  let questionObj: Question = {
                    id: questionId,
                    category: categories[index].name.substr(0, 1).toUpperCase() +
                    categories[index].name.substr(1).replace('-', ' '),
                    title: '',
                    type: 'choice',
                    answer: '',
                    timeAllowed: 9999,
                    choices: [],
                    categoryDisplayed: false,
                    started: false,
                    asked: false,
                    answerDisplayed: false,
                    timerDone: false,
                    teamAnswers: [],
                    round: 0,
                    questionNumber: 0,
                    isDoubler: false
                  };
                  let answerText = '';
                  let questionText = '';
                  let answerTooLong = false;
                  Object.keys(question).forEach(function (questionLineIndex) {
                    let questionLine = question[questionLineIndex];

                    if (
                      questionLine.substr(0, 1) == 'A' ||
                      questionLine.substr(0, 1) == 'B' ||
                      questionLine.substr(0, 1) == 'C' ||
                      questionLine.substr(0, 1) == 'D' ||
                      questionLine.substr(0, 1) == 'E' ||
                      questionLine.substr(0, 1) == 'F'
                    ) {

                      questionObj.choices.push(<QuestionChoices>{
                        value: questionLine.substr(2),
                        letter: questionLine.substr(0, 1)
                      });
                      if (questionLine.substr(2).length > 50) {
                        answerTooLong = true;
                      }
                    } else if (questionLine.substr(0, 1) == '^') {

                      answerText = questionLine.substr(2);
                    } else if (
                      questionLine.substr(0, 1) == '%'
                    ) {
                      questionObj.picture = questionLine.substr(2);
                      questionObj.type = 'picture';
                    } else {
                      questionText += questionLine;
                    }
                  });

                  if (questionObj.choices.length < 3 && questionObj.type !== 'picture') {
                    questionObj.type = 'fill';
                  }

                  if (questionText.length > 200 || answerTooLong) {
                    return true;
                  }

                  // fill this in for questions without choices
                  if (questionObj.type === 'picture' || questionObj.type === 'fill') {
                    questionObj.choices = [];
                  }

                  questionObj.title = questionText.replace('Q ', '');

                  if (questionObj.type != 'picture' && questionObj.type != 'fill') {
                    let answerChoice = questionObj.choices.find(choice => choice.value === answerText)
                    if (!answerChoice) {
                      return true;
                    }
                    questionObj.answer = answerChoice.letter;
                  } else {
                    questionObj.answer = answerText;
                  }
                  this.questions.push(questionObj);
                  questionId++;
                }.bind(this));

                categoryComplete++;
                if (categoryComplete == validCategories.length) {
                  this.buildCategories();
                  this.storeGameData();
                }
              });
          } else {
            console.log('Invalid category return', categories[index]);
          }

        }.bind(this));
      });
  }

  private buildCategories() {
    this.questions.forEach(function (question) {
      let category = this.questionCategories.find(category => category.name === question.category);
      if (!category) {
        this.questionCategories.push({
          name: question.category,
          questions: []
        });
        category = this.questionCategories.find(category => category.name === question.category);
      }
      category.questions.push(question);
    }.bind(this));
/*    this.questionCategories.sort((left, right) => {
      if(left.name < right.name) { return -1; }
      if(left.name > right.name) { return 1; }
      return 0;
    });*/
    this.questionsLoading = false;
  }

  private storeGameData() {
    localStorage.setItem('questions', JSON.stringify(this.questions));
    localStorage.setItem('game', JSON.stringify(this.game));
    if (this.activeQuestion !== null) {
      localStorage.setItem('activeQuestion', JSON.stringify(this.activeQuestion));
      if (this.timeLeft) {
        localStorage.setItem('timeLeft', this.timeLeft.toString());
      }
    } else {
      localStorage.setItem('activeQuestion', null);
      localStorage.setItem('timeLeft', '0');
    }
  }

  private getSpotifyCode() {
    let existingCode = localStorage.getItem('spotifyCode');
    // todo: when we try to re-use this code it NEVER works. WHY?
    existingCode = '';
    if (existingCode && existingCode !== 'null' && existingCode.length > 0) {
      this.gettingSpotifyLatch = true;
      this.spotifyCode = existingCode;
      this.getSpotifyAuth();
      return;
    }
    this.gettingSpotifyLatch = true;
    this.spotifyApiQueue = [];
    let winFeature =
      'location=no,toolbar=no,menubar=no,scrollbars=yes,resizable=yes';
    window.open(
      'https://accounts.spotify.com/authorize?'
      + 'client_id=62a8dc0ad3224977a880734a85a3c92a'
      + '&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Ftoken'
      + '&scope=user-read-playback-state%20user-modify-playback-state%20user-read-currently-playing%20user-read-playback-state'
      + '&response_type=code&show_dialog=true', 'null', winFeature
    );
  }

  private updateSpotifyAuth() {
    if (this.gettingSpotifyLatch) {
      return;
    }
    this.spotifyToken = null;
    this.spotifyLatch = false;
    this.spotifyApiQueue = [];
    this.gettingSpotifyLatch = true;
    this.getSpotifyAuth()
  }

  private getSpotifyAuth() {
      this.http.get('http://localhost:8080/spotifyauth/' + this.spotifyCode
      ).subscribe(result => {
        let callResult = <any>result;
        if (typeof callResult.error != 'undefined') {
          this.messages.push(<Message>{
            'from':{
              name: 'SYSTEM'
            },
            type: MessageType.SYSTEM,
            content: 'SPOTIFY LATCH ERROR - ' + callResult.error
          });
          this.gettingSpotifyLatch = false;
          this.spotifyToken = null;
          localStorage.setItem('spotifyCode', null);
          this.spotifyCode = null;
          this.spotifyLatch = false;
          this.spotifyApiQueue = [];
          return;
        }
        this.spotifyToken = result;
        this.gettingSpotifyLatch = false;
        this.spotifyLatch = true;
        this.spotifyApiQueue = [];
        this.loadSpotifyPlaylist();
      }, error => {
        this.gettingSpotifyLatch = false;
        this.spotifyToken = null;
        this.spotifyCode = null;
        localStorage.setItem('spotifyCode', null);
        this.spotifyLatch = false;
        this.spotifyApiQueue = [];
        this.messages.push(<Message>{
          'from':{
            name: 'SYSTEM'
          },
          type: MessageType.SYSTEM,
          content: 'SPOTIFY LATCH ERROR'
        });
      });
  }

  private loadSpotifyPlaylist(){
    this.makeSpotifyPlayerApiCall(
      'get',
      'users/1251303310/playlists/6ohekrzCRPIZdQfDcQ6TvZ/tracks',
      '',
      {},
      function (result) {
        this.spotifyTrackList = result.items;
      }.bind(this),
      true
    );
  }

  private startSpotifyPlayback() {
    this.spotifyPlayState = 'playing';
    let questionIndex = this.game.length + 1;
    this.timeLeft = Math.ceil(this.spotifyTrackList[questionIndex].track.duration_ms / 1000);
    this.activeQuestion.timeAllowed = this.timeLeft;
    this.makeSpotifyPlayerApiCall(
      'put',
      'play',
      '',
      {context_uri: 'spotify:user:1251303310:playlist:6ohekrzCRPIZdQfDcQ6TvZ', offset: {uri:this.spotifyTrackList[questionIndex].track.uri}},
      function () {
        this.actuallyStartTimer();
      }.bind(this)
    );
  }

  spotifyControl(doWhat) {
    switch (doWhat) {
      case 'play':
        this.makeSpotifyPlayerApiCall(
          'put',
          'play',
          '',
          {}
        );
        this.spotifyPlayState = 'playing';
        break;
      case 'pause':
        this.makeSpotifyPlayerApiCall(
          'put',
          'pause',
          '',
          {}
        );
        this.spotifyPlayState = 'paused';
        break;
      case 'mute':
        this.makeSpotifyPlayerApiCall(
          'put',
          'volume',
          'volume_percent=0',
          {}
        );
        this.spotifyMuteState = true;
        break;
      case 'unmute':
        this.makeSpotifyPlayerApiCall(
          'put',
          'volume',
          'volume_percent=100',
          {}
        );
        this.spotifyMuteState = false;
        break;
      case 'prev':
        this.makeSpotifyPlayerApiCall(
          'post',
          'previous',
          '',
          {}
        );
        this.spotifyMuteState = false;
        break;
      case 'back':
        this.makeSpotifyPlayerApiCall(
          'put',
          'seek',
          'position_ms=0',
          {}
        );
        this.spotifyMuteState = false;
        break;
      case 'next':
        this.makeSpotifyPlayerApiCall(
          'post',
          'next',
          '',
          {}
        );
        this.spotifyMuteState = false;
        break;
    }
  }

  makeSpotifyPlayerApiCall(method: string, command: string, queryString: string, body: any, callback?: any, rawUrl?: boolean) {
    this.spotifyApiQueue.push({
      method: method,
      command: command,
      queryString: queryString,
      body: body,
      callback: callback,
      rawUrl: rawUrl,
      attempts: 0
    });
    if (this.spotifyApiState === false) {
      this.doSpotifyApiCall();
    }
  }

  doSpotifyApiCall() {
    if (!this.spotifyLatch) {
      return;
    }
    if (this.spotifyApiQueue.length === 0 || this.spotifyApiState === true) {
      return;
    }
    if (this.spotifyApiQueue[0].attempts >= 3) {
      this.messages.push(<Message>{
        'from':{
          name: 'SYSTEM'
        },
        type: MessageType.SYSTEM,
        content: 'SPOTIFY ERROR -- too many tries'
      });
      this.spotifyApiQueue.shift();
      this.spotifyApiState = false;
      if (this.spotifyApiQueue.length > 0) {
        setTimeout(function () {
          this.doSpotifyApiCall();
        }.bind(this), 1000);
      }
      return;
    }

    this.spotifyApiQueue[0].attempts++;
    this.spotifyApiState = true;

    this.messages.push(<Message>{
      'from':{
        name: 'SYSTEM'
      },
      type: MessageType.SYSTEM,
      content: 'SPOTIFY: ' + this.spotifyApiQueue[0].method + '-' + this.spotifyApiQueue[0].command
    });

    let url = '';
    if (this.spotifyApiQueue[0].rawUrl !== true) {
      url = SPOTIFY_API_ENDPOINT + 'me/player/' +
      this.spotifyApiQueue[0].command +
      (this.spotifyApiQueue[0].queryString.length > 0 ?
          '?' + this.spotifyApiQueue[0].queryString :''
      );
    } else {
      url = SPOTIFY_API_ENDPOINT + this.spotifyApiQueue[0].command;
    }

    let req;
    if (this.spotifyApiQueue[0].method === 'get') {
      req = this.http[this.spotifyApiQueue[0].method](
        url,
        {headers: new HttpHeaders().set('Authorization', 'Bearer ' + this.spotifyToken.access_token)}
      );
    } else {
      req = this.http[this.spotifyApiQueue[0].method](
        url,
        this.spotifyApiQueue[0].body,
        {headers: new HttpHeaders().set('Authorization', 'Bearer ' + this.spotifyToken.access_token)}
      );
    }

    req.subscribe(result => {
      if (typeof this.spotifyApiQueue[0].callback === 'function') {
        this.spotifyApiQueue[0].callback(result);
      }
      this.spotifyApiQueue.shift();
      this.spotifyApiState = false;
      if (this.spotifyApiQueue.length > 0) {
        setTimeout(function () {
          this.doSpotifyApiCall();
        }.bind(this), 1000);
      }
    }, error => {
      this.messages.push(<Message>{
        'from':{
          name: 'SYSTEM'
        },
        type: MessageType.SYSTEM,
        content: 'SPOTIFY ERROR'
      });
      this.spotifyApiState = false;
      setTimeout(function () {
        this.doSpotifyApiCall();
      }.bind(this), 2000);
    });
  }
}
