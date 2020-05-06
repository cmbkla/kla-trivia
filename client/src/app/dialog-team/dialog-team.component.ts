import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA  } from '@angular/material';
import { FormControl, Validators } from '@angular/forms';
import { User } from "../shared/user.model";

@Component({
  selector: 'tcc-dialog-team',
  templateUrl: './dialog-team.component.html',
  styleUrls: ['./dialog-team.component.css']
})
export class DialogTeamComponent implements OnInit {
  nameControl: FormControl;
  questionScoreControls: FormControl[] = [];
  data: User;

  constructor(public dialogRef: MatDialogRef<DialogTeamComponent>,
    @Inject(MAT_DIALOG_DATA) public params: {team: User}) {
  }

  ngOnInit() {
    this.nameControl = new FormControl(this.params.team.name, [Validators.required]);
    this.data = JSON.parse(JSON.stringify(this.params.team));
    this.data.questionScoreOverride.forEach((questionScore, index) => {
      this.questionScoreControls.push(new FormControl(this.data.questionScoreOverride[index], [Validators.required]));
    });
    console.log(this.data);
  }

  public onSave(): void {
    this.dialogRef.close(this.data);
  }

  public onCancel(): void {
    this.dialogRef.close(null);
  }

  public onDelete(): void {
    this.dialogRef.close({'delete': this.data});
  }

  public convertQuestionScoreIndexToQuestionRound(index: number) {
    const round = Math.round(index / 4) + 1;
    const question = index % 4 + 1;
    return 'Round ' + round + ', Question ' + question;
  }
}
