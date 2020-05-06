import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import {
  MatButtonModule,
  MatCardModule,
  MatCheckboxModule,
  MatDialog,
  MatDialogModule,
  MatExpansionModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatProgressSpinnerModule,
} from "@angular/material";
import { SocketService } from "../shared/socket.service";
import { HostComponent } from "./host.component";
import { DialogTeamComponent } from "../dialog-team/dialog-team.component";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatCheckboxModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  declarations: [
    HostComponent,
    DialogTeamComponent
  ],
  providers: [
    MatDialog,
    SocketService
  ],
  entryComponents: [
    HostComponent,
    DialogTeamComponent
  ]
})
export class HostModule { }
