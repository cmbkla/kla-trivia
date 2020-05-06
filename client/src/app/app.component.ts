import { Component, OnInit, Pipe, PipeTransform } from '@angular/core';
import { User } from "./shared/user.model";
import { Message } from "./shared/message.model";
import { MessageType } from "./shared/messageType";
import { SocketService } from "./shared/socket.service";

@Component({
  selector: 'tcc-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private checkForTeamInterval: any;
  public team: User;
  private messageSubscription: any;

  constructor(private socketService: SocketService,) {
  }

  ngOnInit(): void {
    this.startCheckingForTeam();
  }

  private startCheckingForTeam(): void {
    this.checkForTeamInterval = setInterval(() => {
      this.checkForTeam();
    }, 2000);
  }

  private checkForTeam(): void {
    let teamData: User;
    try {
      teamData = JSON.parse(localStorage.getItem("team"));
    } catch (e) {}
    if (teamData) {
      clearInterval(this.checkForTeamInterval);
      this.team = teamData;
      this.messageSubscription = this.socketService.onMessage()
        .subscribe((message: Message) => {
          if (!this.team) {
            return;
          }
          if (message.type === MessageType.UPDATE_TEAM && message.content.id == this.team.id) {
            this.team = message.content;
          }
          if (message.type === MessageType.REMOVE_TEAM && message.content == this.team.id) {
            this.team = null;
            this.startCheckingForTeam();
          }
        });
    }
  }

  private initModel(): void {
  }
}
